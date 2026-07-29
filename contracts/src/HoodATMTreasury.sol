// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./GangsterToken.sol";

contract HoodATMTreasury {
    address public owner;
    GangsterToken public token;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event TokenBurned(address indexed account, uint256 amount);
    event TokenMinted(address indexed account, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "HoodATMTreasury: only owner");
        _;
    }

    constructor(address tokenAddress) {
        owner = msg.sender;
        token = GangsterToken(tokenAddress);
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function deposit() external payable {
        require(msg.value > 0, "deposit value must be > 0");
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "insufficient balance");
        to.transfer(amount);
        emit Withdrawn(to, amount);
    }

    function burnTokens(address account, uint256 amount) external onlyOwner {
        token.burnFrom(account, amount);
        emit TokenBurned(account, amount);
    }

    function mintTokens(address account, uint256 amount) external onlyOwner {
        token.mint(account, amount);
        emit TokenMinted(account, amount);
    }
}
