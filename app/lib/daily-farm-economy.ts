export const DAILY_BASE_FARM_MIN_USD = 2.5;
export const DAILY_BASE_FARM_MAX_USD = 5;
export const DAILY_BASE_FARM_PURCHASE_BOOST = 0.1;
export const DAILY_BASE_FARM_PURCHASE_CAP = 10;
export const GANGSTER_SPEND_FARM_SHARE = 0.25;

export function getDailyBaseFarmPoolUsd(activePurchasedGangsters: number) {
  const purchased = Math.min(
    DAILY_BASE_FARM_PURCHASE_CAP,
    Math.max(0, Math.floor(activePurchasedGangsters)),
  );
  return Math.min(
    DAILY_BASE_FARM_MAX_USD,
    DAILY_BASE_FARM_MIN_USD
      * (1 + purchased * DAILY_BASE_FARM_PURCHASE_BOOST),
  );
}
