// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ATMGameMath} from "./ATMGameMath.sol";
import {ATMGameTypes} from "./ATMGameTypes.sol";

/// @notice External combat settlement helpers kept out of ATMGame to stay under EIP-170.
library ATMGameCombat {
    using SafeERC20 for IERC20;

    uint256 internal constant BPS = 10_000;
    uint256 internal constant CHANCE_PRECISION = 100_000_000;
    uint256 internal constant JAIL_DURATION = 3 hours;
    uint256 internal constant SNITCH_WINDOW = 24 hours;
    uint256 internal constant SNITCH_CHANCE_BPS = 500;

    event SnitchSettled(address indexed informant, address indexed target, bool jailed, uint256 cost);
    event JailPurchaseSettled(
        address indexed inmate, uint8 indexed item, uint8 outcome, uint256 cost, uint256 jailedUntil
    );
    event PhoneHitSettled(
        address indexed inmate,
        address indexed target,
        bool won,
        uint256 recovered,
        uint16 recoveryBps
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

    function settlePlayerRobbery(
        mapping(address => ATMGameTypes.Player) storage players,
        mapping(address => address) storage snitchTarget,
        mapping(address => uint256) storage snitchAvailableUntil,
        mapping(address => uint256) storage snitchLoot,
        mapping(address => uint256) storage lockedRobberyLoot,
        mapping(address => uint256) storage robberyLootUnlockAt,
        mapping(address => uint256) storage unclaimedSince,
        uint256[4] storage reservedAtmClaimPools,
        ATMGameMath gameMath,
        bytes32 requestId,
        address attacker,
        address target,
        uint256 entropy,
        uint256 bonusPool,
        uint256 reservedBonusPool,
        uint256 totalAtmClaimPool
    ) external returns (uint256 newBonusPool) {
        newBonusPool = bonusPool;
        (uint16 chanceBps, uint16 stealBps, uint16 lossBps) =
            gameMath.robberyProfile(players[attacker].power, players[target].power);
        bool won = entropy % BPS < chanceBps;
        uint256 amount;
        uint256 referralBonus;

        if (won) {
            amount = (players[target].unclaimed * stealBps) / BPS;
            _subtractUnclaimed(players, unclaimedSince, target, amount);
            _addUnclaimed(players, unclaimedSince, attacker, amount);

            uint256 bonusRate = players[attacker].directReferrals * 250;
            if (bonusRate > 2_500) bonusRate = 2_500;
            uint256 requestedBonus = (amount * bonusRate) / BPS;
            uint256 committed =
                totalAtmClaimPool + reservedBonusPool - _reservedAtmPoolTotal(reservedAtmClaimPools);
            uint256 availableBonus = newBonusPool > committed ? newBonusPool - committed : 0;
            referralBonus = requestedBonus < availableBonus ? requestedBonus : availableBonus;
            if (referralBonus != 0) {
                newBonusPool -= referralBonus;
                _addUnclaimed(players, unclaimedSince, attacker, referralBonus);
            }
            players[attacker].lifetimeEarned += amount + referralBonus;
            if (players[attacker].power > players[target].power) {
                snitchTarget[target] = attacker;
                snitchAvailableUntil[target] = block.timestamp + SNITCH_WINDOW;
                snitchLoot[target] = amount;
            }
        } else {
            amount = (players[attacker].unclaimed * lossBps) / BPS;
            _subtractUnclaimed(players, unclaimedSince, attacker, amount);
            _addUnclaimed(players, unclaimedSince, target, amount);
            players[target].lifetimeEarned += amount;
            if (block.timestamp >= robberyLootUnlockAt[target]) lockedRobberyLoot[target] = 0;
            lockedRobberyLoot[target] += amount;
            robberyLootUnlockAt[target] = block.timestamp + 30 minutes;
        }

        emit PlayerRobberySettled(
            requestId, attacker, target, won, amount, referralBonus, chanceBps
        );
    }

    function settleATMHit(
        mapping(address => ATMGameTypes.Player) storage players,
        mapping(address => uint256) storage unclaimedSince,
        uint256[4] storage atmClaimPools,
        uint256[4] storage reservedAtmClaimPools,
        ATMGameMath gameMath,
        ATMGameTypes.ATMConfig memory config,
        bytes32 requestId,
        address attacker,
        ATMGameTypes.PendingAction memory action,
        uint256 entropy,
        uint256 bonusPool,
        uint256 reservedBonusPool,
        uint256 totalAtmClaimPool,
        IERC20 gangster,
        address burn
    )
        external
        returns (uint256 newBonusPool, uint256 newReservedBonusPool, uint256 newTotalAtmClaimPool)
    {
        newBonusPool = bonusPool;
        newReservedBonusPool = reservedBonusPool - action.reservedReward;
        newTotalAtmClaimPool = totalAtmClaimPool;
        reservedAtmClaimPools[action.atmIndex] -= action.reservedAtmPool;

        uint32 chanceE8 = gameMath.atmWinChance(
            players[attacker].power, action.atmIndex, config.civilianChanceE8, config.maximumChanceE8
        );
        bool won = entropy % CHANCE_PRECISION < chanceE8;
        uint256 amount;
        if (won) {
            amount = action.reservedReward;
            newBonusPool -= amount;
            if (action.reservedAtmPool != 0) {
                atmClaimPools[action.atmIndex] -= action.reservedAtmPool;
                newTotalAtmClaimPool -= action.reservedAtmPool;
            }
            _addUnclaimed(players, unclaimedSince, attacker, amount);
            players[attacker].lifetimeEarned += amount;
        } else {
            amount = action.forfeiture < players[attacker].unclaimed
                ? action.forfeiture
                : players[attacker].unclaimed;
            _subtractUnclaimed(players, unclaimedSince, attacker, amount);
            if (amount != 0) gangster.safeTransfer(burn, amount);
        }
        emit ATMHitSettled(requestId, attacker, action.atmIndex, won, amount, chanceE8);
    }

    function settleSnitch(
        mapping(address => uint256) storage jailedUntil,
        mapping(address => address) storage jailHitTarget,
        mapping(address => uint256) storage jailLostLoot,
        mapping(address => uint256) storage jailIncidentAt,
        mapping(address => uint256) storage snitchLoot,
        address informant,
        address target,
        uint256 cost,
        uint256 entropy
    ) external returns (bool jailed) {
        jailed = entropy % BPS < SNITCH_CHANCE_BPS;
        if (jailed) {
            jailedUntil[target] = block.timestamp + JAIL_DURATION;
            jailHitTarget[target] = informant;
            jailLostLoot[target] = snitchLoot[informant];
            jailIncidentAt[target] = block.timestamp;
        }
        emit SnitchSettled(informant, target, jailed, cost);
    }

    function settleJailPurchase(
        mapping(address => uint256) storage jailedUntil,
        mapping(address => uint256) storage jailPhones,
        address inmate,
        uint8 item,
        uint256 cost,
        uint256 entropy
    ) external {
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

    function settlePhoneHit(
        mapping(address => ATMGameTypes.Player) storage players,
        mapping(address => uint256) storage unclaimedSince,
        mapping(address => address) storage jailHitTarget,
        mapping(address => uint256) storage jailLostLoot,
        mapping(address => uint256) storage jailIncidentAt,
        address inmate,
        ATMGameTypes.PendingAction memory action,
        uint256 entropy
    ) external {
        bool won = entropy % BPS < 5_000;
        uint256 elapsedMinutes = block.timestamp > action.reservedReward
            ? (block.timestamp - action.reservedReward) / 1 minutes
            : 0;
        uint16 recoveryBps = elapsedMinutes < 60
            ? uint16(8_000 - ((elapsedMinutes * 8_000) / 60))
            : 0;
        uint256 recovered;
        if (won) {
            recovered = (action.forfeiture * recoveryBps) / BPS;
            if (recovered > players[action.target].unclaimed) {
                recovered = players[action.target].unclaimed;
            }
            _subtractUnclaimed(players, unclaimedSince, action.target, recovered);
            _addUnclaimed(players, unclaimedSince, inmate, recovered);
            players[inmate].lifetimeEarned += recovered;
        }
        delete jailHitTarget[inmate];
        delete jailLostLoot[inmate];
        delete jailIncidentAt[inmate];
        emit PhoneHitSettled(inmate, action.target, won, recovered, recoveryBps);
    }

    function forfeitExpired(
        mapping(address => ATMGameTypes.PendingAction) storage pendingActions,
        mapping(address => ATMGameTypes.Player) storage players,
        mapping(address => uint256) storage unclaimedSince,
        address attacker,
        IERC20 gangster,
        address burn
    )
        external
        returns (
            uint256 penalty,
            uint256 reservedRewardRefund,
            uint8 atmIndex,
            uint256 reservedAtmPoolRefund,
            ATMGameTypes.ActionKind kind,
            address target
        )
    {
        ATMGameTypes.PendingAction memory action = pendingActions[attacker];
        kind = action.kind;
        target = action.target;
        if (kind == ATMGameTypes.ActionKind.None) revert();
        if (block.timestamp <= action.expiresAt) revert();
        delete pendingActions[attacker];

        penalty = kind == ATMGameTypes.ActionKind.Snitch || kind == ATMGameTypes.ActionKind.JailShop
                || kind == ATMGameTypes.ActionKind.PhoneHit
            ? 0
            : action.forfeiture < players[attacker].unclaimed
                ? action.forfeiture
                : players[attacker].unclaimed;
        _subtractUnclaimed(players, unclaimedSince, attacker, penalty);

        if (kind == ATMGameTypes.ActionKind.PlayerRobbery && target != address(0)) {
            _addUnclaimed(players, unclaimedSince, target, penalty);
            players[target].lifetimeEarned += penalty;
        } else if (kind == ATMGameTypes.ActionKind.ATMHit) {
            reservedRewardRefund = action.reservedReward;
            atmIndex = action.atmIndex;
            reservedAtmPoolRefund = action.reservedAtmPool;
            if (penalty != 0) gangster.safeTransfer(burn, penalty);
        }

        bytes32 requestId =
            keccak256(abi.encodePacked(block.chainid, address(this), attacker, action.nonce));
        emit ActionForfeited(requestId, attacker, penalty);
    }

    function _addUnclaimed(
        mapping(address => ATMGameTypes.Player) storage players,
        mapping(address => uint256) storage unclaimedSince,
        address account,
        uint256 amount
    ) private {
        if (amount == 0) return;
        ATMGameTypes.Player storage player = players[account];
        if (player.unclaimed == 0) unclaimedSince[account] = block.timestamp;
        player.unclaimed += amount;
    }

    function _subtractUnclaimed(
        mapping(address => ATMGameTypes.Player) storage players,
        mapping(address => uint256) storage unclaimedSince,
        address account,
        uint256 amount
    ) private {
        if (amount == 0) return;
        ATMGameTypes.Player storage player = players[account];
        player.unclaimed -= amount;
        if (player.unclaimed == 0) unclaimedSince[account] = 0;
    }

    function _reservedAtmPoolTotal(uint256[4] storage reservedAtmClaimPools)
        private
        view
        returns (uint256)
    {
        return reservedAtmClaimPools[0] + reservedAtmClaimPools[1]
            + reservedAtmClaimPools[2] + reservedAtmClaimPools[3];
    }
}
