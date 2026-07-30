// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdStorage, stdStorage} from "forge-std/StdStorage.sol";
import {ATMGame} from "../src/ATMGame.sol";
import {GangsterPriceOracle} from "../src/GangsterPriceOracle.sol";
import {GangsterHoldingOracle} from "../src/GangsterHoldingOracle.sol";
import {GangSystem, IATMGameGangHook} from "../src/GangSystem.sol";
import {RandomnessResolver} from "../src/RandomnessResolver.sol";
import {ATMGameMath} from "../src/ATMGameMath.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 approved = allowance[from][msg.sender];
        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockPool {
    address public token0;
    address public token1;
    uint128 public liquidity = 1e24;
    int24 public tick = 204_126;

    function configure(address token0_, address token1_) external {
        token0 = token0_;
        token1 = token1_;
        liquidity = 1e24;
        tick = 204_126;
    }

    function increaseObservationCardinalityNext(uint16) external {}

    function slot0()
        external
        view
        returns (uint160, int24, uint16, uint16, uint16, uint8, bool)
    {
        return (0, tick, 0, 64, 64, 0, true);
    }

    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory ticks, uint160[] memory secondsPerLiquidity)
    {
        ticks = new int56[](2);
        secondsPerLiquidity = new uint160[](2);
        ticks[0] = -int56(tick) * int56(uint56(secondsAgos[0]));
        ticks[1] = 0;
        secondsPerLiquidity[0] = 0;
        secondsPerLiquidity[1] =
            uint160((uint256(secondsAgos[0]) << 128) / uint256(liquidity));
    }
}

contract MockFeed {
    int256 public answer;
    uint256 public updatedAt;

    function configure(int256 answer_, uint256 updatedAt_) external {
        answer = answer_;
        updatedAt = updatedAt_;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

contract ATMGameTest is Test {
    using stdStorage for StdStorage;

    address internal constant GANGSTER = 0x6AE32f2620A4a2B55f4Fc4b9e3152c371Aa58EF0;
    address internal constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address internal constant POOL = 0x8D22eb59d73e55c23F8CA4549783B029DD4c7DFb;
    address internal constant FEED = 0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9;
    address internal constant TREASURY = 0x7657d90609046F47215Fc0Fb2BF012c88FF9f700;
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    MockERC20 internal token;
    MockPool internal pool;
    MockFeed internal feed;
    GangsterPriceOracle internal oracle;
    GangsterHoldingOracle internal holdingOracle;
    RandomnessResolver internal randomnessResolver;
    ATMGameMath internal gameMath;
    ATMGame internal game;
    GangSystem internal gangs;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    uint256 internal resolverPrivateKey = 0xA11CEB0B;
    address internal resolver;

    function setUp() public {
        vm.warp(2 days);
        MockERC20 tokenImplementation = new MockERC20();
        MockPool poolImplementation = new MockPool();
        MockFeed feedImplementation = new MockFeed();
        vm.etch(GANGSTER, address(tokenImplementation).code);
        vm.etch(WETH, address(tokenImplementation).code);
        vm.etch(POOL, address(poolImplementation).code);
        vm.etch(FEED, address(feedImplementation).code);

        token = MockERC20(GANGSTER);
        pool = MockPool(POOL);
        feed = MockFeed(FEED);
        pool.configure(WETH, GANGSTER);
        feed.configure(187_200_000_000, block.timestamp);
        resolver = vm.addr(resolverPrivateKey);

        oracle = new GangsterPriceOracle(GANGSTER, WETH, POOL, FEED, 30 minutes, 2 hours, 1, 2_231);
        holdingOracle = new GangsterHoldingOracle(GANGSTER, TREASURY, address(this));
        randomnessResolver = new RandomnessResolver(resolver);
        gameMath = new ATMGameMath();
        game = new ATMGame(oracle, holdingOracle, randomnessResolver, gameMath);
        vm.prank(TREASURY);
        game.setPaused(false);
        gangs = new GangSystem(IATMGameGangHook(address(game)), oracle, randomnessResolver);
        vm.prank(TREASURY);
        game.setGangSystem(address(gangs));
        vm.prank(TREASURY);
        gangs.setPaused(false);
        vm.prank(TREASURY);
        randomnessResolver.setPaused(false);

        token.mint(alice, 100_000_000 ether);
        vm.deal(alice, 100 ether);
    }

    function testJoinForwardsExactDynamicEthAndRefundsExcess() public {
        uint256 required = game.requiredJoinEth();
        uint256 treasuryBefore = TREASURY.balance;
        uint256 aliceBefore = alice.balance;

        vm.prank(alice);
        game.join{value: required + 1 ether}(address(0));

        assertTrue(game.hasActiveAccess(alice));
        assertEq(TREASURY.balance - treasuryBefore, required);
        assertEq(aliceBefore - alice.balance, required);
    }

    function testTierUpgradeUsesDynamicQuoteAndPaysTreasury() public {
        _join(alice);
        uint256 quote = game.quoteTierUpgrade(alice, 1);
        vm.prank(alice);
        token.approve(address(game), quote);

        uint256 treasuryBefore = token.balanceOf(TREASURY);
        vm.prank(alice);
        game.upgradeTier(1, quote);

        (, uint8 tier, uint32 power,,,,) = game.players(alice);
        assertEq(tier, 1);
        assertEq(power, 5);
        assertEq(
            token.balanceOf(TREASURY) - treasuryBefore,
            quote - (quote * 2_500) / 10_000
        );
        assertEq(game.spendingFarmPoolContributed(), (quote * 2_500) / 10_000);
        assertEq(game.activePurchasedGangsters(), 1);
        assertEq(game.dailyBaseFarmUsd(), 2.75 ether);
    }

    function testDailyBaseFarmCapsAtTenActivePurchasedGangsters() public {
        assertEq(game.dailyBaseFarmUsd(), 2.5 ether);
        vm.prank(TREASURY);
        game.setActivePurchasedGangsters(10);
        assertEq(game.dailyBaseFarmUsd(), 5 ether);
        vm.prank(TREASURY);
        game.setActivePurchasedGangsters(100);
        assertEq(game.dailyBaseFarmUsd(), 5 ether);
    }

    function testClaimAtTenHoursBurnsTenPercentWithNoFeeOrBonus() public {
        _join(alice);
        token.mint(TREASURY, 2_000_000 ether);
        vm.startPrank(TREASURY);
        token.approve(address(game), type(uint256).max);
        game.fundRewards(oracle.quoteGangsterForUsd(game.dailyBaseFarmUsd()), 1 days);
        vm.stopPrank();

        vm.warp(block.timestamp + 10 hours);
        feed.configure(187_200_000_000, block.timestamp);
        uint256 gross = game.pendingRewards(alice);
        vm.prank(alice);
        game.claim();

        assertEq(token.balanceOf(DEAD), (gross * 1_000) / 10_000);
        assertEq(game.claimedBalance(alice), gross - ((gross * 1_000) / 10_000));
        assertEq(game.totalAtmClaimPool(), 0);
    }

    function testEarlyClaimFeeFundsAtmPoolsUsingOneTwoFourEighteenWeights() public {
        _join(alice);
        token.mint(TREASURY, 2_000_000 ether);
        vm.startPrank(TREASURY);
        token.approve(address(game), type(uint256).max);
        game.fundRewards(oracle.quoteGangsterForUsd(game.dailyBaseFarmUsd()), 1 days);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 hours);
        uint256 gross = game.pendingRewards(alice);
        uint256 expectedFee = (gross * 1_800) / 10_000;
        vm.prank(alice);
        game.claim();

        assertEq(game.totalAtmClaimPool(), expectedFee);
        assertEq(game.atmClaimPools(0), expectedFee / 25);
        assertEq(game.atmClaimPools(1), (expectedFee * 2) / 25);
        assertEq(game.atmClaimPools(2), (expectedFee * 4) / 25);
        assertEq(
            game.atmClaimPools(3),
            expectedFee - expectedFee / 25 - (expectedFee * 2) / 25 - (expectedFee * 4) / 25
        );

        vm.expectPartialRevert(ATMGame.CooldownActive.selector);
        vm.prank(alice);
        game.claim();
    }

    function testTwentyHourClaimAddsCappedTwentyPercentBonus() public {
        _join(alice);
        token.mint(TREASURY, 2_000_000 ether);
        vm.startPrank(TREASURY);
        token.approve(address(game), type(uint256).max);
        game.fundRewards(oracle.quoteGangsterForUsd(game.dailyBaseFarmUsd()), 1 days);
        game.fundBonusPool(200_000 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 20 hours);
        feed.configure(187_200_000_000, block.timestamp);
        uint256 gross = game.pendingRewards(alice);
        vm.prank(alice);
        game.claim();

        assertEq(
            game.claimedBalance(alice),
            gross - ((gross * 1_000) / 10_000) + ((gross * 2_000) / 10_000)
        );
    }

    function testWithdrawalIsCappedByHalfAverageHolding() public {
        _join(alice);
        token.mint(TREASURY, 24_000_000 ether);
        vm.startPrank(TREASURY);
        token.approve(address(game), type(uint256).max);
        game.fundRewards(oracle.quoteGangsterForUsd(game.dailyBaseFarmUsd()), 1 days);
        vm.stopPrank();
        vm.warp(block.timestamp + 1 hours);
        vm.prank(alice);
        game.claim();

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        uint256[] memory averages = new uint256[](1);
        averages[0] = 1_000_000 ether;
        holdingOracle.submitAverageBalances(
            accounts, averages, uint64(block.timestamp - 24 hours), uint64(block.timestamp)
        );
        (uint256 gross,,) = game.withdrawalQuote(alice);
        assertEq(gross, game.claimedBalance(alice) / 2);

        uint256 walletBefore = token.balanceOf(alice);
        vm.prank(alice);
        game.withdraw();
        assertEq(token.balanceOf(alice) - walletBefore, gross);
    }

    function testCodeGrantedGangsterNeedsPaidGangsterAndReceivesFreeSlot() public {
        _join(alice);
        vm.prank(TREASURY);
        game.markCodeGrantedGangster(alice);
        assertTrue(game.codeGrantedGangster(alice));
        assertEq(game.gangsterSlots(alice), 1);

        token.mint(TREASURY, 24_000_000 ether);
        vm.startPrank(TREASURY);
        token.approve(address(game), type(uint256).max);
        game.fundRewards(oracle.quoteGangsterForUsd(game.dailyBaseFarmUsd()), 1 days);
        vm.stopPrank();
        vm.warp(block.timestamp + 1 hours);
        vm.prank(alice);
        game.claim();

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        uint256[] memory averages = new uint256[](1);
        averages[0] = 1_000_000 ether;
        holdingOracle.submitAverageBalances(
            accounts, averages, uint64(block.timestamp - 24 hours), uint64(block.timestamp)
        );
        (uint256 blockedGross,,) = game.withdrawalQuote(alice);
        assertEq(blockedGross, 0);
        vm.expectRevert(ATMGame.PaidGangsterRequired.selector);
        vm.prank(alice);
        game.withdraw();

        uint256 quote = game.quoteTierUpgrade(alice, 1);
        vm.prank(alice);
        token.approve(address(game), quote);
        vm.prank(alice);
        game.upgradeTier(1, quote);

        assertTrue(game.paidGangster(alice));
        assertTrue(game.codeBonusSlotGranted(alice));
        assertEq(game.gangsterSlots(alice), 2);
        (uint256 enabledGross,,) = game.withdrawalQuote(alice);
        assertGt(enabledGross, 0);
    }

    function testAtmChancesScaleWithPowerAndRespectBaseCaps() public view {
        assertEq(game.atmWinChanceForPower(1, 0), 700_000);
        assertEq(game.atmWinChanceForPower(5, 1), 250_000);
        assertEq(game.atmWinChanceForPower(30, 2), 315_000);
        assertEq(game.atmWinChanceForPower(135, 0), 48_000_000);
        assertEq(game.atmWinChanceForPower(750, 3), 1_125_000);
    }

    function testOracleRejectsStaleFeed() public {
        vm.warp(block.timestamp + 3 hours);
        vm.expectRevert(
            abi.encodeWithSelector(GangsterPriceOracle.StaleFeed.selector, uint256(2 days))
        );
        game.requiredJoinEth();
    }

    function testGangCreationUsesDynamicQuoteAndPaysTreasury() public {
        _join(alice);
        uint256 quote = gangs.creationCost();
        vm.prank(alice);
        token.approve(address(gangs), quote);
        uint256 treasuryBefore = token.balanceOf(TREASURY);

        vm.prank(alice);
        uint256 gangId = gangs.createGang("Block Family", "BLOCK", quote);

        assertEq(gangId, 1);
        assertEq(gangs.gangOf(alice), gangId);
        assertEq(
            token.balanceOf(TREASURY) - treasuryBefore,
            quote - (quote * 2_500) / 10_000
        );
        assertEq(game.spendingFarmPoolContributed(), (quote * 2_500) / 10_000);
    }

    function testThreeDirectReferralsWaiveGangCreationPayment() public {
        _join(alice);
        _joinReferred(address(0x101), alice);
        _joinReferred(address(0x102), alice);
        _joinReferred(address(0x103), alice);
        uint256 treasuryBefore = token.balanceOf(TREASURY);

        vm.prank(alice);
        gangs.createGang("Referral Crew", "REF", 0);

        assertEq(token.balanceOf(TREASURY), treasuryBefore);
    }

    function testOwnerInvitesMemberAndEditsRank() public {
        _join(alice);
        _joinReferred(bob, address(0));
        uint256 quote = gangs.creationCost();
        vm.prank(alice);
        token.approve(address(gangs), quote);
        vm.prank(alice);
        uint256 gangId = gangs.createGang("Rank Crew", "RANK", quote);

        vm.prank(alice);
        gangs.inviteMember(bob);
        vm.prank(bob);
        gangs.acceptInvitation();
        vm.prank(alice);
        gangs.setMemberRank(bob, 2);

        assertEq(gangs.gangOf(bob), gangId);
        assertEq(gangs.gangRank(bob), 2);
        assertEq(gangs.gangMemberCount(gangId), 2);
    }

    function testReferralAllocationIsGangsterDenominatedAndFullEthReachesTreasury() public {
        _join(alice);
        token.mint(bob, 100_000_000 ether);
        vm.deal(bob, 10 ether);
        uint256 required = game.requiredJoinEth();
        uint256 expectedGangster = oracle.quoteGangsterForUsd(0.125 ether);
        uint256 treasuryEthBefore = TREASURY.balance;
        uint256 treasuryGangsterBefore = token.balanceOf(TREASURY);

        vm.prank(bob);
        game.join{value: required}(alice);

        assertEq(TREASURY.balance - treasuryEthBefore, required);
        assertEq(token.balanceOf(TREASURY), treasuryGangsterBefore);
        assertEq(game.referralEntryPoolAllocatedGangster(), expectedGangster);
    }

    function testHoldFailureStopsNewAccrualAndPreservesCheckpointedRewards() public {
        _join(alice);
        _fundRewards();
        vm.warp(block.timestamp + 30 minutes);
        game.checkpointRewards(alice);
        (,,,, uint256 accrued,,) = game.players(alice);
        assertGt(accrued, 0);

        uint256 balance = token.balanceOf(alice);
        vm.prank(alice);
        token.transfer(bob, balance);
        vm.warp(block.timestamp + 30 minutes);
        game.checkpointRewards(alice);
        (,,,, uint256 afterFailure,,) = game.players(alice);

        assertEq(afterFailure, accrued);
        assertEq(game.pendingRewards(alice), accrued);
        assertFalse(game.hasActiveAccess(alice));
    }

    function testResolverAuthReplayAndRotationForAtmAction() public {
        _join(alice);
        _fundRewards();
        token.mint(TREASURY, 2_000_000 ether);
        vm.startPrank(TREASURY);
        token.approve(address(game), type(uint256).max);
        game.fundBonusPool(100_000 ether);
        vm.stopPrank();
        vm.warp(block.timestamp + 30 minutes);
        game.checkpointRewards(alice);

        bytes32 secret = keccak256("atm-secret");
        bytes32 commitment =
            keccak256(abi.encodePacked(alice, address(0), uint8(0), secret, uint64(1)));
        vm.prank(alice);
        bytes32 requestId = game.commitATMHit(0, commitment);
        vm.warp(block.timestamp + 30 seconds);
        uint64 deadline = uint64(block.timestamp + 10 minutes);
        uint256 randomWord = 77;

        bytes memory wrongSignature =
            _signResolution(address(game), requestId, commitment, randomWord, deadline, 0xBAD);
        vm.expectRevert(RandomnessResolver.InvalidResolver.selector);
        vm.prank(alice);
        game.revealAction(secret, randomWord, deadline, wrongSignature);

        uint256 replacementKey = 0xC0FFEE;
        vm.prank(TREASURY);
        randomnessResolver.setResolver(vm.addr(replacementKey));
        bytes memory signature = _signResolution(
            address(game), requestId, commitment, randomWord, deadline, resolverPrivateKey
        );
        vm.prank(alice);
        game.revealAction(secret, randomWord, deadline, signature);

        bytes32 digest = randomnessResolver.resolutionDigest(
            address(game), requestId, commitment, randomWord, deadline
        );
        assertTrue(randomnessResolver.usedResolutions(digest));
        vm.expectRevert(RandomnessResolver.ResolutionAlreadyUsed.selector);
        vm.prank(address(game));
        randomnessResolver.consume(
            requestId, commitment, randomWord, deadline, resolver, signature
        );
    }

    function testExpiredActionCannotResolveAndCanBeForfeited() public {
        _join(alice);
        _fundRewards();
        token.mint(TREASURY, 2_000_000 ether);
        vm.startPrank(TREASURY);
        token.approve(address(game), type(uint256).max);
        game.fundBonusPool(100_000 ether);
        vm.stopPrank();
        vm.warp(block.timestamp + 30 minutes);
        game.checkpointRewards(alice);

        bytes32 secret = keccak256("expired");
        bytes32 commitment =
            keccak256(abi.encodePacked(alice, address(0), uint8(0), secret, uint64(1)));
        vm.prank(alice);
        bytes32 requestId = game.commitATMHit(0, commitment);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = _signResolution(
            address(game), requestId, commitment, 1, deadline, resolverPrivateKey
        );
        vm.warp(block.timestamp + 1 hours + 1);

        vm.expectRevert(ATMGame.RevealExpired.selector);
        vm.prank(alice);
        game.revealAction(secret, 1, deadline, signature);
        game.forfeitExpiredAction(alice);
    }

    function testAllDeploymentsStartPausedAndOwnersControlPauses() public {
        RandomnessResolver freshResolver = new RandomnessResolver(resolver);
        ATMGame freshGame = new ATMGame(oracle, holdingOracle, freshResolver, gameMath);
        GangSystem freshGangs =
            new GangSystem(IATMGameGangHook(address(freshGame)), oracle, freshResolver);
        assertTrue(freshResolver.paused());
        assertTrue(freshGame.paused());
        assertTrue(freshGangs.paused());

        uint256 required = freshGame.requiredJoinEth();
        vm.expectRevert(ATMGame.ContractPaused.selector);
        vm.prank(alice);
        freshGame.join{value: required}(address(0));
    }

    function testStaleHoldingObservationBlocksWithdrawalQuote() public {
        _join(alice);
        _fundRewards();
        vm.warp(block.timestamp + 1 hours);
        vm.prank(alice);
        game.claim();

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        uint256[] memory averages = new uint256[](1);
        averages[0] = 1_000_000 ether;
        holdingOracle.submitAverageBalances(
            accounts, averages, uint64(block.timestamp - 24 hours), uint64(block.timestamp)
        );
        vm.warp(block.timestamp + 1 hours + 1);
        (uint256 gross,,) = game.withdrawalQuote(alice);
        assertEq(gross, 0);
    }

    function testHoldingOracleRejectsUnauthorizedAndNonIncreasingObservations() public {
        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        uint256[] memory averages = new uint256[](1);
        averages[0] = 100 ether;
        uint64 start = uint64(block.timestamp - 24 hours);
        uint64 end = uint64(block.timestamp);

        vm.expectRevert(GangsterHoldingOracle.UnauthorizedReporter.selector);
        vm.prank(alice);
        holdingOracle.submitAverageBalances(accounts, averages, start, end);
        holdingOracle.submitAverageBalances(accounts, averages, start, end);
        vm.expectRevert(GangsterHoldingOracle.InvalidObservation.selector);
        holdingOracle.submitAverageBalances(accounts, averages, start, end);
    }

    function testHoldingOracleBatchIsIdempotentAndBoundToPayload() public {
        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        uint256[] memory averages = new uint256[](1);
        averages[0] = 100 ether;
        uint64 reportTimestamp = uint64(block.timestamp);
        bytes32 batchId = keccak256(abi.encode(reportTimestamp, accounts, averages));

        holdingOracle.submitBatch(batchId, reportTimestamp, accounts, averages);
        assertTrue(holdingOracle.isBatchSubmitted(batchId));
        vm.expectRevert(GangsterHoldingOracle.InvalidObservation.selector);
        holdingOracle.submitBatch(batchId, reportTimestamp, accounts, averages);
    }

    function testGangJailbreakUsesSignedResolution() public {
        _join(alice);
        _joinReferred(bob, address(0));
        uint256 creationQuote = gangs.creationCost();
        vm.prank(alice);
        token.approve(address(gangs), type(uint256).max);
        vm.prank(alice);
        gangs.createGang("Breakout Crew", "FREE", creationQuote);
        vm.prank(alice);
        gangs.inviteMember(bob);
        vm.prank(bob);
        gangs.acceptInvitation();

        stdstore
            .target(address(game))
            .sig(game.jailedUntil.selector)
            .with_key(bob)
            .checked_write(block.timestamp + 3 hours);
        bytes32 secret = keccak256("jailbreak");
        bytes32 commitment =
            keccak256(abi.encodePacked(alice, bob, secret, uint64(1)));
        vm.prank(alice);
        bytes32 requestId = gangs.commitJailbreak(bob, commitment, type(uint256).max);
        vm.warp(block.timestamp + 30 seconds);
        uint64 deadline = uint64(block.timestamp + 10 minutes);
        uint256 randomWord = _winningWord(secret, requestId, 2_500);
        bytes memory signature = _signResolution(
            address(gangs), requestId, commitment, randomWord, deadline, resolverPrivateKey
        );

        vm.prank(alice);
        gangs.revealJailbreak(secret, randomWord, deadline, signature);
        assertEq(game.jailedUntil(bob), block.timestamp);
    }

    function _join(address player) internal {
        uint256 required = game.requiredJoinEth();
        vm.prank(player);
        game.join{value: required}(address(0));
    }

    function _joinReferred(address player, address referrer) internal {
        token.mint(player, 100_000_000 ether);
        vm.deal(player, 100 ether);
        uint256 required = game.requiredJoinEth();
        vm.prank(player);
        game.join{value: required}(referrer);
    }

    function _fundRewards() internal {
        token.mint(TREASURY, 2_000_000 ether);
        vm.startPrank(TREASURY);
        token.approve(address(game), type(uint256).max);
        game.fundRewards(oracle.quoteGangsterForUsd(game.dailyBaseFarmUsd()), 1 days);
        vm.stopPrank();
    }

    function _signResolution(
        address consumer,
        bytes32 requestId,
        bytes32 commitment,
        uint256 randomWord,
        uint64 deadline,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 digest = randomnessResolver.resolutionDigest(
            consumer, requestId, commitment, randomWord, deadline
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _winningWord(bytes32 secret, bytes32 requestId, uint256 threshold)
        internal
        pure
        returns (uint256 word)
    {
        while (uint256(keccak256(abi.encodePacked(secret, word, requestId))) % 10_000 >= threshold) {
            ++word;
        }
    }
}
