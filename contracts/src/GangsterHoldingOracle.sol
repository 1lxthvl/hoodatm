// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Stores rolling 24-hour average $GANGSTER balances produced by an
/// off-chain transfer indexer. ATMGame rejects missing or stale observations.
contract GangsterHoldingOracle is Ownable2Step {
    error InvalidObservation();
    error UnauthorizedReporter();

    struct Observation {
        uint256 averageBalance;
        uint64 periodStart;
        uint64 periodEnd;
        uint64 updatedAt;
    }

    address public immutable gangster;
    address public reporter;
    mapping(address => Observation) public observations;

    event ReporterUpdated(address indexed reporter);
    event AverageBalanceUpdated(
        address indexed account,
        uint256 averageBalance,
        uint64 periodStart,
        uint64 periodEnd
    );

    constructor(address gangster_, address owner_, address reporter_) Ownable(owner_) {
        if (gangster_ == address(0) || owner_ == address(0) || reporter_ == address(0)) {
            revert InvalidObservation();
        }
        gangster = gangster_;
        reporter = reporter_;
        emit ReporterUpdated(reporter_);
    }

    function setReporter(address reporter_) external onlyOwner {
        if (reporter_ == address(0)) revert InvalidObservation();
        reporter = reporter_;
        emit ReporterUpdated(reporter_);
    }

    function submitAverageBalances(
        address[] calldata accounts,
        uint256[] calldata averages,
        uint64 periodStart,
        uint64 periodEnd
    ) external {
        if (msg.sender != reporter) revert UnauthorizedReporter();
        if (
            accounts.length == 0 || accounts.length != averages.length
                || periodEnd > block.timestamp || periodEnd < periodStart + 24 hours
                || block.timestamp - periodEnd > 1 hours
        ) revert InvalidObservation();

        uint64 updatedAt = uint64(block.timestamp);
        for (uint256 i; i < accounts.length; ++i) {
            if (accounts[i] == address(0)) revert InvalidObservation();
            Observation storage previous = observations[accounts[i]];
            if (periodEnd <= previous.periodEnd) revert InvalidObservation();
            observations[accounts[i]] = Observation({
                averageBalance: averages[i],
                periodStart: periodStart,
                periodEnd: periodEnd,
                updatedAt: updatedAt
            });
            emit AverageBalanceUpdated(accounts[i], averages[i], periodStart, periodEnd);
        }
    }
}
