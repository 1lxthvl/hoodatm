// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ERC20Factory {
    address public treasury;

    event TokenCreated(address indexed token, address indexed creator, string name, string symbol);

    constructor(address _treasury) {
        treasury = _treasury;
    }

    function createToken(string memory name, string memory symbol) external payable returns (address token) {
        require(msg.value >= 0.01 ether, "entry fee required");

        (bool sent, ) = payable(treasury).call{value: msg.value}("");
        require(sent, "fee transfer failed");

        token = address(new ATMToken(name, symbol, msg.sender));
        emit TokenCreated(token, msg.sender, name, symbol);
    }
}

contract ATMToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public owner;

    constructor(string memory _name, string memory _symbol, address _owner) {
        name = _name;
        symbol = _symbol;
        owner = _owner;
        totalSupply = 1_000_000_000 ether;
        balanceOf[_owner] = totalSupply;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "allowance too low");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }
}
