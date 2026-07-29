export const GANGSTER_TOKEN_ADDRESS = "0x6AE32f2620A4a2B55f4Fc4b9e3152c371Aa58EF0" as const;
export const GANGSTER_WETH_POOL_ADDRESS = "0x8D22eb59d73e55c23F8CA4549783B029DD4c7DFb" as const;
export const ROBINHOOD_WETH_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as const;
export const CHAINLINK_ETH_USD_ADDRESS = "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9" as const;
export const HOODATM_TREASURY_ADDRESS = "0x7657d90609046F47215Fc0Fb2BF012c88FF9f700" as const;

export const TWAP_WINDOW_SECONDS = 30 * 60;

export const GANGSTER_USD_COSTS = {
  accessHold: 10,
  tiers: [2.5, 12.5, 50, 250],
  atmRewards: [0.004, 0.01, 0.025, 0.075],
  atmLosses: [0.001, 0.003, 0.007, 0.02],
} as const;

export type GangsterPriceSnapshot = {
  gangsterUsd: number;
  ethUsd: number;
  updatedAt: string;
  feedUpdatedAt: string;
  pricingMode: "twap" | "spot";
  oracleReady: boolean;
  observationCardinality: number;
  observationCardinalityNext: number;
  source: string;
};
