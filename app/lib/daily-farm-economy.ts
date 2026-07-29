export const DAILY_BASE_FARM_MIN_USD = 5;
export const DAILY_BASE_FARM_MAX_USD = 10;
export const GANGSTER_SPEND_FARM_SHARE = 0.25;

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_RANGE_CENTS =
  (DAILY_BASE_FARM_MAX_USD - DAILY_BASE_FARM_MIN_USD) * 100;

export function getDailyBaseFarmPoolUsd(timestamp: number) {
  const utcDay = Math.max(0, Math.floor(timestamp / DAY_MS));
  const mixed = Math.imul(utcDay ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  const cents = mixed % (DAILY_RANGE_CENTS + 1);
  return DAILY_BASE_FARM_MIN_USD + cents / 100;
}
