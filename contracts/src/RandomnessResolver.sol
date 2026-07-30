// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Shared EIP-712 verifier for hoodATM chance-based actions.
contract RandomnessResolver is Ownable2Step {
    error ContractPaused();
    error InvalidResolver();
    error ResolverDeadlineInvalid();
    error ResolutionAlreadyUsed();

    address public constant TREASURY = 0x7657d90609046F47215Fc0Fb2BF012c88FF9f700;
    bytes32 public constant RESOLUTION_TYPEHASH = keccak256(
        "Resolution(address consumer,bytes32 requestId,bytes32 commitment,uint256 randomWord,uint64 deadline)"
    );
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant NAME_HASH = keccak256("hoodATM RandomnessResolver");
    bytes32 private constant VERSION_HASH = keccak256("1");

    bool public paused = true;
    address public resolver;
    mapping(bytes32 => bool) public usedResolutions;

    event PauseUpdated(bool paused);
    event ResolverUpdated(address indexed previousResolver, address indexed newResolver);
    event ResolutionConsumed(bytes32 indexed digest, address indexed consumer, bytes32 indexed requestId);

    constructor(address resolver_) Ownable(TREASURY) {
        if (resolver_ == address(0)) revert InvalidResolver();
        resolver = resolver_;
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PauseUpdated(paused_);
    }

    function setResolver(address resolver_) external onlyOwner {
        if (resolver_ == address(0)) revert InvalidResolver();
        address previous = resolver;
        resolver = resolver_;
        emit ResolverUpdated(previous, resolver_);
    }

    function consume(
        bytes32 requestId,
        bytes32 commitment,
        uint256 randomWord,
        uint64 deadline,
        address expectedResolver,
        bytes calldata signature
    ) external returns (uint256) {
        if (paused) revert ContractPaused();
        if (deadline < block.timestamp) revert ResolverDeadlineInvalid();
        bytes32 digest =
            resolutionDigest(msg.sender, requestId, commitment, randomWord, deadline);
        if (usedResolutions[digest]) revert ResolutionAlreadyUsed();
        if (_recover(digest, signature) != expectedResolver) revert InvalidResolver();
        usedResolutions[digest] = true;
        emit ResolutionConsumed(digest, msg.sender, requestId);
        return randomWord;
    }

    function resolutionDigest(
        address consumer,
        bytes32 requestId,
        bytes32 commitment,
        uint256 randomWord,
        uint64 deadline
    ) public view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this))
        );
        bytes32 structHash = keccak256(
            abi.encode(
                RESOLUTION_TYPEHASH,
                consumer,
                requestId,
                commitment,
                randomWord,
                deadline
            )
        );
        return keccak256(abi.encodePacked(hex"1901", domainSeparator, structHash));
    }

    function _recover(bytes32 digest, bytes calldata signature)
        private
        pure
        returns (address signer)
    {
        if (signature.length != 65) revert InvalidResolver();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }
        if (
            uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
                || (v != 27 && v != 28)
        ) revert InvalidResolver();
        signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidResolver();
    }
}
