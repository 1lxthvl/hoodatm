// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

interface IUniswapV3OraclePool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function liquidity() external view returns (uint128);
    function increaseObservationCardinalityNext(uint16 observationCardinalityNext) external;
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );

    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
}

/// @notice Quotes the live Pons GANGSTER/WETH market in USD using a Uniswap V3 TWAP
///         and the official Chainlink ETH/USD feed on Robinhood Chain.
/// @dev The pool must have enough observation history before quotes become available.
contract GangsterPriceOracle {
    error InvalidConfiguration();
    error InsufficientPoolLiquidity(uint128 current, uint128 minimum);
    error InvalidFeedAnswer();
    error StaleFeed(uint256 updatedAt);
    error ZeroPrice();
    error PriceDeviationTooHigh(int24 spotTick, int24 twapTick);
    error InsufficientObservationCardinality(uint16 current, uint16 required);

    address public immutable gangster;
    address public immutable weth;
    IUniswapV3OraclePool public immutable pool;
    IAggregatorV3 public immutable ethUsdFeed;
    uint32 public immutable twapWindow;
    uint32 public immutable maxFeedAge;
    uint128 public immutable minimumLiquidity;
    uint24 public immutable maximumTickDeviation;
    uint8 public immutable feedDecimals;

    constructor(
        address gangster_,
        address weth_,
        address pool_,
        address ethUsdFeed_,
        uint32 twapWindow_,
        uint32 maxFeedAge_,
        uint128 minimumLiquidity_,
        uint24 maximumTickDeviation_
    ) {
        if (
            gangster_ == address(0) || weth_ == address(0) || pool_ == address(0)
                || ethUsdFeed_ == address(0) || twapWindow_ < 5 minutes || twapWindow_ > 1 days
                || maxFeedAge_ < 5 minutes || maxFeedAge_ > 1 days || minimumLiquidity_ == 0
                || maximumTickDeviation_ < 100 || maximumTickDeviation_ > 10_000
        ) revert InvalidConfiguration();

        IUniswapV3OraclePool configuredPool = IUniswapV3OraclePool(pool_);
        address token0 = configuredPool.token0();
        address token1 = configuredPool.token1();
        if (!((token0 == gangster_ && token1 == weth_) || (token0 == weth_ && token1 == gangster_))) {
            revert InvalidConfiguration();
        }
        if (IERC20Metadata(gangster_).decimals() != 18 || IERC20Metadata(weth_).decimals() != 18) {
            revert InvalidConfiguration();
        }

        uint8 decimals_ = IAggregatorV3(ethUsdFeed_).decimals();
        if (decimals_ > 18) revert InvalidConfiguration();

        gangster = gangster_;
        weth = weth_;
        pool = configuredPool;
        ethUsdFeed = IAggregatorV3(ethUsdFeed_);
        twapWindow = twapWindow_;
        maxFeedAge = maxFeedAge_;
        minimumLiquidity = minimumLiquidity_;
        maximumTickDeviation = maximumTickDeviation_;
        feedDecimals = decimals_;
    }

    /// @notice Expands the pool's observation ring buffer. Anyone may safely call this once.
    ///         The configured TWAP window must then elapse before price reads can succeed.
    function preparePoolOracle(uint16 observationCardinalityNext) external {
        if (observationCardinalityNext < 16) revert InvalidConfiguration();
        pool.increaseObservationCardinalityNext(observationCardinalityNext);
    }

    function ethUsdPrice() public view returns (uint256 priceE18, uint256 updatedAt) {
        (uint80 roundId, int256 answer,, uint256 feedUpdatedAt, uint80 answeredInRound) =
            ethUsdFeed.latestRoundData();
        if (answer <= 0 || feedUpdatedAt == 0 || answeredInRound < roundId) revert InvalidFeedAnswer();
        if (feedUpdatedAt > block.timestamp || block.timestamp - feedUpdatedAt > maxFeedAge) {
            revert StaleFeed(feedUpdatedAt);
        }

        priceE18 = uint256(answer) * (10 ** (18 - feedDecimals));
        updatedAt = feedUpdatedAt;
    }

    function gangsterUsdPrice() public view returns (uint256 priceE18, uint256 feedUpdatedAt) {
        (int24 arithmeticMeanTick, uint128 harmonicMeanLiquidity) = _consult();
        if (harmonicMeanLiquidity < minimumLiquidity) {
            revert InsufficientPoolLiquidity(harmonicMeanLiquidity, minimumLiquidity);
        }

        (, int24 spotTick,, uint16 observationCardinality, uint16 observationCardinalityNext,,) =
            pool.slot0();
        if (observationCardinalityNext < 16) {
            revert InsufficientObservationCardinality(observationCardinality, 16);
        }
        uint256 deviation = spotTick >= arithmeticMeanTick
            ? uint256(uint24(spotTick - arithmeticMeanTick))
            : uint256(uint24(arithmeticMeanTick - spotTick));
        if (deviation > maximumTickDeviation) {
            revert PriceDeviationTooHigh(spotTick, arithmeticMeanTick);
        }

        uint256 wethPerGangster = _quoteAtTick(arithmeticMeanTick, 1 ether, gangster, weth);
        (uint256 currentEthUsd, uint256 updatedAt) = ethUsdPrice();
        priceE18 = FullMath.mulDiv(wethPerGangster, currentEthUsd, 1 ether);
        if (priceE18 == 0) revert ZeroPrice();
        feedUpdatedAt = updatedAt;
    }

    function quoteGangsterForUsd(uint256 usdAmountE18) external view returns (uint256 tokenAmount) {
        (uint256 priceE18,) = gangsterUsdPrice();
        tokenAmount = FullMath.mulDivRoundingUp(usdAmountE18, 1 ether, priceE18);
    }

    function quoteEthForUsd(uint256 usdAmountE18) external view returns (uint256 ethAmount) {
        (uint256 currentEthUsd,) = ethUsdPrice();
        ethAmount = FullMath.mulDivRoundingUp(usdAmountE18, 1 ether, currentEthUsd);
    }

    function _consult() internal view returns (int24 arithmeticMeanTick, uint128 harmonicMeanLiquidity) {
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = twapWindow;
        secondsAgos[1] = 0;
        (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) =
            pool.observe(secondsAgos);

        int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
        int56 window = int56(uint56(twapWindow));
        arithmeticMeanTick = int24(tickDelta / window);
        if (tickDelta < 0 && (tickDelta % window != 0)) arithmeticMeanTick--;

        uint160 secondsPerLiquidityDelta =
            secondsPerLiquidityCumulativeX128s[1] - secondsPerLiquidityCumulativeX128s[0];
        if (secondsPerLiquidityDelta == 0) revert ZeroPrice();
        uint192 secondsAgoX160 = uint192(twapWindow) * type(uint160).max;
        harmonicMeanLiquidity =
            uint128(secondsAgoX160 / (uint192(secondsPerLiquidityDelta) << 32));
    }

    function _quoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken)
        internal
        pure
        returns (uint256 quoteAmount)
    {
        uint160 sqrtRatioX96 = TickMath.getSqrtPriceAtTick(tick);

        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192)
                : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX128, baseAmount, 1 << 128)
                : FullMath.mulDiv(1 << 128, baseAmount, ratioX128);
        }
    }
}
