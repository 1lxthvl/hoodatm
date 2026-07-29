// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GangsterToken} from "../src/GangsterToken.sol";

contract GangsterTokenTest is Test {
    GangsterToken public token;
    address public user = address(0x123);

    function setUp() public {
        token = new GangsterToken("GANGSTER", "GANG", address(this));
    }

    function testInitialSupply() public {
        assertEq(token.totalSupply(), 1_000_000_000 ether);
        assertEq(token.balanceOf(address(this)), 1_000_000_000 ether);
    }

    function testTransfer() public {
        token.transfer(user, 100 ether);
        assertEq(token.balanceOf(user), 100 ether);
    }

    function testBurn() public {
        token.burn(100 ether);
        assertEq(token.totalSupply(), 1_000_000_000 ether - 100 ether);
    }
}
