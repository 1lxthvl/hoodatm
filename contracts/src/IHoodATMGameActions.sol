// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Frontend-facing transaction surface expected by the hoodATM web app.
/// @dev Robbery and ATM outcomes must be settled using verifiable randomness or
///      a commit/reveal resolver. Do not derive valuable outcomes from block
///      timestamps, block hashes, or prevrandao alone.
interface IHoodATMGameActions {
    event Claimed(
        address indexed player,
        uint256 grossAmount,
        uint256 burnedAmount,
        uint256 receivedAmount
    );

    function claim() external;
    function join(address referrer) external payable;
    function upgradeTier(uint8 targetTier, uint256 maxGangsterAmount) external;
    function commitPlayerRobbery(address target, bytes32 commitment) external returns (bytes32);
    function commitATMHit(uint8 atmIndex, bytes32 commitment) external returns (bytes32);
    function commitSnitch(bytes32 commitment, uint256 maxGangsterAmount) external returns (bytes32);
    function commitJailPurchase(uint8 item, bytes32 commitment, uint256 maxGangsterAmount) external returns (bytes32);
    function commitPhoneHit(bytes32 commitment) external returns (bytes32);
    function revealAction(bytes32 secret) external;
    function layLow() external;
    function setGangSystem(address gangSystem) external;
    function releaseFromJail(address inmate) external;
}
