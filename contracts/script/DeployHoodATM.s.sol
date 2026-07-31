// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/GangsterPriceOracle.sol";
import "../src/ATMGame.sol";
import "../src/GangsterHoldingOracle.sol";
import "../src/GangSystem.sol";
import "../src/RandomnessResolver.sol";
import "../src/ATMGameMath.sol";

contract DeployHoodATM is Script {
    function run() external returns (ATMGameMath gameMath, ATMGame game, GangSystem gangSystem) {
        GangsterPriceOracle oracle =
            GangsterPriceOracle(vm.envAddress("HOODATM_PRICE_ORACLE"));
        GangsterHoldingOracle holdingOracle =
            GangsterHoldingOracle(vm.envAddress("HOODATM_HOLDING_ORACLE"));
        RandomnessResolver randomnessResolver =
            RandomnessResolver(vm.envAddress("HOODATM_RANDOMNESS_RESOLVER_CONTRACT"));

        vm.startBroadcast();
        gameMath = new ATMGameMath();
        game = new ATMGame(oracle, holdingOracle, randomnessResolver, gameMath);
        gangSystem =
            new GangSystem(IATMGameGangHook(address(game)), oracle, randomnessResolver);
        vm.stopBroadcast();
    }
}

/// @notice Separate treasury-signed configuration transaction.
contract ConfigureHoodATM is Script {
    function run() external {
        ATMGame game = ATMGame(payable(vm.envAddress("HOODATM_GAME")));
        address gangSystem = vm.envAddress("HOODATM_GANG_SYSTEM");
        address codeGranter = vm.envOr("HOODATM_CODE_GRANTER", address(0));
        vm.startBroadcast();
        game.setGangSystem(gangSystem);
        if (codeGranter != address(0)) {
            game.setCodeGranter(codeGranter);
        }
        vm.stopBroadcast();
    }
}
