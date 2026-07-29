// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Treasury {
    address public owner;

    event Deposited(address indexed from, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    function withdraw(address payable to, uint256 amount) external {
        require(msg.sender == owner, "only owner");
        to.transfer(amount);
    }
}
