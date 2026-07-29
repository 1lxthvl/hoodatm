// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/GangsterPriceOracle.sol";
import "../src/ATMGame.sol";
import "../src/GangsterHoldingOracle.sol";
import "../src/GangSystem.sol";

contract DeployHoodATM is Script {
    address internal constant GANGSTER = 0x6AE32f2620A4a2B55f4Fc4b9e3152c371Aa58EF0;
    address internal constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address internal constant POOL = 0x8D22eb59d73e55c23F8CA4549783B029DD4c7DFb;
    address internal constant ETH_USD_FEED = 0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9;
    address internal constant TREASURY = 0x7657d90609046F47215Fc0Fb2BF012c88FF9f700;

    function run()
        external
        returns (
            GangsterPriceOracle oracle,
            GangsterHoldingOracle holdingOracle,
            ATMGame game,
            GangSystem gangSystem
        )
    {
        address reporter = vm.envAddress("HOODATM_HOLDING_ORACLE_REPORTER");
        vm.startBroadcast();

        oracle = new GangsterPriceOracle(
            GANGSTER,
            WETH,
            POOL,
            ETH_USD_FEED,
            30 minutes,
            2 hours,
            9_000_000_000_000_000_000_000,
            2_231
        );
        oracle.preparePoolOracle(64);
        holdingOracle = new GangsterHoldingOracle(GANGSTER, TREASURY, reporter);
        game = new ATMGame(oracle, holdingOracle);
        gangSystem = new GangSystem(IATMGameGangHook(address(game)), oracle);
        game.setGangSystem(address(gangSystem));

        vm.stopBroadcast();
    }
}
