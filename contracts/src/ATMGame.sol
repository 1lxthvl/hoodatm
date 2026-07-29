// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {GangsterPriceOracle} from "./GangsterPriceOracle.sol";
import {GangsterHoldingOracle} from "./GangsterHoldingOracle.sol";

/// @notice Production game accounting for hoodATM on Robinhood Chain.
/// @dev Chance-based actions use a two-transaction future-block commit/reveal flow.
contract ATMGame is Ownable2Step, ReentrancyGuard {
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

    IERC20 public constant GANGSTER = IERC20(0x6AE32f2620A4a2B55f4Fc4b9e3152c371Aa58EF0);
    address payable public constant TREASURY = payable(0x7657d90609046F47215Fc0Fb2BF012c88FF9f700);
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    uint256 public constant JOIN_USD_E18 = 5 ether;
    uint256 public constant ACCESS_HOLD_USD_E18 = 10 ether;
    uint256 public constant CLAIM_BURN_BPS = 1_000;
    uint256 public constant MAX_CLAIM_FEE_BPS = 2_000;
    uint256 public constant MAX_CLAIM_BONUS_BPS = 2_000;
    uint256 public constant CLAIM_STEP_BPS = 200;
    uint256 public constant CLAIM_COOLDOWN = 1 hours;
    uint256 public constant CLAIM_FEE_END_HOUR = 10;
    uint256 public constant CLAIM_BONUS_CAP_HOUR = 20;
    uint256 public constant BPS = 10_000;
    uint256 public constant ACC_REWARD_PRECISION = 1e24;
    uint256 public constant ACTION_COOLDOWN = 6 hours;
    uint256 public constant WITHDRAWAL_COOLDOWN = 12 hours;
    uint256 public constant WITHDRAWAL_BPS = 5_000;
    uint256 public constant HOLDING_OBSERVATION_MAX_AGE = 1 hours;
    uint256 public constant CHANCE_PRECISION = 100_000_000;
    uint256 public constant JAIL_DURATION = 3 hours;
    uint256 public constant SNITCH_WINDOW = 24 hours;
    uint256 public constant SNITCH_CHANCE_BPS = 500;
    uint256 public constant SNITCH_USD_E18 = 1 ether;
    uint256 public constant JAIL_PHONE_USD_E18 = 2 ether;
    uint256 public constant MIN_REVEAL_BLOCKS = 2;
    uint256 public constant MAX_REVEAL_BLOCKS = 200;

    GangsterPriceOracle public immutable oracle;
    GangsterHoldingOracle public immutable holdingOracle;
    bool public paused = true;
    address public gangSystem;

    struct Player {
        bool joined;
        uint8 tier;
        uint32 power;
        uint32 directReferrals;
        uint256 unclaimed;
        uint256 rewardDebt;
        uint256 lifetimeEarned;
    }

    enum ActionKind {
        None,
        PlayerRobbery,
        ATMHit,
        Snitch,
        JailShop,
        PhoneHit
    }

    struct PendingAction {
        ActionKind kind;
        address target;
        bytes32 commitment;
        uint64 commitBlock;
        uint64 nonce;
        uint8 atmIndex;
        uint256 forfeiture;
        uint256 reservedReward;
        uint256 reservedAtmPool;
    }

    struct ATMConfig {
        uint32 civilianChanceE8;
        uint32 maximumChanceE8;
        uint256 rewardUsdE18;
        uint256 lossUsdE18;
    }

    mapping(address => Player) public players;
    mapping(address => PendingAction) public pendingActions;
    mapping(address => uint64) public actionNonces;
    mapping(address => mapping(address => uint256)) public playerAttackAvailableAt;
    mapping(address => mapping(uint8 => uint256)) public atmAvailableAt;
    mapping(address => uint256) public lastWithdrawalAt;
    mapping(address => uint256) public claimedBalance;
    mapping(address => uint256) public lastClaimAt;
    mapping(address => uint256) public unclaimedSince;
    mapping(address => uint256) public playerRewardUpdatedAt;
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
    ATMConfig[4] public atms;
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
    uint256 public referralEntryPoolAllocatedEth;

    event PauseUpdated(bool paused);
    event Joined(
        address indexed player,
        address indexed referrer,
        uint256 ethPaid,
        uint256 referralPoolAllocation
    );
    event TierUpgraded(address indexed player, uint8 indexed tier, uint32 power, uint256 gangsterPaid);
    event RewardsFunded(uint256 amount, uint256 duration, uint256 rewardRate);
    event BonusPoolFunded(uint256 amount);
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
    event SnitchSettled(address indexed informant, address indexed target, bool jailed, uint256 cost);
    event JailPurchaseSettled(
        address indexed inmate,
        uint8 indexed item,
        uint8 outcome,
        uint256 cost,
        uint256 jailEndsAt
    );
    event PhoneHitSettled(
        address indexed inmate,
        address indexed target,
        bool won,
        uint256 recovered,
        uint16 recoveryBps
    );
    event ActionCommitted(
        bytes32 indexed requestId,
        address indexed attacker,
        ActionKind indexed kind,
        address target,
        uint8 atmIndex,
        uint64 nonce
    );
    event PlayerRobberySettled(
        bytes32 indexed requestId,
        address indexed attacker,
        address indexed target,
        bool won,
        uint256 amount,
        uint256 referralBonus,
        uint16 chanceBps
    );
    event ATMHitSettled(
        bytes32 indexed requestId,
        address indexed attacker,
        uint8 indexed atmIndex,
        bool won,
        uint256 amount,
        uint32 chanceE8
    );
    event ActionForfeited(bytes32 indexed requestId, address indexed attacker, uint256 penalty);

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier onlyActiveMember() {
        if (!hasActiveAccess(msg.sender)) revert AccessDenied();
        _;
    }

    constructor(GangsterPriceOracle oracle_, GangsterHoldingOracle holdingOracle_) Ownable(TREASURY) {
        if (
            address(oracle_) == address(0) || oracle_.gangster() != address(GANGSTER)
                || address(holdingOracle_) == address(0)
                || holdingOracle_.gangster() != address(GANGSTER)
        ) {
            revert InvalidAction();
        }
        oracle = oracle_;
        holdingOracle = holdingOracle_;
        lastRewardTime = block.timestamp;

        // Civilian chances scale by tier power and can never exceed the original base chance.
        atms[0] = ATMConfig({civilianChanceE8: 700_000, maximumChanceE8: 70_000_000, rewardUsdE18: 0.004 ether, lossUsdE18: 0.001 ether});
        atms[1] = ATMConfig({civilianChanceE8: 50_000, maximumChanceE8: 50_000_000, rewardUsdE18: 0.01 ether, lossUsdE18: 0.003 ether});
        atms[2] = ATMConfig({civilianChanceE8: 10_500, maximumChanceE8: 30_000_000, rewardUsdE18: 0.025 ether, lossUsdE18: 0.007 ether});
        atms[3] = ATMConfig({civilianChanceE8: 1_500, maximumChanceE8: 15_000_000, rewardUsdE18: 0.075 ether, lossUsdE18: 0.02 ether});
    }

    receive() external payable {
        revert InvalidAction();
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PauseUpdated(paused_);
    }

    function setGangSystem(address gangSystem_) external onlyOwner {
        if (gangSystem_ == address(0)) revert InvalidAction();
        gangSystem = gangSystem_;
    }

    function releaseFromJail(address inmate) external {
        if (msg.sender != gangSystem) revert AccessDenied();
        if (block.timestamp >= jailedUntil[inmate]) revert InvalidAction();
        _updatePlayer(inmate);
        jailedUntil[inmate] = block.timestamp;
    }

    function join(address referrer) external payable nonReentrant whenNotPaused {
        Player storage player = players[msg.sender];
        if (player.joined) revert AlreadyJoined();

        uint256 requiredEth = oracle.quoteEthForUsd(JOIN_USD_E18);
        if (msg.value < requiredEth) revert InsufficientPayment(requiredEth, msg.value);
        _updateGlobal();

        uint256 referralPoolAllocation;
        if (referrer != address(0)) {
            if (referrer == msg.sender || !players[referrer].joined) revert InvalidReferrer();
            players[referrer].directReferrals++;
            referralPoolAllocation = (requiredEth * 250) / BPS;
            referralEntryPoolAllocatedEth += referralPoolAllocation;
        }

        player.joined = true;
        player.power = 1;
        heatStartedAt[msg.sender] = block.timestamp;
        playerRewardUpdatedAt[msg.sender] = block.timestamp;
        totalPower += 1;
        _syncRewardDebt(player);

        (bool sent,) = TREASURY.call{value: requiredEth}("");
        if (!sent) revert TransferFailed();
        uint256 refund = msg.value - requiredEth;
        if (refund != 0) {
            (bool refunded,) = payable(msg.sender).call{value: refund}("");
            if (!refunded) revert TransferFailed();
        }

        emit Joined(msg.sender, referrer, requiredEth, referralPoolAllocation);
    }

    function hasActiveAccess(address account) public view returns (bool) {
        if (!players[account].joined) return false;
        uint256 requiredBalance = oracle.quoteGangsterForUsd(ACCESS_HOLD_USD_E18);
        return GANGSTER.balanceOf(account) >= requiredBalance;
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
        uint256 heat = currentHeat(account);
        return uint16(10_000 - ((heat / 3) * 100));
    }

    function currentHeat(address account) public view returns (uint8) {
        uint256 startedAt = heatStartedAt[account];
        if (startedAt == 0) return 0;
        if (block.timestamp < layLowUntil[account]) {
            return uint8((layLowUntil[account] - block.timestamp + 59 seconds) / 1 minutes);
        }
        if (startedAt > block.timestamp) return 0;
        uint256 heat = (block.timestamp - startedAt) / 1 minutes;
        return uint8(heat < 100 ? heat : 100);
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
        bytes memory raw = bytes(username);
        if (raw.length < 3 || raw.length > 15) revert InvalidUsername();
        for (uint256 i; i < raw.length; ++i) {
            bytes1 character = raw[i];
            bool valid = (character >= 0x61 && character <= 0x7a)
                || (character >= 0x30 && character <= 0x39) || character == 0x5f;
            if (!valid) revert InvalidUsername();
        }

        bytes32 usernameHash = keccak256(raw);
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

    function tierCostUsd(uint8 tier) public pure returns (uint256) {
        if (tier == 0) return 0;
        if (tier == 1) return 2.5 ether;
        if (tier == 2) return 12.5 ether;
        if (tier == 3) return 50 ether;
        if (tier == 4) return 250 ether;
        revert InvalidTier();
    }

    function tierPower(uint8 tier) public pure returns (uint32) {
        if (tier == 0) return 1;
        if (tier == 1) return 5;
        if (tier == 2) return 30;
        if (tier == 3) return 135;
        if (tier == 4) return 750;
        revert InvalidTier();
    }

    function quoteTierUpgrade(address account, uint8 targetTier) public view returns (uint256) {
        Player storage player = players[account];
        if (!player.joined || targetTier <= player.tier || targetTier > 4) revert InvalidTier();
        return oracle.quoteGangsterForUsd(tierCostUsd(targetTier) - tierCostUsd(player.tier));
    }

    function upgradeTier(uint8 targetTier, uint256 maxGangsterAmount)
        external
        nonReentrant
        whenNotPaused
        onlyActiveMember
    {
        _updatePlayer(msg.sender);
        Player storage player = players[msg.sender];
        uint256 amount = quoteTierUpgrade(msg.sender, targetTier);
        if (amount > maxGangsterAmount) revert SlippageExceeded(amount, maxGangsterAmount);

        GANGSTER.safeTransferFrom(msg.sender, TREASURY, amount);
        totalPower = totalPower - player.power + tierPower(targetTier);
        player.tier = targetTier;
        player.power = tierPower(targetTier);
        _syncRewardDebt(player);
        emit TierUpgraded(msg.sender, targetTier, player.power, amount);
    }

    function fundRewards(uint256 amount, uint256 duration) external onlyOwner nonReentrant {
        if (amount == 0 || duration < 1 days || duration > 365 days) revert InvalidDuration();
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

    function pendingRewards(address account) external view returns (uint256) {
        Player storage player = players[account];
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

    function withdrawalQuote(address account)
        public
        view
        returns (uint256 grossLimit, uint256 averageHeld24h, uint256 nextWithdrawalAt)
    {
        uint64 periodEnd;
        uint64 updatedAt;
        (averageHeld24h,, periodEnd, updatedAt) = holdingOracle.observations(account);
        nextWithdrawalAt = lastWithdrawalAt[account] + WITHDRAWAL_COOLDOWN;
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
        uint256 startedAt = unclaimedSince[account];
        uint256 heldHours = startedAt == 0 || startedAt >= block.timestamp
            ? 0
            : (block.timestamp - startedAt) / 1 hours;
        if (heldHours < CLAIM_FEE_END_HOUR) {
            feeBps = uint16(MAX_CLAIM_FEE_BPS - heldHours * CLAIM_STEP_BPS);
        }
        if (heldHours > CLAIM_FEE_END_HOUR) {
            uint256 bonusHours = heldHours - CLAIM_FEE_END_HOUR;
            uint256 cappedHours = CLAIM_BONUS_CAP_HOUR - CLAIM_FEE_END_HOUR;
            if (bonusHours > cappedHours) bonusHours = cappedHours;
            bonusBps = uint16(bonusHours * CLAIM_STEP_BPS);
        }
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
        ATMConfig memory config = atms[atmIndex];
        uint256 scaled = uint256(config.civilianChanceE8) * power;
        return uint32(scaled < config.maximumChanceE8 ? scaled : config.maximumChanceE8);
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
        if (pendingActions[msg.sender].kind != ActionKind.None) revert PendingActionExists();
        uint256 availableAt = playerAttackAvailableAt[msg.sender][target];
        if (availableAt > block.timestamp) revert CooldownActive(availableAt);

        _updatePlayer(msg.sender);
        _updatePlayer(target);
        if (players[msg.sender].unclaimed == 0 || players[target].unclaimed == 0) {
            revert InsufficientUnclaimed();
        }

        uint64 nonce = ++actionNonces[msg.sender];
        requestId = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, nonce));
        pendingActions[msg.sender] = PendingAction({
            kind: ActionKind.PlayerRobbery,
            target: target,
            commitment: commitment,
            commitBlock: uint64(block.number),
            nonce: nonce,
            atmIndex: 0,
            forfeiture: (players[msg.sender].unclaimed * 2_500) / BPS,
            reservedReward: 0,
            reservedAtmPool: 0
        });
        playerAttackAvailableAt[msg.sender][target] = block.timestamp + ACTION_COOLDOWN;
        emit ActionCommitted(requestId, msg.sender, ActionKind.PlayerRobbery, target, 0, nonce);
    }

    function commitATMHit(uint8 atmIndex, bytes32 commitment)
        external
        whenNotPaused
        onlyActiveMember
        returns (bytes32 requestId)
    {
        if (atmIndex >= 4 || commitment == bytes32(0)) revert InvalidAction();
        if (pendingActions[msg.sender].kind != ActionKind.None) revert PendingActionExists();
        uint256 availableAt = atmAvailableAt[msg.sender][atmIndex];
        if (availableAt > block.timestamp) revert CooldownActive(availableAt);

        _updatePlayer(msg.sender);
        ATMConfig memory config = atms[atmIndex];
        uint256 lossAmount = oracle.quoteGangsterForUsd(config.lossUsdE18);
        uint256 rewardAmount = oracle.quoteGangsterForUsd(config.rewardUsdE18);
        if (players[msg.sender].unclaimed < lossAmount) revert InsufficientUnclaimed();
        uint256 reservedFromAtmPool = _reserveAtmReward(atmIndex, rewardAmount);
        uint64 nonce = ++actionNonces[msg.sender];
        requestId = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, nonce));
        pendingActions[msg.sender] = PendingAction({
            kind: ActionKind.ATMHit,
            target: address(0),
            commitment: commitment,
            commitBlock: uint64(block.number),
            nonce: nonce,
            atmIndex: atmIndex,
            forfeiture: lossAmount,
            reservedReward: rewardAmount,
            reservedAtmPool: reservedFromAtmPool
        });
        atmAvailableAt[msg.sender][atmIndex] = block.timestamp + ACTION_COOLDOWN;
        emit ActionCommitted(requestId, msg.sender, ActionKind.ATMHit, address(0), atmIndex, nonce);
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
        if (pendingActions[msg.sender].kind != ActionKind.None) revert PendingActionExists();

        uint256 cost = snitchCost();
        if (cost > maxGangsterAmount) revert SlippageExceeded(cost, maxGangsterAmount);
        GANGSTER.safeTransferFrom(msg.sender, TREASURY, cost);
        delete snitchTarget[msg.sender];
        delete snitchAvailableUntil[msg.sender];

        uint64 nonce = ++actionNonces[msg.sender];
        requestId = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, nonce));
        pendingActions[msg.sender] = PendingAction({
            kind: ActionKind.Snitch,
            target: target,
            commitment: commitment,
            commitBlock: uint64(block.number),
            nonce: nonce,
            atmIndex: 0,
            forfeiture: cost,
            reservedReward: 0,
            reservedAtmPool: 0
        });
        emit ActionCommitted(requestId, msg.sender, ActionKind.Snitch, target, 0, nonce);
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
        if (pendingActions[msg.sender].kind != ActionKind.None) revert PendingActionExists();
        uint256 cost = jailItemCost(item);
        if (cost > maxGangsterAmount) revert SlippageExceeded(cost, maxGangsterAmount);
        GANGSTER.safeTransferFrom(msg.sender, TREASURY, cost);

        uint64 nonce = ++actionNonces[msg.sender];
        requestId = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, nonce));
        pendingActions[msg.sender] = PendingAction({
            kind: ActionKind.JailShop,
            target: address(0),
            commitment: commitment,
            commitBlock: uint64(block.number),
            nonce: nonce,
            atmIndex: item,
            forfeiture: cost,
            reservedReward: 0,
            reservedAtmPool: 0
        });
        emit ActionCommitted(requestId, msg.sender, ActionKind.JailShop, address(0), item, nonce);
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
        if (pendingActions[msg.sender].kind != ActionKind.None) revert PendingActionExists();
        jailPhones[msg.sender]--;

        uint64 nonce = ++actionNonces[msg.sender];
        requestId = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, nonce));
        pendingActions[msg.sender] = PendingAction({
            kind: ActionKind.PhoneHit,
            target: target,
            commitment: commitment,
            commitBlock: uint64(block.number),
            nonce: nonce,
            atmIndex: 0,
            forfeiture: jailLostLoot[msg.sender],
            reservedReward: jailIncidentAt[msg.sender],
            reservedAtmPool: 0
        });
        emit ActionCommitted(requestId, msg.sender, ActionKind.PhoneHit, target, 0, nonce);
    }

    function revealAction(bytes32 secret) external nonReentrant whenNotPaused onlyActiveMember {
        PendingAction memory action = pendingActions[msg.sender];
        if (action.kind == ActionKind.None) revert NoPendingAction();
        if (block.number <= uint256(action.commitBlock) + MIN_REVEAL_BLOCKS - 1) revert RevealTooEarly();
        if (block.number > uint256(action.commitBlock) + MAX_REVEAL_BLOCKS) revert RevealExpired();

        bytes32 expected =
            keccak256(abi.encodePacked(msg.sender, action.target, action.atmIndex, secret, action.nonce));
        if (expected != action.commitment) revert InvalidReveal();

        bytes32 requestId =
            keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, action.nonce));
        bytes32 entropy =
            keccak256(abi.encodePacked(secret, blockhash(uint256(action.commitBlock) + 1), requestId));
        delete pendingActions[msg.sender];

        if (action.kind == ActionKind.PlayerRobbery) {
            _settlePlayerRobbery(requestId, msg.sender, action.target, uint256(entropy));
        } else if (action.kind == ActionKind.ATMHit) {
            _settleATMHit(requestId, msg.sender, action, uint256(entropy));
        } else if (action.kind == ActionKind.Snitch) {
            _settleSnitch(msg.sender, action.target, action.forfeiture, uint256(entropy));
        } else if (action.kind == ActionKind.JailShop) {
            _settleJailPurchase(msg.sender, action.atmIndex, action.forfeiture, uint256(entropy));
        } else {
            _settlePhoneHit(msg.sender, action, uint256(entropy));
        }
    }

    function forfeitExpiredAction(address attacker) external nonReentrant {
        PendingAction memory action = pendingActions[attacker];
        if (action.kind == ActionKind.None) revert NoPendingAction();
        if (block.number <= uint256(action.commitBlock) + MAX_REVEAL_BLOCKS) revert RevealTooEarly();
        delete pendingActions[attacker];

        _updatePlayer(attacker);
        uint256 penalty =
            action.kind == ActionKind.Snitch || action.kind == ActionKind.JailShop
                || action.kind == ActionKind.PhoneHit
            ? 0
            : action.forfeiture < players[attacker].unclaimed
                ? action.forfeiture
                : players[attacker].unclaimed;
        _subtractUnclaimed(attacker, penalty);

        if (action.kind == ActionKind.PlayerRobbery && action.target != address(0)) {
            _updatePlayer(action.target);
            _addUnclaimed(action.target, penalty);
            players[action.target].lifetimeEarned += penalty;
        } else if (action.kind == ActionKind.ATMHit) {
            reservedBonusPool -= action.reservedReward;
            reservedAtmClaimPools[action.atmIndex] -= action.reservedAtmPool;
            if (penalty != 0) GANGSTER.safeTransfer(BURN_ADDRESS, penalty);
        }

        bytes32 requestId =
            keccak256(abi.encodePacked(block.chainid, address(this), attacker, action.nonce));
        emit ActionForfeited(requestId, attacker, penalty);
    }

    function _settlePlayerRobbery(bytes32 requestId, address attacker, address target, uint256 entropy)
        internal
    {
        _updatePlayer(attacker);
        _updatePlayer(target);
        (uint16 chanceBps, uint16 stealBps, uint16 lossBps) =
            robberyProfile(players[attacker].power, players[target].power);
        bool won = entropy % BPS < chanceBps;
        uint256 amount;
        uint256 referralBonus;

        if (won) {
            amount = (players[target].unclaimed * stealBps) / BPS;
            _subtractUnclaimed(target, amount);
            _addUnclaimed(attacker, amount);

            uint256 bonusRate = players[attacker].directReferrals * 250;
            if (bonusRate > 2_500) bonusRate = 2_500;
            uint256 requestedBonus = (amount * bonusRate) / BPS;
            uint256 committed =
                totalAtmClaimPool + reservedBonusPool - _reservedAtmPoolTotal();
            uint256 availableBonus = bonusPool > committed ? bonusPool - committed : 0;
            referralBonus = requestedBonus < availableBonus ? requestedBonus : availableBonus;
            if (referralBonus != 0) {
                bonusPool -= referralBonus;
                _addUnclaimed(attacker, referralBonus);
            }
            players[attacker].lifetimeEarned += amount + referralBonus;
            if (players[attacker].power > players[target].power) {
                snitchTarget[target] = attacker;
                snitchAvailableUntil[target] = block.timestamp + SNITCH_WINDOW;
                snitchLoot[target] = amount;
            }
        } else {
            amount = (players[attacker].unclaimed * lossBps) / BPS;
            _subtractUnclaimed(attacker, amount);
            _addUnclaimed(target, amount);
            players[target].lifetimeEarned += amount;
            if (block.timestamp >= robberyLootUnlockAt[target]) lockedRobberyLoot[target] = 0;
            lockedRobberyLoot[target] += amount;
            robberyLootUnlockAt[target] = block.timestamp + 30 minutes;
        }

        emit PlayerRobberySettled(
            requestId, attacker, target, won, amount, referralBonus, chanceBps
        );
    }

    function _settleATMHit(bytes32 requestId, address attacker, PendingAction memory action, uint256 entropy)
        internal
    {
        _updatePlayer(attacker);
        uint32 chanceE8 = atmWinChanceForPower(players[attacker].power, action.atmIndex);
        bool won = entropy % CHANCE_PRECISION < chanceE8;
        reservedBonusPool -= action.reservedReward;
        reservedAtmClaimPools[action.atmIndex] -= action.reservedAtmPool;

        uint256 amount;
        if (won) {
            amount = action.reservedReward;
            bonusPool -= amount;
            if (action.reservedAtmPool != 0) {
                atmClaimPools[action.atmIndex] -= action.reservedAtmPool;
                totalAtmClaimPool -= action.reservedAtmPool;
            }
            _addUnclaimed(attacker, amount);
            players[attacker].lifetimeEarned += amount;
        } else {
            amount = action.forfeiture < players[attacker].unclaimed
                ? action.forfeiture
                : players[attacker].unclaimed;
            _subtractUnclaimed(attacker, amount);
            if (amount != 0) GANGSTER.safeTransfer(BURN_ADDRESS, amount);
        }
        emit ATMHitSettled(requestId, attacker, action.atmIndex, won, amount, chanceE8);
    }

    function _settleSnitch(address informant, address target, uint256 cost, uint256 entropy) internal {
        bool jailed = entropy % BPS < SNITCH_CHANCE_BPS;
        if (jailed) {
            _updatePlayer(target);
            jailedUntil[target] = block.timestamp + JAIL_DURATION;
            jailHitTarget[target] = informant;
            jailLostLoot[target] = snitchLoot[informant];
            jailIncidentAt[target] = block.timestamp;
        }
        emit SnitchSettled(informant, target, jailed, cost);
    }

    function _settleJailPurchase(address inmate, uint8 item, uint256 cost, uint256 entropy) internal {
        uint256 roll = entropy % BPS;
        uint8 outcome;
        if (roll < 5_000) {
            jailPhones[inmate]++;
            outcome = 0;
        } else if (roll < 7_500) {
            uint256 remaining = jailedUntil[inmate] > block.timestamp
                ? jailedUntil[inmate] - block.timestamp
                : 0;
            jailedUntil[inmate] = block.timestamp + remaining * 2;
            outcome = 1;
        } else {
            outcome = 2;
        }
        emit JailPurchaseSettled(inmate, item, outcome, cost, jailedUntil[inmate]);
    }

    function _settlePhoneHit(address inmate, PendingAction memory action, uint256 entropy) internal {
        bool won = entropy % BPS < 5_000;
        uint256 elapsedMinutes = block.timestamp > action.reservedReward
            ? (block.timestamp - action.reservedReward) / 1 minutes
            : 0;
        uint16 recoveryBps = elapsedMinutes < 60
            ? uint16(8_000 - ((elapsedMinutes * 8_000) / 60))
            : 0;
        uint256 recovered;
        if (won) {
            _updatePlayer(action.target);
            recovered = (action.forfeiture * recoveryBps) / BPS;
            if (recovered > players[action.target].unclaimed) {
                recovered = players[action.target].unclaimed;
            }
            _subtractUnclaimed(action.target, recovered);
            _addUnclaimed(inmate, recovered);
            players[inmate].lifetimeEarned += recovered;
        }
        delete jailHitTarget[inmate];
        delete jailLostLoot[inmate];
        delete jailIncidentAt[inmate];
        emit PhoneHitSettled(inmate, action.target, won, recovered, recoveryBps);
    }

    function robberyProfile(uint32 attackerPower, uint32 targetPower)
        public
        pure
        returns (uint16 chanceBps, uint16 stealBps, uint16 lossBps)
    {
        if (targetPower == attackerPower) return (5_000, 1_200, 1_200);
        if (targetPower > attackerPower) {
            uint256 ratioBps = (uint256(targetPower) * BPS) / (attackerPower == 0 ? 1 : attackerPower);
            if (ratioBps <= 15_000) return (2_500, 1_800, 800);
            if (ratioBps <= 25_000) return (1_800, 1_800, 800);
            return (1_000, 1_800, 800);
        }
        if (targetPower == 0) return (7_000, 400, 2_500);
        if (targetPower * 4 <= attackerPower) return (6_500, 500, 2_500);
        return (5_800, 800, 2_000);
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
        Player storage player = players[account];
        if (player.power != 0) {
            uint256 accumulated = (uint256(player.power) * accRewardPerPower) / ACC_REWARD_PRECISION;
            uint256 newlyEarned =
                ((accumulated - player.rewardDebt) * earningMultiplierBps(account)) / BPS;
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

    function _syncRewardDebt(Player storage player) internal {
        player.rewardDebt = (uint256(player.power) * accRewardPerPower) / ACC_REWARD_PRECISION;
    }

    function _addUnclaimed(address account, uint256 amount) internal {
        if (amount == 0) return;
        Player storage player = players[account];
        if (player.unclaimed == 0) unclaimedSince[account] = block.timestamp;
        player.unclaimed += amount;
    }

    function _subtractUnclaimed(address account, uint256 amount) internal {
        if (amount == 0) return;
        Player storage player = players[account];
        player.unclaimed -= amount;
        if (player.unclaimed == 0) unclaimedSince[account] = 0;
    }

    function _allocateClaimFee(uint256 amount) internal {
        uint256 cornerStore = amount / 25;
        uint256 nightclub = (amount * 2) / 25;
        uint256 casinoFloor = (amount * 4) / 25;
        uint256 downtownVault = amount - cornerStore - nightclub - casinoFloor;
        atmClaimPools[0] += cornerStore;
        atmClaimPools[1] += nightclub;
        atmClaimPools[2] += casinoFloor;
        atmClaimPools[3] += downtownVault;
        totalAtmClaimPool += amount;
        bonusPool += amount;
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
