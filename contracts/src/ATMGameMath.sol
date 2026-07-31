// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Stateless gameplay calculations split out to keep ATMGame deployable.
contract ATMGameMath {
    uint256 private constant BPS = 10_000;

    function dailyBaseFarmUsd(uint256 activePurchased) external pure returns (uint256) {
        uint256 purchased = activePurchased < 10 ? activePurchased : 10;
        return 2.5 ether + (2.5 ether * purchased * 1_000) / BPS;
    }

    function currentHeat(uint256 startedAt, uint256 layLowUntil, uint256 timestamp)
        external
        pure
        returns (uint8)
    {
        if (startedAt == 0) return 0;
        if (timestamp < layLowUntil) {
            return uint8((layLowUntil - timestamp + 59 seconds) / 1 minutes);
        }
        if (startedAt > timestamp) return 0;
        uint256 heat = (timestamp - startedAt) / 1 minutes;
        return uint8(heat < 100 ? heat : 100);
    }

    function claimRates(uint256 startedAt, uint256 timestamp)
        external
        pure
        returns (uint16 feeBps, uint16 bonusBps)
    {
        uint256 heldHours =
            startedAt == 0 || startedAt >= timestamp ? 0 : (timestamp - startedAt) / 1 hours;
        if (heldHours < 10) feeBps = uint16(2_000 - heldHours * 200);
        if (heldHours > 10) {
            uint256 bonusHours = heldHours - 10;
            if (bonusHours > 10) bonusHours = 10;
            bonusBps = uint16(bonusHours * 200);
        }
    }

    function tierCostUsd(uint8 tier) external pure returns (uint256) {
        if (tier == 0) return 0;
        if (tier == 1) return 2.5 ether;
        if (tier == 2) return 12.5 ether;
        if (tier == 3) return 50 ether;
        if (tier == 4) return 250 ether;
        revert();
    }

    function tierPower(uint8 tier) external pure returns (uint32) {
        if (tier == 0) return 1;
        if (tier == 1) return 5;
        if (tier == 2) return 30;
        if (tier == 3) return 135;
        if (tier == 4) return 750;
        revert();
    }

    function atmWinChance(
        uint32 power,
        uint8 atmIndex,
        uint32 civilianChanceE8,
        uint32 maximumChanceE8
    ) external pure returns (uint32) {
        if (power == 135 && atmIndex == 0) return 48_000_000;
        uint256 scaled = uint256(civilianChanceE8) * power;
        return uint32(scaled < maximumChanceE8 ? scaled : maximumChanceE8);
    }

    function robberyProfile(uint32 attackerPower, uint32 targetPower)
        external
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

    function earningMultiplierBps(uint256 heat) external pure returns (uint16) {
        return uint16(10_000 - ((heat / 3) * 100));
    }

    function claimFeeSplits(uint256 amount)
        external
        pure
        returns (uint256 cornerStore, uint256 nightclub, uint256 casinoFloor, uint256 downtownVault)
    {
        cornerStore = amount / 25;
        nightclub = (amount * 2) / 25;
        casinoFloor = (amount * 4) / 25;
        downtownVault = amount - cornerStore - nightclub - casinoFloor;
    }

    function isValidUsername(string calldata username) external pure returns (bool) {
        bytes memory raw = bytes(username);
        uint256 length = raw.length;
        if (length < 3 || length > 15) return false;
        for (uint256 i; i < length; ++i) {
            bytes1 character = raw[i];
            bool valid = (character >= 0x61 && character <= 0x7a)
                || (character >= 0x30 && character <= 0x39) || character == 0x5f;
            if (!valid) return false;
        }
        return true;
    }
}
