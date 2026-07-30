import type { Address, Hex } from "viem";

export type PendingResolverAction = {
  requestId: Hex;
  account: Address;
  contract: Address;
  commitment: Hex;
  secret: Hex;
  kind: "atm" | "robbery" | "snitch" | "jail-purchase" | "phone-hit" | "jailbreak";
  createdAt: number;
};

const STORAGE_KEY = "hoodatm_pending_resolver_actions_v1";

export function readPendingResolverActions(): PendingResolverAction[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function savePendingResolverAction(action: PendingResolverAction) {
  const actions = readPendingResolverActions().filter(
    (candidate) => candidate.requestId !== action.requestId,
  );
  actions.push(action);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
}

export function removePendingResolverAction(requestId: Hex) {
  const actions = readPendingResolverActions().filter(
    (candidate) => candidate.requestId !== requestId,
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
}
