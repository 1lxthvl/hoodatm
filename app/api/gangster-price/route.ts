import { createPublicClient, http } from "viem";
import { robinhoodChain } from "../../lib/robinhood-chain";
import {
  CHAINLINK_ETH_USD_ADDRESS,
  GANGSTER_WETH_POOL_ADDRESS,
  TWAP_WINDOW_SECONDS,
} from "../../lib/gangster-economy";

export const dynamic = "force-dynamic";

const poolAbi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "observe",
    stateMutability: "view",
    inputs: [{ name: "secondsAgos", type: "uint32[]" }],
    outputs: [
      { name: "tickCumulatives", type: "int56[]" },
      { name: "secondsPerLiquidityCumulativeX128s", type: "uint160[]" },
    ],
  },
] as const;

const feedAbi = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

function priceFromTick(tick: number, ethUsd: number) {
  const gangsterPerWeth = Math.pow(1.0001, tick);
  return ethUsd / gangsterPerWeth;
}

export async function GET() {
  try {
    const client = createPublicClient({
      chain: robinhoodChain,
      transport: http(process.env.ROBINHOOD_MAINNET_RPC_URL || robinhoodChain.rpcUrls.default.http[0]),
    });

    const [slot0, feed] = await Promise.all([
      client.readContract({
        address: GANGSTER_WETH_POOL_ADDRESS,
        abi: poolAbi,
        functionName: "slot0",
      }),
      client.readContract({
        address: CHAINLINK_ETH_USD_ADDRESS,
        abi: feedAbi,
        functionName: "latestRoundData",
      }),
    ]);

    const [, spotTick,, observationCardinality, observationCardinalityNext] = slot0;
    const [roundId, answer,,, answeredInRound] = feed;
    const feedUpdatedAt = feed[3];
    const now = Math.floor(Date.now() / 1000);
    if (answer <= BigInt(0) || feedUpdatedAt === BigInt(0) || answeredInRound < roundId || Number(feedUpdatedAt) > now) {
      throw new Error("Invalid ETH/USD oracle response");
    }

    const ethUsd = Number(answer) / 1e8;
    let pricingTick = Number(spotTick);
    let pricingMode: "twap" | "spot" = "spot";

    try {
      const [tickCumulatives] = await client.readContract({
        address: GANGSTER_WETH_POOL_ADDRESS,
        abi: poolAbi,
        functionName: "observe",
        args: [[TWAP_WINDOW_SECONDS, 0]],
      });
      const delta = tickCumulatives[1] - tickCumulatives[0];
      const window = BigInt(TWAP_WINDOW_SECONDS);
      let meanTick = delta / window;
      if (delta < BigInt(0) && delta % window !== BigInt(0)) meanTick -= BigInt(1);
      pricingTick = Number(meanTick);
      pricingMode = "twap";
    } catch {
      // The Pons pool starts with one observation. Spot is display-only while its TWAP buffer warms up.
    }

    const gangsterUsd = priceFromTick(pricingTick, ethUsd);
    if (!Number.isFinite(gangsterUsd) || gangsterUsd <= 0) throw new Error("Invalid GANGSTER market price");

    return Response.json(
      {
        gangsterUsd,
        ethUsd,
        updatedAt: new Date().toISOString(),
        feedUpdatedAt: new Date(Number(feedUpdatedAt) * 1000).toISOString(),
        pricingMode,
        oracleReady: pricingMode === "twap" && Number(observationCardinalityNext) >= 16,
        observationCardinality: Number(observationCardinality),
        observationCardinalityNext: Number(observationCardinalityNext),
        source: "Pons GANGSTER/WETH pool + Chainlink ETH/USD",
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price unavailable";
    return Response.json(
      { error: "Live GANGSTER pricing is temporarily unavailable.", detail: message },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
