// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {GangsterPriceOracle} from "./GangsterPriceOracle.sol";
import {GangsterHoldingOracle} from "./GangsterHoldingOracle.sol";
import {RandomnessResolver} from "./RandomnessResolver.sol";
import {ATMGameMath} from "./ATMGameMath.sol";
import {ATMGameCombat} from "./ATMGameCombat.sol";
import {ATMGameTypes} from "./ATMGameTypes.sol";

/// @notice Production game accounting for hoodATM on Robinhood Chain.
/// @dev Chance-based actions require a player reveal and an EIP-712 resolver attestation.
contract ATMGame is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error AccessDenied();
    error AlreadyJoined();
    error InvalidAction();
    error InvalidReferrer();
    error InvalidTier();
    error InvalidDuration();
    error InsufficientPayment(uint256 required, uint256 supplied);
    error SlippageExceeded(uint256 required, uint256 maximum);
    error TransferFailed();
    error CooldownActive(uint256 availableAt);
    error PendingActionExists();
    error NoPendingAction();
    error RevealTooEarly();
    error RevealExpired();
    error InvalidReveal();
    error InsufficientUnclaimed();
    error InsufficientBonusPool();
    error ContractPaused();
    error HoldingObservationUnavailable();
    error InvalidUsername();
    error UsernameTaken();
    error PaidGangsterRequired();
    error ResolverDeadlineInvalid();

    IERC20 internal constant GANGSTER = IERC20(0x6AE32f2620A4a2B55f4Fc4b9e3152c371Aa58EF0);
    address payable internal constant TREASURY = payable(0x7657d90609046F47215Fc0Fb2BF012c88FF9f700);
    address internal constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    uint256 internal constant JOIN_USD_E18 = 5 ether;
    uint256 internal constant ACCESS_HOLD_USD_E18 = 5 ether;
    uint256 internal constant CLAIM_BURN_BPS = 1_000;
    uint256 internal constant SPEND_TO_FARM_BPS = 2_500;
    uint256 internal constant CLAIM_COOLDOWN = 1 hours;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant ACC_REWARD_PRECISION = 1e24;
    uint256 internal constant ACTION_COOLDOWN = 6 hours;
    uint256 internal constant WITHDRAWAL_COOLDOWN = 12 hours;
    uint256 internal constant WITHDRAWAL_BPS = 5_000;
    uint256 internal constant HOLDING_OBSERVATION_MAX_AGE = 1 hours;
    uint256 internal constant SNITCH_USD_E18 = 1 ether;
    uint256 internal constant JAIL_PHONE_USD_E18 = 2 ether;
    uint256 internal constant MIN_REVEAL_DELAY = 30 seconds;
    uint256 internal constant ACTION_TIMEOUT = 1 hours;
    GangsterPriceOracle public immutable oracle;
    GangsterHoldingOracle public immutable holdingOracle;
    RandomnessResolver internal immutable randomnessResolver;
    ATMGameMath internal immutable gameMath;
    bool public paused = true;
    address public gangSystem;
    address public codeGranter;

    mapping(address => ATMGameTypes.Player) public players;
    mapping(address => ATMGameTypes.PendingAction) internal pendingActions;
    mapping(address => uint64) internal actionNonces;
    mapping(address => mapping(address => uint256)) public playerAttackAvailableAt;
    mapping(address => mapping(uint8 => uint256)) public atmAvailableAt;
    mapping(address => uint256) public lastWithdrawalAt;
    mapping(address => uint256) public claimedBalance;
    mapping(address => uint256) public lastClaimAt;
    mapping(address => uint256) public unclaimedSince;
    mapping(address => uint256) internal playerRewardUpdatedAt;
    mapping(address => uint256) public heatStartedAt;
    mapping(address => uint256) public layLowUntil;
    mapping(address => uint256) public jailedUntil;
    mapping(address => address) public snitchTarget;
    mapping(address => uint256) public snitchAvailableUntil;
    mapping(address => uint256) public jailPhones;
    mapping(address => uint256) public lockedRobberyLoot;
    mapping(address => uint256) public robberyLootUnlockAt;
    mapping(address => uint256) public snitchLoot;
    mapping(address => address) public jailHitTarget;
    mapping(address => uint256) public jailLostLoot;
    mapping(address => uint256) public jailIncidentAt;
    mapping(address => string) public usernames;
    mapping(bytes32 => address) public usernameOwner;
    mapping(address => bool) public codeGrantedGangster;
    mapping(address => bool) public paidGangster;
    mapping(address => uint256) public gangsterSlots;
    mapping(address => bool) public codeBonusSlotGranted;
    ATMGameTypes.ATMConfig[4] public atms;
    uint256[4] public atmClaimPools;
    uint256[4] public reservedAtmClaimPools;

    uint256 public totalPower;
    uint256 public accRewardPerPower;
    uint256 public lastRewardTime;
    uint256 public rewardRate;
    uint256 public rewardPeriodFinish;
    uint256 public bonusPool;
    uint256 public reservedBonusPool;
    uint256 public totalAtmClaimPool;
    uint256 public spendingFarmPoolContributed;
    uint256 public referralEntryPoolAllocatedGangster;
    uint256 public activePurchasedGangsters;

    event PauseUpdated(bool paused);
    event Joined(
        address indexed player,
        address indexed referrer,
        uint256 ethPaid,
        uint256 referralPoolAllocation
    );
    event TierUpgraded(address indexed player, uint8 indexed tier, uint32 power, uint256 ethPaid);
    event RewardsFunded(uint256 amount, uint256 duration, uint256 rewardRate);
    event BonusPoolFunded(uint256 amount);
    event GangsterSpendRouted(
        address indexed source,
        address indexed payer,
        uint256 amount,
        uint256 farmContribution
    );
    event Claimed(
        address indexed player,
        uint256 grossAmount,
        uint256 burnedAmount,
        uint256 atmFeeAmount,
        uint256 bonusAmount,
        uint256 receivedAmount,
        uint16 feeBps,
        uint16 bonusBps
    );
    event Withdrawn(address indexed player, uint256 amount, uint256 nextWithdrawalAt);
    event UsernameSet(address indexed player, string username);
    event LaidLow(address indexed player, uint256 readyAt);
    event CodeGrantedGangsterMarked(address indexed player);
    event CodeBonusSlotUnlocked(address indexed player, uint256 slots);
    event ActivePurchasedGangstersUpdated(uint256 activePurchasedGangsters, uint256 dailyBaseFarmUsdE18);
    event ActionCommitted(
        bytes32 indexed requestId,
        address indexed attacker,
        ATMGameTypes.ActionKind indexed kind,
        address target,
        uint8 atmIndex,
        uint64 nonce
    );

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier onlyActiveMember() {
        if (!_hasLiveAccess(msg.sender)) revert AccessDenied();
        _;
    }

    constructor(
        GangsterPriceOracle oracle_,
        GangsterHoldingOracle holdingOracle_,
        RandomnessResolver randomnessResolver_,
        ATMGameMath gameMath_
    ) Ownable(TREASURY) {
        if (
            address(oracle_) == address(0) || oracle_.gangster() != address(GANGSTER)
                || address(holdingOracle_) == address(0)
                || holdingOracle_.gangster() != address(GANGSTER)
                || address(randomnessResolver_) == address(0)
                || address(gameMath_) == address(0)
        ) {
            revert InvalidAction();
        }
        oracle = oracle_;
        holdingOracle = holdingOracle_;
        randomnessResolver = randomnessResolver_;
        gameMath = gameMath_;
        lastRewardTime = block.timestamp;

        // Civilian chances scale by tier power and can never exceed the original base chance.
        atms[0] = ATMGameTypes.ATMConfig({civilianChanceE8: 700_000, maximumChanceE8: 70_000_000, rewardUsdE18: 0.004 ether, lossUsdE18: 0.001 ether});
        atms[1] = ATMGameTypes.ATMConfig({civilianChanceE8: 50_000, maximumChanceE8: 50_000_000, rewardUsdE18: 0.01 ether, lossUsdE18: 0.003 ether});
        atms[2] = ATMGameTypes.ATMConfig({civilianChanceE8: 10_500, maximumChanceE8: 30_000_000, rewardUsdE18: 0.025 ether, lossUsdE18: 0.007 ether});
        atms[3] = ATMGameTypes.ATMConfig({civilianChanceE8: 1_500, maximumChanceE8: 15_000_000, rewardUsdE18: 0.075 ether, lossUsdE18: 0.02 ether});
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PauseUpdated(paused_);
    }

    function setGangSystem(address gangSystem_) external onlyOwner {
        if (gangSystem_ == address(0)) revert InvalidAction();
        gangSystem = gangSystem_;
    }

    function setCodeGranter(address codeGranter_) external onlyOwner {
        codeGranter = codeGranter_;
    }

    function setActivePurchasedGangsters(uint256 count) external onlyOwner {
        activePurchasedGangsters = count;
        emit ActivePurchasedGangstersUpdated(count, dailyBaseFarmUsd());
    }

    function dailyBaseFarmUsd() public view returns (uint256) {
        return gameMath.dailyBaseFarmUsd(activePurchasedGangsters);
    }

    /// @notice Mirrors a verified code/admin gangster into on-chain power.
    /// @dev `tier` 1..4 applies that tier's power when higher than current power. `0` only marks the flag.
    function markCodeGrantedGangster(address account, uint8 tier) external {
        if (msg.sender != owner() && msg.sender != codeGranter) revert AccessDenied();
        if (!players[account].joined || tier > 4) revert InvalidAction();
        _updatePlayer(account);
        ATMGameTypes.Player storage player = players[account];
        if (!codeGrantedGangster[account]) {
            codeGrantedGangster[account] = true;
            if (gangsterSlots[account] == 0) gangsterSlots[account] = 1;
            if (paidGangster[account] && !codeBonusSlotGranted[account]) {
                unchecked { gangsterSlots[account] += 1; }
                codeBonusSlotGranted[account] = true;
                emit CodeBonusSlotUnlocked(account, gangsterSlots[account]);
            }
            emit CodeGrantedGangsterMarked(account);
        }
        if (tier != 0) {
            uint32 grantedPower = gameMath.tierPower(tier);
            if (grantedPower > player.power) {
                totalPower = totalPower - player.power + grantedPower;
                player.power = grantedPower;
                if (tier > player.tier) player.tier = tier;
                _syncRewardDebt(player);
                emit TierUpgraded(account, player.tier, player.power, 0);
            }
        }
    }

    function releaseFromJail(address inmate) external {
        if (msg.sender != gangSystem) revert AccessDenied();
        if (block.timestamp >= jailedUntil[inmate]) revert InvalidAction();
        _updatePlayer(inmate);
        jailedUntil[inmate] = block.timestamp;
    }

    function join(address referrer) external payable nonReentrant whenNotPaused {
        ATMGameTypes.Player storage player = players[msg.sender];
        if (player.joined) revert AlreadyJoined();

        uint256 requiredEth = oracle.quoteEthForUsd(JOIN_USD_E18);
        _updateGlobal();

        uint256 referralPoolAllocation;
        if (referrer != address(0)) {
            if (referrer == msg.sender || !players[referrer].joined) revert InvalidReferrer();
            players[referrer].directReferrals++;
            referralPoolAllocation =
                oracle.quoteGangsterForUsd((JOIN_USD_E18 * 250) / BPS);
            referralEntryPoolAllocatedGangster += referralPoolAllocation;
        }

        player.joined = true;
        player.power = 1;
        gangsterSlots[msg.sender] = 1;
        heatStartedAt[msg.sender] = block.timestamp;
        playerRewardUpdatedAt[msg.sender] = block.timestamp;
        totalPower += 1;
        _syncRewardDebt(player);

        _takeEthPayment(requiredEth);
        emit Joined(msg.sender, referrer, requiredEth, referralPoolAllocation);
    }

    function hasActiveAccess(address account) public view returns (bool) {
        return _hasLiveAccess(account);
    }

    function requiredGangsterHold() external view returns (uint256) {
        return oracle.quoteGangsterForUsd(ACCESS_HOLD_USD_E18);
    }

    function requiredJoinEth() external view returns (uint256) {
        return oracle.quoteEthForUsd(JOIN_USD_E18);
    }

    function snitchCost() public view returns (uint256) {
        return oracle.quoteGangsterForUsd(SNITCH_USD_E18);
    }

    function jailItemCost(uint8 item) public view returns (uint256) {
        if (item != 0) revert InvalidAction();
        return oracle.quoteGangsterForUsd(JAIL_PHONE_USD_E18);
    }


    function earningMultiplierBps(address account) public view returns (uint16) {
        if (block.timestamp < layLowUntil[account] || block.timestamp < jailedUntil[account]) return 0;
        return gameMath.earningMultiplierBps(currentHeat(account));
    }

    function currentHeat(address account) public view returns (uint8) {
        return gameMath.currentHeat(
            heatStartedAt[account], layLowUntil[account], block.timestamp
        );
    }

    function layLow() external whenNotPaused onlyActiveMember {
        if (block.timestamp < layLowUntil[msg.sender]) revert CooldownActive(layLowUntil[msg.sender]);
        _updatePlayer(msg.sender);
        uint256 heat = currentHeat(msg.sender);
        if (heat == 0) revert InvalidAction();
        uint256 readyAt = block.timestamp + heat * 1 minutes;
        layLowUntil[msg.sender] = readyAt;
        heatStartedAt[msg.sender] = readyAt;
        emit LaidLow(msg.sender, readyAt);
    }

    function setUsername(string calldata username) external onlyActiveMember {
        if (!gameMath.isValidUsername(username)) revert InvalidUsername();
        bytes32 usernameHash = keccak256(bytes(username));
        address currentOwner = usernameOwner[usernameHash];
        if (currentOwner != address(0) && currentOwner != msg.sender) revert UsernameTaken();
        bytes memory oldUsername = bytes(usernames[msg.sender]);
        if (oldUsername.length != 0) delete usernameOwner[keccak256(oldUsername)];
        usernames[msg.sender] = username;
        usernameOwner[usernameHash] = msg.sender;
        emit UsernameSet(msg.sender, username);
    }

    function resolveReferralCode(string calldata username) external view returns (address) {
        return usernameOwner[keccak256(bytes(username))];
    }

    function quoteTierUpgrade(address account, uint8 targetTier) public view returns (uint256) {
        ATMGameTypes.Player storage player = players[account];
        if (!player.joined || targetTier <= player.tier || targetTier > 4) revert InvalidTier();
        return oracle.quoteEthForUsd(
            gameMath.tierCostUsd(targetTier) - gameMath.tierCostUsd(player.tier)
        );
    }

    function upgradeTier(uint8 targetTier, uint256 maxEthAmount)
        external
        payable
        nonReentrant
        whenNotPaused
        onlyActiveMember
    {
        _updatePlayer(msg.sender);
        ATMGameTypes.Player storage player = players[msg.sender];
        uint256 amount = quoteTierUpgrade(msg.sender, targetTier);
        if (amount > maxEthAmount) revert SlippageExceeded(amount, maxEthAmount);
        _takeEthPayment(amount);

        bool firstPaidGangster = !paidGangster[msg.sender];
        paidGangster[msg.sender] = true;
        if (firstPaidGangster) {
            activePurchasedGangsters += 1;
            emit ActivePurchasedGangstersUpdated(
                activePurchasedGangsters,
                dailyBaseFarmUsd()
            );
        }
        if (
            firstPaidGangster
                && codeGrantedGangster[msg.sender]
                && !codeBonusSlotGranted[msg.sender]
        ) {
            gangsterSlots[msg.sender] += 1;
            codeBonusSlotGranted[msg.sender] = true;
            emit CodeBonusSlotUnlocked(msg.sender, gangsterSlots[msg.sender]);
        }
        totalPower = totalPower - player.power + gameMath.tierPower(targetTier);
        player.tier = targetTier;
        player.power = gameMath.tierPower(targetTier);
        _syncRewardDebt(player);
        emit TierUpgraded(msg.sender, targetTier, player.power, amount);
    }

    function fundRewards(uint256 amount, uint256 duration) external onlyOwner nonReentrant {
        uint256 requiredAmount = oracle.quoteGangsterForUsd(dailyBaseFarmUsd());
        if (duration != 1 days || amount != requiredAmount) {
            revert InvalidDuration();
        }
        _updateGlobal();
        GANGSTER.safeTransferFrom(msg.sender, address(this), amount);

        uint256 remaining;
        if (block.timestamp < rewardPeriodFinish) {
            remaining = (rewardPeriodFinish - block.timestamp) * rewardRate;
        }
        rewardRate = (amount + remaining) / duration;
        if (rewardRate == 0) revert InvalidDuration();
        lastRewardTime = block.timestamp;
        rewardPeriodFinish = block.timestamp + duration;
        emit RewardsFunded(amount, duration, rewardRate);
    }

    function fundBonusPool(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAction();
        GANGSTER.safeTransferFrom(msg.sender, address(this), amount);
        bonusPool += amount;
        emit BonusPoolFunded(amount);
    }

    function recordGangsterSpend(address payer, uint256 amount, uint256 farmContribution) external {
        if (
            msg.sender != gangSystem || farmContribution == 0
                || farmContribution != (amount * SPEND_TO_FARM_BPS) / BPS
        ) revert AccessDenied();
        _notifySpendingRewards(farmContribution);
        emit GangsterSpendRouted(msg.sender, payer, amount, farmContribution);
    }

    function pendingRewards(address account) external view returns (uint256) {
        ATMGameTypes.Player storage player = players[account];
        if (!_hasLiveAccess(account)) return player.unclaimed;
        uint256 currentAccumulator = accRewardPerPower;
        uint256 applicableTime = block.timestamp < rewardPeriodFinish ? block.timestamp : rewardPeriodFinish;
        if (applicableTime > lastRewardTime && totalPower != 0) {
            currentAccumulator +=
                ((applicableTime - lastRewardTime) * rewardRate * ACC_REWARD_PRECISION) / totalPower;
        }
        uint256 pending =
            ((uint256(player.power) * currentAccumulator) / ACC_REWARD_PRECISION) - player.rewardDebt;
        return player.unclaimed + (pending * earningMultiplierBps(account)) / BPS;
    }

    /// @notice Permissionless reward checkpoint used by keepers when live hold access changes.
    function checkpointRewards(address account) external {
        _updatePlayer(account);
    }

    function withdrawalQuote(address account)
        public
        view
        returns (uint256 grossLimit, uint256 averageHeld24h, uint256 nextWithdrawalAt)
    {
        uint64 periodEnd;
        uint64 updatedAt;
        (averageHeld24h,, periodEnd, updatedAt) = holdingOracle.observations(account);
        nextWithdrawalAt = lastWithdrawalAt[account] + WITHDRAWAL_COOLDOWN;
        if (codeGrantedGangster[account] && !paidGangster[account]) {
            return (0, averageHeld24h, nextWithdrawalAt);
        }
        if (
            updatedAt == 0 || periodEnd > block.timestamp
                || block.timestamp - updatedAt > HOLDING_OBSERVATION_MAX_AGE
        ) return (0, averageHeld24h, nextWithdrawalAt);

        uint256 balanceLimit = (claimedBalance[account] * WITHDRAWAL_BPS) / BPS;
        uint256 holdingLimit = (averageHeld24h * WITHDRAWAL_BPS) / BPS;
        grossLimit = balanceLimit < holdingLimit ? balanceLimit : holdingLimit;
    }

    function claimQuote(address account)
        public
        view
        returns (
            uint256 gross,
            uint256 burned,
            uint256 atmFee,
            uint256 bonus,
            uint16 feeBps,
            uint16 bonusBps,
            uint256 nextClaimAt
        )
    {
        gross = this.pendingRewards(account);
        if (block.timestamp < robberyLootUnlockAt[account]) {
            uint256 locked = lockedRobberyLoot[account];
            gross = locked < gross ? gross - locked : 0;
        }
        nextClaimAt = lastClaimAt[account] + CLAIM_COOLDOWN;
        (feeBps, bonusBps) = claimRates(account);
        burned = (gross * CLAIM_BURN_BPS) / BPS;
        atmFee = (gross * feeBps) / BPS;
        uint256 requestedBonus = (gross * bonusBps) / BPS;
        uint256 reservedGeneral = reservedBonusPool - _reservedAtmPoolTotal();
        uint256 committed = reservedGeneral + totalAtmClaimPool;
        uint256 availableBonus = bonusPool > committed ? bonusPool - committed : 0;
        bonus = requestedBonus < availableBonus ? requestedBonus : availableBonus;
    }

    function claimRates(address account) public view returns (uint16 feeBps, uint16 bonusBps) {
        return gameMath.claimRates(unclaimedSince[account], block.timestamp);
    }

    function claim() external nonReentrant whenNotPaused onlyActiveMember {
        _updatePlayer(msg.sender);
        uint256 availableAt = lastClaimAt[msg.sender] + CLAIM_COOLDOWN;
        if (lastClaimAt[msg.sender] != 0 && availableAt > block.timestamp) {
            revert CooldownActive(availableAt);
        }
        (
            uint256 gross,
            uint256 burned,
            uint256 atmFee,
            uint256 bonus,
            uint16 feeBps,
            uint16 bonusBps,
        ) = claimQuote(msg.sender);
        if (gross == 0) revert InsufficientUnclaimed();

        _subtractUnclaimed(msg.sender, gross);
        lastClaimAt[msg.sender] = block.timestamp;
        uint256 received = gross - burned - atmFee + bonus;
        claimedBalance[msg.sender] += received;
        if (bonus != 0) bonusPool -= bonus;
        if (atmFee != 0) _allocateClaimFee(atmFee);
        if (burned != 0) GANGSTER.safeTransfer(BURN_ADDRESS, burned);
        emit Claimed(msg.sender, gross, burned, atmFee, bonus, received, feeBps, bonusBps);
    }

    function withdraw() external nonReentrant whenNotPaused onlyActiveMember {
        if (codeGrantedGangster[msg.sender] && !paidGangster[msg.sender]) {
            revert PaidGangsterRequired();
        }
        uint256 availableAt = lastWithdrawalAt[msg.sender] + WITHDRAWAL_COOLDOWN;
        if (lastWithdrawalAt[msg.sender] != 0 && availableAt > block.timestamp) {
            revert CooldownActive(availableAt);
        }
        (uint256 gross, uint256 averageHeld24h,) = withdrawalQuote(msg.sender);
        if (averageHeld24h == 0 || gross == 0) revert HoldingObservationUnavailable();
        claimedBalance[msg.sender] -= gross;
        lastWithdrawalAt[msg.sender] = block.timestamp;
        GANGSTER.safeTransfer(msg.sender, gross);
        emit Withdrawn(msg.sender, gross, block.timestamp + WITHDRAWAL_COOLDOWN);
    }

    function atmWinChance(address account, uint8 atmIndex) external view returns (uint32) {
        if (atmIndex >= 4) revert InvalidAction();
        return atmWinChanceForPower(players[account].power, atmIndex);
    }

    function atmWinChanceForPower(uint32 power, uint8 atmIndex) public view returns (uint32) {
        if (atmIndex >= 4) revert InvalidAction();
        ATMGameTypes.ATMConfig memory config = atms[atmIndex];
        return gameMath.atmWinChance(
            power, atmIndex, config.civilianChanceE8, config.maximumChanceE8
        );
    }

    function commitPlayerRobbery(address target, bytes32 commitment)
        external
        whenNotPaused
        onlyActiveMember
        returns (bytes32 requestId)
    {
        if (target == msg.sender || !hasActiveAccess(target) || commitment == bytes32(0)) {
            revert InvalidAction();
        }
        if (block.timestamp < layLowUntil[target]) revert InvalidAction();
        if (pendingActions[msg.sender].kind != ATMGameTypes.ActionKind.None) revert PendingActionExists();
        uint256 availableAt = playerAttackAvailableAt[msg.sender][target];
        if (availableAt > block.timestamp) revert CooldownActive(availableAt);

        _updatePlayer(msg.sender);
        _updatePlayer(target);
        if (players[msg.sender].unclaimed == 0 || players[target].unclaimed == 0) {
            revert InsufficientUnclaimed();
        }

        requestId = _storePendingAction(
            ATMGameTypes.ActionKind.PlayerRobbery,
            target,
            commitment,
            0,
            (players[msg.sender].unclaimed * 2_500) / BPS,
            0,
            0
        );
        playerAttackAvailableAt[msg.sender][target] = block.timestamp + ACTION_COOLDOWN;
    }

    function commitATMHit(uint8 atmIndex, bytes32 commitment)
        external
        whenNotPaused
        onlyActiveMember
        returns (bytes32 requestId)
    {
        if (atmIndex >= 4 || commitment == bytes32(0)) revert InvalidAction();
        if (pendingActions[msg.sender].kind != ATMGameTypes.ActionKind.None) revert PendingActionExists();
        uint256 availableAt = atmAvailableAt[msg.sender][atmIndex];
        if (availableAt > block.timestamp) revert CooldownActive(availableAt);

        _updatePlayer(msg.sender);
        ATMGameTypes.ATMConfig memory config = atms[atmIndex];
        uint256 lossAmount = oracle.quoteGangsterForUsd(config.lossUsdE18);
        uint256 rewardAmount = oracle.quoteGangsterForUsd(config.rewardUsdE18);
        if (players[msg.sender].unclaimed < lossAmount) revert InsufficientUnclaimed();
        uint256 reservedFromAtmPool = _reserveAtmReward(atmIndex, rewardAmount);
        requestId = _storePendingAction(
            ATMGameTypes.ActionKind.ATMHit,
            address(0),
            commitment,
            atmIndex,
            lossAmount,
            rewardAmount,
            reservedFromAtmPool
        );
        atmAvailableAt[msg.sender][atmIndex] = block.timestamp + ACTION_COOLDOWN;
    }

    function commitSnitch(bytes32 commitment, uint256 maxGangsterAmount)
        external
        nonReentrant
        whenNotPaused
        onlyActiveMember
        returns (bytes32 requestId)
    {
        address target = snitchTarget[msg.sender];
        if (
            target == address(0) || snitchAvailableUntil[msg.sender] < block.timestamp
                || commitment == bytes32(0)
        ) revert InvalidAction();
        if (pendingActions[msg.sender].kind != ATMGameTypes.ActionKind.None) revert PendingActionExists();

        uint256 cost = snitchCost();
        if (cost > maxGangsterAmount) revert SlippageExceeded(cost, maxGangsterAmount);
        _collectGangsterSpend(msg.sender, cost);
        delete snitchTarget[msg.sender];
        delete snitchAvailableUntil[msg.sender];

        requestId =
            _storePendingAction(ATMGameTypes.ActionKind.Snitch, target, commitment, 0, cost, 0, 0);
    }

    function commitJailPurchase(uint8 item, bytes32 commitment, uint256 maxGangsterAmount)
        external
        nonReentrant
        whenNotPaused
        onlyActiveMember
        returns (bytes32 requestId)
    {
        if (block.timestamp >= jailedUntil[msg.sender] || item != 0 || commitment == bytes32(0)) {
            revert InvalidAction();
        }
        if (pendingActions[msg.sender].kind != ATMGameTypes.ActionKind.None) revert PendingActionExists();
        uint256 cost = jailItemCost(item);
        if (cost > maxGangsterAmount) revert SlippageExceeded(cost, maxGangsterAmount);
        _collectGangsterSpend(msg.sender, cost);

        requestId = _storePendingAction(
            ATMGameTypes.ActionKind.JailShop, address(0), commitment, item, cost, 0, 0
        );
    }

    function commitPhoneHit(bytes32 commitment)
        external
        whenNotPaused
        onlyActiveMember
        returns (bytes32 requestId)
    {
        address target = jailHitTarget[msg.sender];
        if (
            block.timestamp >= jailedUntil[msg.sender] || jailPhones[msg.sender] == 0
                || target == address(0) || commitment == bytes32(0)
        ) revert InvalidAction();
        if (pendingActions[msg.sender].kind != ATMGameTypes.ActionKind.None) revert PendingActionExists();
        jailPhones[msg.sender]--;

        requestId = _storePendingAction(
            ATMGameTypes.ActionKind.PhoneHit,
            target,
            commitment,
            0,
            jailLostLoot[msg.sender],
            jailIncidentAt[msg.sender],
            0
        );
    }

    function revealAction(
        bytes32 secret,
        uint256 randomWord,
        uint64 deadline,
        bytes calldata resolverSignature
    ) external nonReentrant whenNotPaused onlyActiveMember {
        ATMGameTypes.PendingAction memory action = pendingActions[msg.sender];
        if (action.kind == ATMGameTypes.ActionKind.None) revert NoPendingAction();
        if (block.timestamp < uint256(action.committedAt) + MIN_REVEAL_DELAY) revert RevealTooEarly();
        if (block.timestamp > action.expiresAt) revert RevealExpired();
        if (deadline < block.timestamp || deadline > action.expiresAt) {
            revert ResolverDeadlineInvalid();
        }

        bytes32 expected =
            keccak256(abi.encodePacked(msg.sender, action.target, action.atmIndex, secret, action.nonce));
        if (expected != action.commitment) revert InvalidReveal();

        bytes32 requestId =
            keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, action.nonce));
        randomWord = randomnessResolver.consume(
            requestId,
            action.commitment,
            randomWord,
            deadline,
            action.resolver,
            resolverSignature
        );
        bytes32 entropy = keccak256(abi.encodePacked(secret, randomWord, requestId));
        delete pendingActions[msg.sender];

        if (action.kind == ATMGameTypes.ActionKind.PlayerRobbery) {
            _updatePlayer(msg.sender);
            _updatePlayer(action.target);
            bonusPool = ATMGameCombat.settlePlayerRobbery(
                players,
                snitchTarget,
                snitchAvailableUntil,
                snitchLoot,
                lockedRobberyLoot,
                robberyLootUnlockAt,
                unclaimedSince,
                reservedAtmClaimPools,
                gameMath,
                requestId,
                msg.sender,
                action.target,
                uint256(entropy),
                bonusPool,
                reservedBonusPool,
                totalAtmClaimPool
            );
        } else if (action.kind == ATMGameTypes.ActionKind.ATMHit) {
            _updatePlayer(msg.sender);
            (bonusPool, reservedBonusPool, totalAtmClaimPool) = ATMGameCombat.settleATMHit(
                players,
                unclaimedSince,
                atmClaimPools,
                reservedAtmClaimPools,
                gameMath,
                atms[action.atmIndex],
                requestId,
                msg.sender,
                action,
                uint256(entropy),
                bonusPool,
                reservedBonusPool,
                totalAtmClaimPool,
                GANGSTER,
                BURN_ADDRESS
            );
        } else if (action.kind == ATMGameTypes.ActionKind.Snitch) {
            _updatePlayer(action.target);
            ATMGameCombat.settleSnitch(
                jailedUntil,
                jailHitTarget,
                jailLostLoot,
                jailIncidentAt,
                snitchLoot,
                msg.sender,
                action.target,
                action.forfeiture,
                uint256(entropy)
            );
        } else if (action.kind == ATMGameTypes.ActionKind.JailShop) {
            ATMGameCombat.settleJailPurchase(
                jailedUntil, jailPhones, msg.sender, action.atmIndex, action.forfeiture, uint256(entropy)
            );
        } else {
            _updatePlayer(action.target);
            ATMGameCombat.settlePhoneHit(
                players,
                unclaimedSince,
                jailHitTarget,
                jailLostLoot,
                jailIncidentAt,
                msg.sender,
                action,
                uint256(entropy)
            );
        }
    }

    function forfeitExpiredAction(address attacker) external nonReentrant {
        ATMGameTypes.PendingAction memory action = pendingActions[attacker];
        if (action.kind == ATMGameTypes.ActionKind.None) revert NoPendingAction();
        if (block.timestamp <= action.expiresAt) revert RevealTooEarly();

        _updatePlayer(attacker);
        if (
            action.kind == ATMGameTypes.ActionKind.PlayerRobbery && action.target != address(0)
        ) {
            _updatePlayer(action.target);
        }

        (
            ,
            uint256 reservedRewardRefund,
            uint8 atmIndex,
            uint256 reservedAtmPoolRefund,
            ATMGameTypes.ActionKind kind,
        ) = ATMGameCombat.forfeitExpired(
            pendingActions, players, unclaimedSince, attacker, GANGSTER, BURN_ADDRESS
        );

        if (kind == ATMGameTypes.ActionKind.ATMHit) {
            reservedBonusPool -= reservedRewardRefund;
            reservedAtmClaimPools[atmIndex] -= reservedAtmPoolRefund;
        }
    }

    function _storePendingAction(
        ATMGameTypes.ActionKind kind,
        address target,
        bytes32 commitment,
        uint8 atmIndex,
        uint256 forfeiture,
        uint256 reservedReward,
        uint256 reservedAtmPool
    ) internal returns (bytes32 requestId) {
        uint64 nonce = ++actionNonces[msg.sender];
        requestId = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, nonce));
        pendingActions[msg.sender] = ATMGameTypes.PendingAction({
            kind: kind,
            target: target,
            commitment: commitment,
            resolver: randomnessResolver.resolver(),
            committedAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp + ACTION_TIMEOUT),
            nonce: nonce,
            atmIndex: atmIndex,
            forfeiture: forfeiture,
            reservedReward: reservedReward,
            reservedAtmPool: reservedAtmPool
        });
        emit ActionCommitted(requestId, msg.sender, kind, target, atmIndex, nonce);
    }

    function _takeEthPayment(uint256 amount) internal {
        if (msg.value < amount) revert InsufficientPayment(amount, msg.value);
        (bool sent,) = TREASURY.call{value: amount}("");
        if (!sent) revert TransferFailed();
        unchecked {
            uint256 refund = msg.value - amount;
            if (refund != 0) {
                (bool refunded,) = payable(msg.sender).call{value: refund}("");
                if (!refunded) revert TransferFailed();
            }
        }
    }

    function _updateGlobal() internal {
        uint256 applicableTime = block.timestamp < rewardPeriodFinish ? block.timestamp : rewardPeriodFinish;
        if (applicableTime <= lastRewardTime) return;
        if (totalPower != 0) {
            accRewardPerPower +=
                ((applicableTime - lastRewardTime) * rewardRate * ACC_REWARD_PRECISION) / totalPower;
        }
        lastRewardTime = applicableTime;
    }

    function _updatePlayer(address account) internal {
        uint256 accrualStartedAt = playerRewardUpdatedAt[account];
        _updateGlobal();
        ATMGameTypes.Player storage player = players[account];
        if (player.power != 0) {
            uint256 accumulated = (uint256(player.power) * accRewardPerPower) / ACC_REWARD_PRECISION;
            uint256 newlyEarned;
            if (_hasLiveAccess(account)) {
                newlyEarned =
                    ((accumulated - player.rewardDebt) * earningMultiplierBps(account)) / BPS;
            }
            if (newlyEarned != 0) {
                if (player.unclaimed == 0) {
                    unclaimedSince[account] =
                        accrualStartedAt == 0 ? block.timestamp : accrualStartedAt;
                }
                player.unclaimed += newlyEarned;
            }
            player.lifetimeEarned += newlyEarned;
            player.rewardDebt = accumulated;
        }
        playerRewardUpdatedAt[account] = block.timestamp;
    }

    function _hasLiveAccess(address account) internal view returns (bool) {
        if (!players[account].joined) return false;
        try oracle.quoteGangsterForUsd(ACCESS_HOLD_USD_E18) returns (uint256 requiredBalance) {
            try GANGSTER.balanceOf(account) returns (uint256 balance) {
                return balance >= requiredBalance;
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }

    function _syncRewardDebt(ATMGameTypes.Player storage player) internal {
        player.rewardDebt = (uint256(player.power) * accRewardPerPower) / ACC_REWARD_PRECISION;
    }

    function _addUnclaimed(address account, uint256 amount) internal {
        if (amount == 0) return;
        ATMGameTypes.Player storage player = players[account];
        if (player.unclaimed == 0) unclaimedSince[account] = block.timestamp;
        player.unclaimed += amount;
    }

    function _subtractUnclaimed(address account, uint256 amount) internal {
        if (amount == 0) return;
        ATMGameTypes.Player storage player = players[account];
        player.unclaimed -= amount;
        if (player.unclaimed == 0) unclaimedSince[account] = 0;
    }

    function _allocateClaimFee(uint256 amount) internal {
        (uint256 cornerStore, uint256 nightclub, uint256 casinoFloor, uint256 downtownVault) =
            gameMath.claimFeeSplits(amount);
        atmClaimPools[0] += cornerStore;
        atmClaimPools[1] += nightclub;
        atmClaimPools[2] += casinoFloor;
        atmClaimPools[3] += downtownVault;
        totalAtmClaimPool += amount;
        bonusPool += amount;
    }

    function _collectGangsterSpend(address payer, uint256 amount) internal {
        uint256 farmContribution = (amount * SPEND_TO_FARM_BPS) / BPS;
        uint256 treasuryAmount = amount - farmContribution;
        if (treasuryAmount != 0) {
            GANGSTER.safeTransferFrom(payer, TREASURY, treasuryAmount);
        }
        if (farmContribution != 0) {
            GANGSTER.safeTransferFrom(payer, address(this), farmContribution);
            _notifySpendingRewards(farmContribution);
        }
        emit GangsterSpendRouted(address(this), payer, amount, farmContribution);
    }

    function _notifySpendingRewards(uint256 amount) internal {
        _updateGlobal();
        uint256 duration;
        uint256 remaining;
        if (block.timestamp < rewardPeriodFinish) {
            duration = rewardPeriodFinish - block.timestamp;
            remaining = duration * rewardRate;
        } else {
            duration = 1 days;
        }
        rewardRate = (remaining + amount) / duration;
        lastRewardTime = block.timestamp;
        rewardPeriodFinish = block.timestamp + duration;
        spendingFarmPoolContributed += amount;
    }

    function _reserveAtmReward(uint8 atmIndex, uint256 rewardAmount)
        internal
        returns (uint256 reservedFromAtmPool)
    {
        uint256 committedGeneral =
            reservedBonusPool - _reservedAtmPoolTotal() + totalAtmClaimPool;
        uint256 availableGeneral = bonusPool > committedGeneral
            ? bonusPool - committedGeneral
            : 0;
        uint256 availableTierPool =
            atmClaimPools[atmIndex] - reservedAtmClaimPools[atmIndex];
        if (availableGeneral + availableTierPool < rewardAmount) {
            revert InsufficientBonusPool();
        }
        reservedFromAtmPool = rewardAmount < availableTierPool
            ? rewardAmount
            : availableTierPool;
        reservedBonusPool += rewardAmount;
        reservedAtmClaimPools[atmIndex] += reservedFromAtmPool;
    }

    function _reservedAtmPoolTotal() internal view returns (uint256) {
        return reservedAtmClaimPools[0] + reservedAtmClaimPools[1]
            + reservedAtmClaimPools[2] + reservedAtmClaimPools[3];
    }
}
