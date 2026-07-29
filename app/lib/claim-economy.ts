export const CLAIM_COOLDOWN_MS = 60 * 60 * 1000;
export const CLAIM_BURN_BPS = 1_000;
export const MAX_CLAIM_FEE_BPS = 2_000;
export const MAX_CLAIM_BONUS_BPS = 2_000;
export const CLAIM_STEP_BPS = 200;
export const CLAIM_FEE_END_HOUR = 10;
export const CLAIM_BONUS_CAP_HOUR = 20;
export const BPS = 10_000;

export const ATM_POOL_WEIGHTS = [1, 2, 4, 18] as const;
export const ATM_POOL_WEIGHT_TOTAL = ATM_POOL_WEIGHTS.reduce(
  (total, weight) => total + weight,
  0,
);

export type ClaimTerms = {
  heldHours: number;
  feeBps: number;
  bonusBps: number;
};

export function getClaimTerms(
  unclaimedSince: number | null,
  now = Date.now(),
): ClaimTerms {
  const heldHours = unclaimedSince === null
    ? 0
    : Math.max(0, Math.floor((now - unclaimedSince) / CLAIM_COOLDOWN_MS));
  const feeBps = Math.max(
    0,
    MAX_CLAIM_FEE_BPS - Math.min(heldHours, CLAIM_FEE_END_HOUR) * CLAIM_STEP_BPS,
  );
  const bonusBps = Math.min(
    MAX_CLAIM_BONUS_BPS,
    Math.max(0, heldHours - CLAIM_FEE_END_HOUR) * CLAIM_STEP_BPS,
  );
  return { heldHours, feeBps, bonusBps };
}

export function splitAtmPoolFee(fee: number): [number, number, number, number] {
  const first = fee * ATM_POOL_WEIGHTS[0] / ATM_POOL_WEIGHT_TOTAL;
  const second = fee * ATM_POOL_WEIGHTS[1] / ATM_POOL_WEIGHT_TOTAL;
  const third = fee * ATM_POOL_WEIGHTS[2] / ATM_POOL_WEIGHT_TOTAL;
  return [
    first,
    second,
    third,
    Math.max(0, fee - first - second - third),
  ];
}
