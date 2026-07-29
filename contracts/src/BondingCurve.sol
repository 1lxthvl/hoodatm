// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BondingCurve {
    uint256 public reserve;
    uint256 public supply;
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant INITIAL_RESERVE = 0.1 ether;
    uint256 public constant ENTRY_FEE = 0.01 ether;
    uint256 public constant ATM_PER_ENTRY = 1 ether;

    constructor() {
        supply = INITIAL_SUPPLY;
        reserve = INITIAL_RESERVE;
    }

    function buyATM() external payable {
        require(msg.value >= ENTRY_FEE, "entry fee required");
        reserve += msg.value;
        supply += ATM_PER_ENTRY;
    }

    function sell(uint256 amount) external {
        require(amount > 0, "amount must be > 0");
        reserve -= amount;
        supply -= amount;
    }
}
