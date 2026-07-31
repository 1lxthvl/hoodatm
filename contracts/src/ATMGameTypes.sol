// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library ATMGameTypes {
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
        address resolver;
        uint64 committedAt;
        uint64 expiresAt;
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
}
