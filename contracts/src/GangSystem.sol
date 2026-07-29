// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {GangsterPriceOracle} from "./GangsterPriceOracle.sol";

interface IATMGameGangHook {
    function hasActiveAccess(address account) external view returns (bool);
    function jailedUntil(address account) external view returns (uint256);
    function releaseFromJail(address inmate) external;
    function recordGangsterSpend(address payer, uint256 amount, uint256 farmContribution) external;
    function players(address account)
        external
        view
        returns (
            bool joined,
            uint8 tier,
            uint32 power,
            uint32 directReferrals,
            uint256 unclaimed,
            uint256 rewardDebt,
            uint256 lifetimeEarned
        );
}

/// @notice On-chain gangs, ranks, invitations, and same-gang jail releases.
/// @dev The ATMGame owner must authorize this contract through setGangSystem.
contract GangSystem is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error AccessDenied();
    error InvalidGang();
    error InvalidMember();
    error InvalidReveal();
    error PendingActionExists();
    error NoPendingAction();
    error RevealTooEarly();
    error RevealExpired();
    error SlippageExceeded(uint256 required, uint256 maximum);

    IERC20 public constant GANGSTER = IERC20(0x6AE32f2620A4a2B55f4Fc4b9e3152c371Aa58EF0);
    address public constant TREASURY = 0x7657d90609046F47215Fc0Fb2BF012c88FF9f700;
    uint256 public constant BPS = 10_000;
    uint256 public constant SPEND_TO_FARM_BPS = 2_500;
    uint256 public constant CREATION_USD_E18 = 10 ether;
    uint256 public constant JAILBREAK_USD_E18 = 2 ether;
    uint256 public constant JAILBREAK_CHANCE_BPS = 2_500;
    uint256 public constant MIN_REVEAL_BLOCKS = 2;
    uint256 public constant MAX_REVEAL_BLOCKS = 200;

    struct Gang {
        address owner;
        string name;
        string tag;
        uint32 memberCount;
    }

    struct PendingJailbreak {
        address inmate;
        bytes32 commitment;
        uint64 commitBlock;
        uint64 nonce;
        uint256 gangId;
        uint256 cost;
    }

    IATMGameGangHook public immutable game;
    GangsterPriceOracle public immutable oracle;

    uint256 public gangCount;
    mapping(uint256 => Gang) public gangs;
    mapping(uint256 => address[]) public gangMembers;
    mapping(address => uint256) public gangOf;
    mapping(address => uint8) public gangRank;
    mapping(address => uint256) public invitedGang;
    mapping(address => PendingJailbreak) public pendingJailbreaks;
    mapping(address => uint64) public jailbreakNonces;

    event GangCreated(
        uint256 indexed gangId,
        address indexed owner,
        string name,
        string tag,
        uint256 gangsterPaid
    );
    event GangMemberInvited(uint256 indexed gangId, address indexed member);
    event GangMemberJoined(uint256 indexed gangId, address indexed member);
    event GangRankUpdated(uint256 indexed gangId, address indexed member, uint8 rank);
    event GangJailbreakCommitted(
        bytes32 indexed requestId,
        address indexed payer,
        address indexed inmate,
        uint256 gangId,
        uint64 nonce
    );
    event GangJailbreakSettled(
        bytes32 indexed requestId,
        address indexed payer,
        address indexed inmate,
        bool freed,
        uint256 cost
    );
    event GangJailbreakForfeited(bytes32 indexed requestId, address indexed payer);

    modifier onlyActiveMember() {
        if (!game.hasActiveAccess(msg.sender)) revert AccessDenied();
        _;
    }

    constructor(IATMGameGangHook game_, GangsterPriceOracle oracle_) {
        if (address(game_) == address(0) || address(oracle_) == address(0)) revert InvalidGang();
        game = game_;
        oracle = oracle_;
    }

    function creationCost() public view returns (uint256) {
        return oracle.quoteGangsterForUsd(CREATION_USD_E18);
    }

    function jailbreakCost() public view returns (uint256) {
        return oracle.quoteGangsterForUsd(JAILBREAK_USD_E18);
    }

    function gangMemberCount(uint256 gangId) external view returns (uint256) {
        return gangMembers[gangId].length;
    }

    function createGang(string calldata name, string calldata tag, uint256 maxGangsterAmount)
        external
        nonReentrant
        onlyActiveMember
        returns (uint256 gangId)
    {
        if (gangOf[msg.sender] != 0) revert InvalidGang();
        bytes memory nameBytes = bytes(name);
        bytes memory tagBytes = bytes(tag);
        if (nameBytes.length < 3 || nameBytes.length > 28 || !_validTag(tagBytes)) {
            revert InvalidGang();
        }

        (,,, uint32 directReferrals,,,) = game.players(msg.sender);
        uint256 cost;
        if (directReferrals < 3) {
            cost = creationCost();
            if (cost > maxGangsterAmount) revert SlippageExceeded(cost, maxGangsterAmount);
            _collectGangsterSpend(msg.sender, cost);
        }

        gangId = ++gangCount;
        gangs[gangId] = Gang(msg.sender, name, tag, 1);
        gangMembers[gangId].push(msg.sender);
        gangOf[msg.sender] = gangId;
        emit GangCreated(gangId, msg.sender, name, tag, cost);
    }

    function inviteMember(address member) external onlyActiveMember {
        uint256 gangId = gangOf[msg.sender];
        if (gangId == 0 || gangs[gangId].owner != msg.sender) revert AccessDenied();
        if (member == address(0) || gangOf[member] != 0) revert InvalidMember();
        invitedGang[member] = gangId;
        emit GangMemberInvited(gangId, member);
    }

    function acceptInvitation() external onlyActiveMember {
        if (gangOf[msg.sender] != 0) revert InvalidMember();
        uint256 gangId = invitedGang[msg.sender];
        if (gangId == 0 || gangs[gangId].owner == address(0)) revert InvalidGang();
        delete invitedGang[msg.sender];
        gangOf[msg.sender] = gangId;
        gangRank[msg.sender] = 3;
        gangMembers[gangId].push(msg.sender);
        gangs[gangId].memberCount++;
        emit GangMemberJoined(gangId, msg.sender);
    }

    function setMemberRank(address member, uint8 rank) external onlyActiveMember {
        uint256 gangId = gangOf[msg.sender];
        if (gangId == 0 || gangs[gangId].owner != msg.sender) revert AccessDenied();
        if (gangOf[member] != gangId || rank > 3) revert InvalidMember();
        gangRank[member] = rank;
        emit GangRankUpdated(gangId, member, rank);
    }

    function commitJailbreak(address inmate, bytes32 commitment, uint256 maxGangsterAmount)
        external
        nonReentrant
        onlyActiveMember
        returns (bytes32 requestId)
    {
        uint256 gangId = gangOf[msg.sender];
        if (
            gangId == 0 || gangOf[inmate] != gangId || inmate == msg.sender
                || block.timestamp >= game.jailedUntil(inmate) || commitment == bytes32(0)
        ) revert InvalidMember();
        if (pendingJailbreaks[msg.sender].commitment != bytes32(0)) revert PendingActionExists();

        uint256 cost = jailbreakCost();
        if (cost > maxGangsterAmount) revert SlippageExceeded(cost, maxGangsterAmount);
        _collectGangsterSpend(msg.sender, cost);

        uint64 nonce = ++jailbreakNonces[msg.sender];
        requestId = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, nonce));
        pendingJailbreaks[msg.sender] = PendingJailbreak(
            inmate,
            commitment,
            uint64(block.number),
            nonce,
            gangId,
            cost
        );
        emit GangJailbreakCommitted(requestId, msg.sender, inmate, gangId, nonce);
    }

    function revealJailbreak(bytes32 secret) external nonReentrant onlyActiveMember {
        PendingJailbreak memory action = pendingJailbreaks[msg.sender];
        if (action.commitment == bytes32(0)) revert NoPendingAction();
        if (block.number <= uint256(action.commitBlock) + MIN_REVEAL_BLOCKS - 1) revert RevealTooEarly();
        if (block.number > uint256(action.commitBlock) + MAX_REVEAL_BLOCKS) revert RevealExpired();
        if (
            keccak256(abi.encodePacked(msg.sender, action.inmate, secret, action.nonce))
                != action.commitment
        ) revert InvalidReveal();

        bytes32 requestId =
            keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, action.nonce));
        uint256 entropy = uint256(
            keccak256(
                abi.encodePacked(
                    secret,
                    blockhash(uint256(action.commitBlock) + 1),
                    requestId
                )
            )
        );
        delete pendingJailbreaks[msg.sender];

        bool freed = action.gangId != 0 && gangOf[msg.sender] == action.gangId
            && gangOf[action.inmate] == action.gangId
            && block.timestamp < game.jailedUntil(action.inmate)
            && entropy % BPS < JAILBREAK_CHANCE_BPS;
        if (freed) game.releaseFromJail(action.inmate);
        emit GangJailbreakSettled(requestId, msg.sender, action.inmate, freed, action.cost);
    }

    function forfeitExpiredJailbreak(address payer) external {
        PendingJailbreak memory action = pendingJailbreaks[payer];
        if (action.commitment == bytes32(0)) revert NoPendingAction();
        if (block.number <= uint256(action.commitBlock) + MAX_REVEAL_BLOCKS) revert RevealTooEarly();
        delete pendingJailbreaks[payer];
        bytes32 requestId =
            keccak256(abi.encodePacked(block.chainid, address(this), payer, action.nonce));
        emit GangJailbreakForfeited(requestId, payer);
    }

    function _validTag(bytes memory tag) internal pure returns (bool) {
        if (tag.length < 2 || tag.length > 5) return false;
        for (uint256 i; i < tag.length; ++i) {
            bytes1 character = tag[i];
            if (
                !((character >= 0x41 && character <= 0x5a)
                    || (character >= 0x30 && character <= 0x39))
            ) return false;
        }
        return true;
    }

    function _collectGangsterSpend(address payer, uint256 amount) internal {
        uint256 farmContribution = (amount * SPEND_TO_FARM_BPS) / BPS;
        uint256 treasuryAmount = amount - farmContribution;
        if (treasuryAmount != 0) {
            GANGSTER.safeTransferFrom(payer, TREASURY, treasuryAmount);
        }
        if (farmContribution != 0) {
            GANGSTER.safeTransferFrom(payer, address(game), farmContribution);
            game.recordGangsterSpend(payer, amount, farmContribution);
        }
    }
}
