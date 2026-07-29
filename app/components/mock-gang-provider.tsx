"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { Address, isAddress } from "viem";
import { wagmiConfig } from "../lib/wagmi-config";
import { hoodAtmChain, hoodAtmGameAbi } from "../lib/robinhood-chain";
import { getClaimTerms, type ClaimTerms } from "../lib/claim-economy";
import {
  GANGSTER_SPEND_FARM_SHARE,
  getDailyBaseFarmPoolUsd,
} from "../lib/daily-farm-economy";
import { useGangsterPrice } from "./gangster-price-provider";

export type GangMember = {
  id: string;
  name: string;
  handle: string;
  rank: "Civilian" | "Hoodlum" | "Captain" | "General" | "OG";
  power: number;
  earned: number;
  unclaimed: number;
  claimed: number;
};

export type ActiveGangster = {
  character: Exclude<GangMember["rank"], "Civilian">;
  earningRate: number;
  code: string | null;
};

export type RobProfile = {
  chance: number;
  label: string;
  lossRate: number;
  stealRate: number;
  note: string;
};

export type AtmTarget = {
  id: string;
  name: string;
  tier: "low" | "medium" | "high" | "very-high";
  chance: number;
  rewardUsd: number;
  lossUsd: number;
};

type RobResult = {
  target: string;
  won: boolean;
  amount: number;
  bonusAmount: number;
  chance: number;
};

type ClaimResult = {
  gross: number;
  burned: number;
  fee: number;
  bonus: number;
  received: number;
  feeBps: number;
  bonusBps: number;
  heldHours: number;
  nextClaimAt: number;
  atmPoolAllocations: [number, number, number, number];
};

type BalanceTransferResult = {
  gross: number;
  burned: number;
  received: number;
};

export type GangActivity = {
  id: string;
  type: "claim" | "robbery" | "hustle" | "snitch";
  title: string;
  detail: string;
  amount: number;
  burned?: number;
  outcome?: "success" | "failed";
  time: string;
};

export type GangRank = "Boss" | "Underboss" | "Enforcer" | "Member";

export type PlayerGang = {
  name: string;
  tag: string;
  ownerId: string;
  members: Array<{
    playerId: string;
    rank: GangRank;
    joinedAt: number;
  }>;
};

type MockGangContextValue = {
  players: GangMember[];
  currentPlayer: GangMember;
  qualifiedReferrals: number;
  robberyBonusRate: number;
  cooldowns: Record<string, number>;
  atmCooldowns: Record<string, number>;
  burnedTotal: number;
  activities: GangActivity[];
  lastRob: RobResult | null;
  lastClaim: ClaimResult | null;
  lastWithdrawal: BalanceTransferResult | null;
  contractConfigured: boolean;
  pendingAction: string | null;
  transactionHash: `0x${string}` | null;
  transactionError: string | null;
  averageHeld24h: number;
  withdrawalGrossLimit: number;
  withdrawalAvailableAt: number;
  dailyFarmPoolUsd: number;
  dailyBaseFarmPoolUsd: number;
  spendingFarmPoolUsd: number;
  effectivePowerShare: number;
  idleRewardPerHour: number;
  heatLevel: number;
  heatMultiplier: number;
  isHustling: boolean;
  hustleStartedAt: number;
  hustleAccumulatedMs: number;
  hustleStatePending: boolean;
  claimAvailableAt: number;
  claimTerms: ClaimTerms;
  atmPoolContributions: [number, number, number, number];
  layingLowUntil: number;
  jailedUntil: Record<string, number>;
  claimLockedUntil: Record<string, number>;
  snitchOpportunity: { attackerId: string; attacker: string; attackerPower: number; loot: number } | null;
  lastSnitch: { attacker: string; jailed: boolean; cost: number } | null;
  snitchCostTokens: number;
  jailPhones: number;
  jailPhoneCostTokens: number;
  lastJailPurchase: { outcome: "delivered" | "caught" | "failed"; cost: number } | null;
  phoneHitOpportunity: { target: string; originalLoot: number; occurredAt: number } | null;
  lastPhoneHit: { won: boolean; recovered: number; ratio: number } | null;
  gang: PlayerGang | null;
  gangCreationCostTokens: number;
  gangCreationFree: boolean;
  gangJailbreakCostTokens: number;
  lastGangJailbreak: { memberName: string; freed: boolean; cost: number } | null;
  gangsterSlots: number;
  activeGangsters: ActiveGangster[];
  nextGangsterSlotCostUsd: number;
  nextGangsterSlotCostTokens: number;
  crewActive: boolean;
  slotUnlockError: string | null;
  claimEarnings: () => Promise<void>;
  withdrawBalance: () => Promise<void>;
  robPlayer: (targetId: string) => Promise<void>;
  robAtm: (targetId: string) => Promise<void>;
  addIdleEarnings: (amount: number) => void;
  startHustling: () => Promise<void>;
  layLow: () => Promise<void>;
  snitch: () => void;
  buyJailPhone: () => void;
  callGangMember: () => void;
  createGang: (name: string, tag: string) => boolean;
  updateGangRank: (playerId: string, rank: GangRank) => void;
  attemptGangJailbreak: (playerId: string) => void;
  unlockGangsterSlot: () => Promise<boolean>;
};

const SIX_HOURS = 6 * 60 * 60 * 1000;
const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const CURRENT_PLAYER_ID = "hoodrunner";
const MOCK_QUALIFIED_REFERRALS = 0;
const MOCK_AVERAGE_HELD_24H = 0;
const SNITCH_COST_USD = 1;
const GANG_CREATION_COST_USD = 10;
const FIRST_EXTRA_GANGSTER_SLOT_USD = 10;
const GANG_JAILBREAK_COST_USD = 2;
const THREE_HOURS = 3 * 60 * 60 * 1000;
const characterPower: Record<Exclude<GangMember["rank"], "Civilian">, number> = {
  Hoodlum: 5,
  Captain: 30,
  General: 135,
  OG: 750,
};

export const atmTargets: AtmTarget[] = [
  { id: "corner-atm", name: "Corner Store ATM", tier: "low", chance: 70, rewardUsd: 0.004, lossUsd: 0.001 },
  { id: "club-atm", name: "Nightclub ATM", tier: "medium", chance: 50, rewardUsd: 0.01, lossUsd: 0.003 },
  { id: "casino-atm", name: "Casino Floor ATM", tier: "high", chance: 30, rewardUsd: 0.025, lossUsd: 0.007 },
  { id: "vault-atm", name: "Downtown Vault ATM", tier: "very-high", chance: 15, rewardUsd: 0.075, lossUsd: 0.02 },
];

const ATM_CIVILIAN_CHANCES = [0.7, 0.05, 0.0105, 0.0015] as const;

export function getAtmChance(power: number, atmIndex: number) {
  const target = atmTargets[atmIndex];
  const civilianChance = ATM_CIVILIAN_CHANCES[atmIndex];
  if (!target || civilianChance === undefined) return 0;
  return Math.min(target.chance, civilianChance * Math.max(1, power));
}

export function farmingWeight(player: Pick<GangMember, "rank" | "power">) {
  const balanceMultiplier = player.rank === "Civilian" || player.rank === "Hoodlum"
    ? 1.5
    : player.rank === "General" ? 0.63
      : player.rank === "OG" ? 0.8 : 1;
  return player.power * balanceMultiplier;
}

const initialPlayers: GangMember[] = [
  { id: CURRENT_PLAYER_ID, name: "Connected player", handle: "Username not registered", rank: "Civilian", power: 1, earned: 0, unclaimed: 0, claimed: 0 },
];

const initialActivities: GangActivity[] = [];

export function getRobProfile(attackerPower: number, targetPower: number): RobProfile {
  if (targetPower === attackerPower) {
    return { chance: 50, label: "Even fight", lossRate: 0.12, stealRate: 0.12, note: "Same power means a clean 50/50 hit." };
  }

  if (targetPower > attackerPower) {
    const ratio = targetPower / Math.max(attackerPower, 1);
    if (ratio <= 1.5) return { chance: 25, label: "Punching up", lossRate: 0.08, stealRate: 0.18, note: "A stronger target with a 25% success chance." };
    if (ratio <= 2.5) return { chance: 18, label: "High risk", lossRate: 0.08, stealRate: 0.18, note: "A major power gap drops the hit to 18%." };
    return { chance: 10, label: "Long shot", lossRate: 0.08, stealRate: 0.18, note: "Elite targets bottom out at a 10% success chance." };
  }

  if (targetPower === 0) {
    return { chance: 70, label: "Powerless bait", lossRate: 0.25, stealRate: 0.04, note: "Almost no loot. Failure costs 25% of your unclaimed balance." };
  }

  if (targetPower <= attackerPower * 0.25) {
    return { chance: 65, label: "Bad target", lossRate: 0.25, stealRate: 0.05, note: "Small upside. Failure costs 25% of your unclaimed balance." };
  }

  return { chance: 58, label: "Low-value hit", lossRate: 0.2, stealRate: 0.08, note: "Lower power means less loot and a 20% failure penalty." };
}

const MockGangContext = createContext<MockGangContextValue | null>(null);

export function MockGangProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState(initialPlayers);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [atmCooldowns, setAtmCooldowns] = useState<Record<string, number>>({});
  const [burnedTotal, setBurnedTotal] = useState(0);
  const [activities, setActivities] = useState<GangActivity[]>(initialActivities);
  const [lastRob, setLastRob] = useState<RobResult | null>(null);
  const [lastClaim, setLastClaim] = useState<ClaimResult | null>(null);
  const [lastWithdrawal, setLastWithdrawal] = useState<BalanceTransferResult | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [withdrawalAvailableAt, setWithdrawalAvailableAt] = useState(0);
  const [heatLevel, setHeatLevel] = useState(0);
  const [isHustling, setIsHustling] = useState(false);
  const [hustleStartedAt, setHustleStartedAt] = useState(0);
  const [hustleAccumulatedMs, setHustleAccumulatedMs] = useState(0);
  const [hustleStatePending, setHustleStatePending] = useState(false);
  const [claimAvailableAt, setClaimAvailableAt] = useState(0);
  const [unclaimedSince, setUnclaimedSince] = useState(0);
  const [atmPoolContributions, setAtmPoolContributions] = useState<
    [number, number, number, number]
  >([0, 0, 0, 0]);
  const [spendingFarmPoolTokens, setSpendingFarmPoolTokens] = useState(0);
  const [jailedUntil, setJailedUntil] = useState<Record<string, number>>({});
  const [claimLockedUntil, setClaimLockedUntil] = useState<Record<string, number>>({});
  const [snitchOpportunity, setSnitchOpportunity] = useState<MockGangContextValue["snitchOpportunity"]>(null);
  const [lastSnitch, setLastSnitch] = useState<MockGangContextValue["lastSnitch"]>(null);
  const [jailPhones, setJailPhones] = useState(0);
  const [lastJailPurchase, setLastJailPurchase] = useState<MockGangContextValue["lastJailPurchase"]>(null);
  const [phoneHitOpportunity, setPhoneHitOpportunity] = useState<MockGangContextValue["phoneHitOpportunity"]>(null);
  const [lastPhoneHit, setLastPhoneHit] = useState<MockGangContextValue["lastPhoneHit"]>(null);
  const [gang, setGang] = useState<PlayerGang | null>(null);
  const [lastGangJailbreak, setLastGangJailbreak] = useState<MockGangContextValue["lastGangJailbreak"]>(null);
  const [characterEarningRate, setCharacterEarningRate] = useState(100);
  const [gangsterSlots, setGangsterSlots] = useState(1);
  const [activeGangsters, setActiveGangsters] = useState<ActiveGangster[]>([]);
  const [slotUnlockError, setSlotUnlockError] = useState<string | null>(null);
  const [qualifiedReferrals, setQualifiedReferrals] = useState(MOCK_QUALIFIED_REFERRALS);
  const [currentTime, setCurrentTime] = useState(0);
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { price } = useGangsterPrice();

  const configuredAddress = process.env.NEXT_PUBLIC_HOODATM_GAME_ADDRESS;
  const contractConfigured = Boolean(configuredAddress && isAddress(configuredAddress));
  const gameAddress = contractConfigured ? configuredAddress as Address : null;
  const gameLive = process.env.NEXT_PUBLIC_GAME_LIVE === "true";

  const currentPlayer = players.find((player) => player.id === CURRENT_PLAYER_ID) ?? initialPlayers[0];
  const totalFarmingWeight = players.reduce((total, player) => total + farmingWeight(player), 0);
  const effectivePowerShare = totalFarmingWeight ? farmingWeight(currentPlayer) / totalFarmingWeight : 0;
  const heatMultiplier = !isHustling || (jailedUntil[CURRENT_PLAYER_ID] ?? 0) > currentTime
    ? 0
    : Math.max(0, 1 - Math.floor(heatLevel / 3) / 100);
  const layingLowUntil = isHustling ? 0 : Number.MAX_SAFE_INTEGER;
  const dailyBaseFarmPoolUsd = getDailyBaseFarmPoolUsd(currentTime);
  const spendingFarmPoolUsd = price
    ? spendingFarmPoolTokens * price.gangsterUsd
    : 0;
  const dailyFarmPoolUsd = dailyBaseFarmPoolUsd + spendingFarmPoolUsd;
  const dailyFarmTokens = price
    ? dailyBaseFarmPoolUsd / price.gangsterUsd + spendingFarmPoolTokens
    : 0;
  const idleRewardPerHour =
    (dailyFarmTokens / 24) * effectivePowerShare * heatMultiplier * (characterEarningRate / 100);
  const robberyBonusRate = Math.min(qualifiedReferrals, 10) * 0.025;
  const averageHeld24h = MOCK_AVERAGE_HELD_24H;
  const withdrawalGrossLimit = currentPlayer.claimed < 1
    ? 0
    : Math.min(currentPlayer.claimed * 0.5, averageHeld24h * 0.5);
  const gangCreationCostTokens = price ? GANG_CREATION_COST_USD / price.gangsterUsd : 0;
  const gangJailbreakCostTokens = price ? GANG_JAILBREAK_COST_USD / price.gangsterUsd : 0;
  const gangCreationFree = qualifiedReferrals >= 3;
  const nextGangsterSlotCostUsd =
    FIRST_EXTRA_GANGSTER_SLOT_USD * (2 ** Math.max(0, gangsterSlots - 1));
  const nextGangsterSlotCostTokens = price
    ? nextGangsterSlotCostUsd / price.gangsterUsd
    : 0;
  const crewActive = gangsterSlots >= 3;
  const claimTerms = getClaimTerms(
    unclaimedSince > 0 ? unclaimedSince : null,
    currentTime,
  );

  function routeGangsterSpendToFarmPool(amount: number) {
    if (amount <= 0) return;
    setSpendingFarmPoolTokens(
      (current) => current + amount * GANGSTER_SPEND_FARM_SHARE,
    );
  }

  useEffect(() => {
    let lastAccruedAt = Date.now();

    const interval = window.setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      const elapsed = Math.max(0, now - lastAccruedAt);
      lastAccruedAt = now;
      const accrued = idleRewardPerHour * (elapsed / ONE_HOUR);

      if (accrued <= 0) return;
      setUnclaimedSince((current) => current || Math.max(0, now - elapsed));
      setPlayers((current) => current.map((player) => (
        player.id === CURRENT_PLAYER_ID
          ? {
              ...player,
              earned: player.earned + accrued,
              unclaimed: player.unclaimed + accrued,
            }
          : player
      )));
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [idleRewardPerHour]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isHustling) {
        setHeatLevel((current) => Math.max(0, current - 1));
      } else {
        setHeatLevel((current) => Math.min(100, current + 1));
      }
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [isHustling]);

  useEffect(() => {
    let active = true;
    async function loadHustleState() {
      if (!address) {
        setIsHustling(false);
        setHustleStartedAt(0);
        setHustleAccumulatedMs(0);
        setClaimAvailableAt(0);
        setUnclaimedSince(0);
        setAtmPoolContributions([0, 0, 0, 0]);
        return;
      }
      try {
        const response = await fetch(`/api/hustle?wallet=${encodeURIComponent(address)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const result = await response.json() as {
          hustling: boolean;
          startedAt: string | null;
          accumulatedMs: number;
          earned: number;
          unclaimed: number;
          claimed: number;
          heat: number;
          unclaimedSince: number | null;
          nextClaimAt: number;
          atmPoolContributions: [number, number, number, number];
        };
        if (!active) return;
        setIsHustling(result.hustling);
        setHustleStartedAt(result.startedAt ? new Date(result.startedAt).getTime() : 0);
        setHustleAccumulatedMs(Math.max(0, result.accumulatedMs));
        setHeatLevel(Math.min(100, Math.max(0, result.heat)));
        setClaimAvailableAt(Math.max(0, result.nextClaimAt));
        setUnclaimedSince(Math.max(0, result.unclaimedSince ?? 0));
        setAtmPoolContributions(result.atmPoolContributions ?? [0, 0, 0, 0]);
        setPlayers((current) => current.map((player) => (
          player.id === CURRENT_PLAYER_ID
            ? {
                ...player,
                earned: Math.max(0, result.earned),
                unclaimed: Math.max(0, result.unclaimed),
                claimed: Math.max(0, result.claimed),
              }
            : player
        )));
      } catch {
        // Keep the last confirmed hustle state if the registry is temporarily unavailable.
      }
    }
    void loadHustleState();
    return () => {
      active = false;
    };
  }, [address]);

  useEffect(() => {
    async function loadCharacterGrant() {
      if (!address) {
        setCharacterEarningRate(100);
        setGangsterSlots(1);
        setActiveGangsters([]);
        setPlayers((current) => current.map((player) => (
          player.id === CURRENT_PLAYER_ID
            ? {
                ...player,
                name: "Connected player",
                handle: "Username not registered",
                rank: "Civilian",
                power: 1,
              }
            : player
        )));
        return;
      }
      try {
        const response = await fetch(`/api/character-claim?wallet=${encodeURIComponent(address)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const result = await response.json() as {
          character: Exclude<GangMember["rank"], "Civilian"> | null;
          earningRate: number | null;
          roster?: ActiveGangster[];
          slots?: number;
        };
        const roster = Array.isArray(result.roster)
          ? result.roster
          : result.character
            ? [{
                character: result.character,
                earningRate: result.earningRate ?? 50,
                code: null,
              }]
            : [];
        setGangsterSlots(Math.max(1, result.slots ?? 1, roster.length));
        setActiveGangsters(roster);
        if (roster.length === 0) {
          setCharacterEarningRate(100);
          setPlayers((current) => current.map((player) => (
            player.id === CURRENT_PLAYER_ID
              ? {
                  ...player,
                  name: "Connected player",
                  handle: "Username not registered",
                  rank: "Civilian",
                  power: 1,
                }
              : player
          )));
          return;
        }
        const totalPower = roster.reduce(
          (total, gangster) => total + characterPower[gangster.character],
          0,
        );
        const weightedEarningRate = totalPower
          ? roster.reduce(
              (total, gangster) => (
                total + characterPower[gangster.character] * gangster.earningRate
              ),
              0,
            ) / totalPower
          : 100;
        const primary = [...roster].sort(
          (left, right) => characterPower[right.character] - characterPower[left.character],
        )[0];
        setCharacterEarningRate(weightedEarningRate);
        setPlayers((current) => current.map((player) => (
          player.id === CURRENT_PLAYER_ID
            ? {
                ...player,
                name: roster.length >= 3 ? `${primary.character} Crew` : primary.character,
                handle: roster.length > 1 ? `${roster.length} active gangsters` : "Gang-claimed character",
                rank: primary.character,
                power: totalPower,
              }
            : player
        )));
      } catch {
        // Keep the player's existing state if entitlement lookup is unavailable.
      }
    }

    void loadCharacterGrant();
    window.addEventListener("hoodatm-character-claimed", loadCharacterGrant);
    return () => window.removeEventListener("hoodatm-character-claimed", loadCharacterGrant);
  }, [address]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(async () => {
      if (!address) {
        if (active) setQualifiedReferrals(0);
        return;
      }
      try {
        const response = await fetch(`/api/referrals?wallet=${encodeURIComponent(address)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const result = await response.json() as { referrals?: number };
        if (active) setQualifiedReferrals(Math.max(0, result.referrals ?? 0));
      } catch {
        // Keep the last confirmed count when referral lookup is temporarily unavailable.
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [address]);

  async function unlockGangsterSlot() {
    setSlotUnlockError(null);
    if (!address || !isConnected) {
      setSlotUnlockError("Connect the wallet that owns this account.");
      return false;
    }
    if (nextGangsterSlotCostTokens <= 0) {
      setSlotUnlockError("The live $GANGSTER quote is unavailable.");
      return false;
    }
    if (currentPlayer.claimed < nextGangsterSlotCostTokens) {
      setSlotUnlockError(`You need ${formatGangster(nextGangsterSlotCostTokens)} claimed $GANGSTER.`);
      return false;
    }
    try {
      const response = await fetch("/api/gangster-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, expectedSlots: gangsterSlots }),
      });
      const result = await response.json() as { slots?: number; error?: string };
      if (!response.ok || !result.slots) {
        throw new Error(result.error || "Crew slot unlock failed.");
      }
      const unlockedSlots = result.slots;
      setPlayers((current) => current.map((player) => (
        player.id === CURRENT_PLAYER_ID
          ? { ...player, claimed: player.claimed - nextGangsterSlotCostTokens }
          : player
      )));
      setGangsterSlots(unlockedSlots);
      routeGangsterSpendToFarmPool(nextGangsterSlotCostTokens);
      setActivities((current) => [{
        id: `crew-slot-${Date.now()}`,
        type: "hustle",
        title: unlockedSlots >= 3 ? "Your crew is active" : `Gangster slot ${unlockedSlots} unlocked`,
        detail: `Paid ${formatGangster(nextGangsterSlotCostTokens)} $GANGSTER for another active gangster slot.`,
        amount: nextGangsterSlotCostTokens,
        time: "Just now",
      }, ...current]);
      return true;
    } catch (error) {
      setSlotUnlockError(error instanceof Error ? error.message : "Crew slot unlock failed.");
      return false;
    }
  }

  async function submitOnchainBalanceAction(action: "Claim" | "Withdraw") {
    setTransactionError(null);
    setTransactionHash(null);

    if (!isConnected) {
      setTransactionError("Connect MetaMask or Rabby before submitting an on-chain action.");
      return false;
    }
    if (!gameAddress) {
      setTransactionError("Set NEXT_PUBLIC_HOODATM_GAME_ADDRESS to the deployed Robinhood Chain game contract.");
      return false;
    }

    try {
      setPendingAction(action);
      if (chainId !== hoodAtmChain.id) {
        await switchChainAsync({ chainId: hoodAtmChain.id });
      }

      const hash = await writeContractAsync({
        address: gameAddress,
        abi: hoodAtmGameAbi,
        functionName: action === "Claim" ? "claim" : "withdraw",
        args: [],
        chainId: hoodAtmChain.id,
      });

      setTransactionHash(hash);
      await waitForTransactionReceipt(wagmiConfig, {
        chainId: hoodAtmChain.id,
        hash,
        confirmations: 1,
      });
      setPendingAction(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : "Transaction failed.";
      setTransactionError(message);
      setPendingAction(null);
      return false;
    }
  }

  async function claimEarnings() {
    if (
      !address
      || currentPlayer.unclaimed <= 0
      || (claimLockedUntil[CURRENT_PLAYER_ID] ?? 0) > Date.now()
      || claimAvailableAt > Date.now()
      || pendingAction !== null
    ) return;
    if (
      gameLive
      && contractConfigured
      && !(await submitOnchainBalanceAction("Claim"))
    ) return;
    setPendingAction("Claim");
    setTransactionError(null);
    try {
      const response = await fetch("/api/hustle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, action: "claim" }),
      });
      const result = await response.json() as {
        earned?: number;
        unclaimed?: number;
        claimed?: number;
        heat?: number;
        unclaimedSince?: number | null;
        nextClaimAt?: number;
        atmPoolContributions?: [number, number, number, number];
        claim?: ClaimResult;
        error?: string;
      };
      if (!response.ok || !result.claim) {
        throw new Error(result.error || "Claim failed.");
      }
      setPlayers((current) => current.map((player) => (
        player.id === CURRENT_PLAYER_ID
          ? {
              ...player,
              earned: Math.max(0, result.earned ?? player.earned),
              unclaimed: Math.max(0, result.unclaimed ?? 0),
              claimed: Math.max(0, result.claimed ?? player.claimed),
            }
          : player
      )));
      setHeatLevel(Math.min(100, Math.max(0, result.heat ?? heatLevel)));
      setClaimAvailableAt(Math.max(0, result.nextClaimAt ?? result.claim.nextClaimAt));
      setUnclaimedSince(Math.max(0, result.unclaimedSince ?? 0));
      setAtmPoolContributions(
        result.atmPoolContributions
        ?? atmPoolContributions.map(
          (amount, index) => amount + result.claim!.atmPoolAllocations[index],
        ) as [number, number, number, number],
      );
      setBurnedTotal((total) => total + result.claim!.burned);
      setLastClaim(result.claim);
      setActivities((current) => [{
        id: `claim-${Date.now()}`,
        type: "claim",
        title: "You secured your earnings",
        detail: `Claimed ${formatGangster(result.claim!.gross)}; ${formatGangster(result.claim!.burned)} burned, ${formatGangster(result.claim!.fee)} funded ATM pools, ${formatGangster(result.claim!.bonus)} was added as a wait bonus, and ${formatGangster(result.claim!.received)} moved to your in-game wallet.`,
        amount: result.claim!.received,
        burned: result.claim!.burned,
        time: "Just now",
      }, ...current]);
    } catch (error) {
      setTransactionError(error instanceof Error ? error.message : "Claim failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function withdrawBalance() {
    if (
      currentPlayer.claimed <= 0 || withdrawalAvailableAt > Date.now()
    ) return;
    if (
      gameLive
      && contractConfigured
      && !(await submitOnchainBalanceAction("Withdraw"))
    ) return;

    setPlayers((current) => current.map((player) => {
      if (player.id !== CURRENT_PLAYER_ID || player.claimed <= 0) return player;
      const gross = Math.min(player.claimed * 0.5, averageHeld24h * 0.5);
      const burned = 0;
      const received = gross;
      setLastWithdrawal({ gross, burned, received });
      setActivities((current) => [{
        id: `withdraw-${Date.now()}`,
        type: "claim",
        title: "You withdrew from the game",
        detail: `Withdrew ${formatGangster(received)} from your in-game wallet to your connected wallet.`,
        amount: received,
        time: "Just now",
      }, ...current]);
      return { ...player, claimed: player.claimed - gross };
    }));
    setWithdrawalAvailableAt(Date.now() + TWELVE_HOURS);
  }

  async function robPlayer(targetId: string) {
    const cooldownUntil = cooldowns[targetId] ?? 0;
    if (cooldownUntil > Date.now()) return;
    const target = players.find((player) => player.id === targetId);
    if (!target || target.unclaimed <= 0 || currentPlayer.unclaimed <= 0) return;
    if (targetId === CURRENT_PLAYER_ID && !isHustling) return;
    if (gameLive && contractConfigured) {
      setTransactionError("Player robberies remain locked until the live roster is indexed by verified wallet address.");
      return;
    }

    setPlayers((current) => {
      const attacker = current.find((player) => player.id === CURRENT_PLAYER_ID);
      const target = current.find((player) => player.id === targetId);
      if (!attacker || !target || target.unclaimed <= 0 || attacker.unclaimed <= 0) return current;

      const profile = getRobProfile(attacker.power, target.power);
      const won = Math.random() * 100 < profile.chance;
      const baseAmount = Math.max(1, Math.floor((won ? target.unclaimed * profile.stealRate : attacker.unclaimed * profile.lossRate)));
      const bonusAmount = won ? Math.floor(baseAmount * robberyBonusRate) : 0;
      const amount = baseAmount + bonusAmount;

      setLastRob({ target: target.name, won, amount, bonusAmount, chance: profile.chance });
      if (!won) {
        setClaimLockedUntil((current) => ({ ...current, [targetId]: Date.now() + 30 * 60_000 }));
      }
      setActivities((current) => [{
        id: `rob-${Date.now()}`,
        type: "robbery",
        title: won ? `You robbed ${target.name}` : `Your hit on ${target.name} failed`,
        detail: won
          ? `The robbery succeeded at a ${profile.chance}% chance. Your ${qualifiedReferrals} qualified referrals added a ${robberyBonusRate * 100}% loot bonus (${formatGangster(bonusAmount)} tokens).`
          : `The robbery failed at a ${profile.chance}% chance and cost you unclaimed tokens.`,
        amount,
        outcome: won ? "success" : "failed",
        time: "Just now",
      }, ...current]);
      return current.map((player) => {
        if (won && player.id === CURRENT_PLAYER_ID) return { ...player, unclaimed: player.unclaimed + amount, earned: player.earned + amount };
        if (won && player.id === targetId) return { ...player, unclaimed: Math.max(0, player.unclaimed - amount) };
        if (!won && player.id === CURRENT_PLAYER_ID) return { ...player, unclaimed: Math.max(0, player.unclaimed - amount) };
        if (!won && player.id === targetId) return { ...player, unclaimed: player.unclaimed + amount, earned: player.earned + amount };
        return player;
      });
    });

    setCooldowns((current) => ({ ...current, [targetId]: Date.now() + SIX_HOURS }));
  }

  async function robAtm(targetId: string) {
    const target = atmTargets.find((atm) => atm.id === targetId);
    if (!target || !price || (atmCooldowns[targetId] ?? 0) > Date.now()) return;
    const reward = target.rewardUsd / price.gangsterUsd;
    const loss = target.lossUsd / price.gangsterUsd;
    if (currentPlayer.unclaimed < loss) return;
    if (gameLive) {
      setTransactionError("ATM hits remain locked until the two-transaction commit/reveal interface is enabled.");
      return;
    }

    setPlayers((current) => {
      const attacker = current.find((player) => player.id === CURRENT_PLAYER_ID);
      if (!attacker || attacker.unclaimed < loss) return current;

      const atmIndex = atmTargets.findIndex((atm) => atm.id === targetId);
      const realChance = getAtmChance(attacker.power, atmIndex);
      const won = Math.random() * 100 < realChance;
      const amount = won ? reward : loss;
      if (!won) setBurnedTotal((total) => total + amount);
      setActivities((activity) => [{
        id: `atm-${Date.now()}`,
        type: "robbery",
        title: won ? `You cracked the ${target.name}` : `The ${target.name} hit failed`,
        detail: won
          ? `The ATM robbery succeeded at a ${realChance}% chance and paid jackpot tokens into your unclaimed balance.`
          : `The ATM robbery failed at a ${realChance}% chance and burned the tokens risked on the hit.`,
        amount,
        burned: won ? undefined : amount,
        outcome: won ? "success" : "failed",
        time: "Just now",
      }, ...activity]);

      return current.map((player) => {
        if (player.id !== CURRENT_PLAYER_ID) return player;
        return won
          ? { ...player, earned: player.earned + amount, unclaimed: player.unclaimed + amount }
          : { ...player, unclaimed: Math.max(0, player.unclaimed - amount) };
      });
    });

    setAtmCooldowns((current) => ({ ...current, [targetId]: Date.now() + SIX_HOURS }));
  }

  function addIdleEarnings(amount: number) {
    if (amount <= 0) return;
    setPlayers((current) => current.map((player) => (
      player.id === CURRENT_PLAYER_ID
        ? { ...player, earned: player.earned + amount, unclaimed: player.unclaimed + amount }
        : player
    )));
  }

  async function setHustleAction(action: "start" | "pause") {
    if (!address) {
      setTransactionError("Connect the wallet that owns this game account first.");
      return;
    }
    if (hustleStatePending) return;
    setTransactionError(null);
    setHustleStatePending(true);
    try {
      const response = await fetch("/api/hustle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, action }),
      });
      const result = await response.json() as {
        hustling?: boolean;
        startedAt?: string | null;
        accumulatedMs?: number;
        earned?: number;
        unclaimed?: number;
        claimed?: number;
        heat?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Hustle state update failed.");
      setIsHustling(Boolean(result.hustling));
      setHustleStartedAt(result.startedAt ? new Date(result.startedAt).getTime() : 0);
      setHustleAccumulatedMs(Math.max(0, result.accumulatedMs ?? 0));
      setHeatLevel(Math.min(100, Math.max(0, result.heat ?? 0)));
      setPlayers((current) => current.map((player) => (
        player.id === CURRENT_PLAYER_ID
          ? {
              ...player,
              earned: Math.max(0, result.earned ?? player.earned),
              unclaimed: Math.max(0, result.unclaimed ?? player.unclaimed),
              claimed: Math.max(0, result.claimed ?? player.claimed),
            }
          : player
      )));
      setActivities((current) => [{
        id: `${action === "start" ? "hustle-start" : "lay-low"}-${Date.now()}`,
        type: "hustle",
        title: action === "start" ? "You started hustling" : "You laid low",
        detail: action === "start"
          ? "Idle earnings are active and heat is rising by 1% per minute."
          : `Idle earnings paused while ${heatLevel}% heat cools at 1% per minute.`,
        amount: 0,
        time: "Just now",
      }, ...current]);
    } catch (error) {
      setTransactionError(error instanceof Error ? error.message : "Hustle state update failed.");
    } finally {
      setHustleStatePending(false);
    }
  }

  async function startHustling() {
    if (isHustling) return;
    await setHustleAction("start");
  }

  async function layLow() {
    if (!isHustling) return;
    await setHustleAction("pause");
  }

  function snitch() {
    if (!snitchOpportunity || !price) return;
    const cost = SNITCH_COST_USD / price.gangsterUsd;
    if (currentPlayer.claimed < cost) return;
    const jailed = Math.random() * 100 < 5;
    const opportunity = snitchOpportunity;
    setPlayers((current) => current.map((player) => (
      player.id === CURRENT_PLAYER_ID ? { ...player, claimed: player.claimed - cost } : player
    )));
    routeGangsterSpendToFarmPool(cost);
    if (jailed) {
      setJailedUntil((current) => ({ ...current, [opportunity.attackerId]: Date.now() + THREE_HOURS }));
    }
    setLastSnitch({ attacker: opportunity.attacker, jailed, cost });
    setActivities((current) => [{
      id: `snitch-${Date.now()}`,
      type: "snitch",
      title: jailed ? `${opportunity.attacker} went behind bars` : `The case against ${opportunity.attacker} fell apart`,
      detail: jailed
        ? "The 5% snitch roll landed. Their idle earnings are disabled for 3 hours."
        : "The snitch payment was spent, but the 5% jail roll missed.",
      amount: cost,
      outcome: jailed ? "success" : "failed",
      time: "Just now",
    }, ...current]);
    setSnitchOpportunity(null);
  }

  function buyJailPhone() {
    if (!price || (jailedUntil[CURRENT_PLAYER_ID] ?? 0) <= Date.now()) return;
    const cost = 2 / price.gangsterUsd;
    const roll = Math.random() * 100;
    const outcome = roll < 50 ? "delivered" : roll < 75 ? "caught" : "failed";
    if (currentPlayer.claimed < cost) return;
    setPlayers((current) => current.map((player) => (
      player.id === CURRENT_PLAYER_ID
        ? { ...player, claimed: player.claimed - cost }
        : player
    )));
    routeGangsterSpendToFarmPool(cost);
    if (outcome === "delivered") {
      setJailPhones((current) => current + 1);
      if (snitchOpportunity) {
        setPhoneHitOpportunity({
          target: snitchOpportunity.attacker,
          originalLoot: snitchOpportunity.loot,
          occurredAt: Date.now(),
        });
      }
    }
    if (outcome === "caught") {
      setJailedUntil((current) => {
        const remaining = Math.max(0, (current[CURRENT_PLAYER_ID] ?? 0) - Date.now());
        return { ...current, [CURRENT_PLAYER_ID]: Date.now() + remaining * 2 };
      });
    }
    setLastJailPurchase({ outcome, cost });
    setActivities((current) => [{
      id: `jail-shop-${Date.now()}`,
      type: "hustle",
      title: outcome === "delivered" ? "Phone reached your cell" : outcome === "caught" ? "Guards caught the smuggle" : "Phone delivery failed",
      detail: outcome === "delivered"
        ? "The 50% delivery roll landed."
        : outcome === "caught"
          ? "The 25% caught roll landed and your remaining jail time doubled."
          : "The 25% failure roll landed. Your jail time was unchanged.",
      amount: cost,
      outcome: outcome === "delivered" ? "success" : "failed",
      time: "Just now",
    }, ...current]);
  }

  function callGangMember() {
    if (!phoneHitOpportunity || jailPhones <= 0) return;
    const elapsedMinutes = Math.floor((Date.now() - phoneHitOpportunity.occurredAt) / 60_000);
    const ratio = Math.max(0, 0.8 * (1 - elapsedMinutes / 60));
    const won = Math.random() < 0.5;
    const targetId = players.find((player) => player.name === phoneHitOpportunity.target)?.id;
    if (!targetId) return;
    const targetBalance = players.find((player) => player.id === targetId)?.unclaimed ?? 0;
    const recovered = won ? Math.min(targetBalance, phoneHitOpportunity.originalLoot * ratio) : 0;
    setJailPhones((current) => Math.max(0, current - 1));
    if (won) {
      setPlayers((current) => {
        return current.map((player) => {
          if (player.id === targetId) return { ...player, unclaimed: Math.max(0, player.unclaimed - recovered) };
          if (player.id === CURRENT_PLAYER_ID) return { ...player, earned: player.earned + recovered, unclaimed: player.unclaimed + recovered };
          return player;
        });
      });
    }
    setLastPhoneHit({ won, recovered, ratio });
    setPhoneHitOpportunity(null);
    setActivities((current) => [{
      id: `phone-hit-${Date.now()}`,
      type: "robbery",
      title: won ? "Your gang member landed the jail hit" : "Your jail hit failed",
      detail: won
        ? `The 50/50 roll landed and recovered ${Math.round(ratio * 100)}% of the eligible lost loot.`
        : "The 50/50 retaliation roll failed and the phone was consumed.",
      amount: won ? recovered : 0,
      outcome: won ? "success" : "failed",
      time: "Just now",
    }, ...current]);
  }

  function createGang(name: string, tag: string) {
    const cleanName = name.trim().slice(0, 28);
    const cleanTag = tag.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    if (gang || cleanName.length < 3 || cleanTag.length < 2) return false;
    if (!gangCreationFree) {
      if (gangCreationCostTokens <= 0 || currentPlayer.claimed < gangCreationCostTokens) return false;
      setPlayers((current) => current.map((player) => (
        player.id === CURRENT_PLAYER_ID
          ? { ...player, claimed: player.claimed - gangCreationCostTokens }
          : player
      )));
      routeGangsterSpendToFarmPool(gangCreationCostTokens);
    }
    setGang({
      name: cleanName,
      tag: cleanTag,
      ownerId: CURRENT_PLAYER_ID,
      members: [{ playerId: CURRENT_PLAYER_ID, rank: "Boss", joinedAt: Date.now() }],
    });
    setActivities((current) => [{
      id: `gang-create-${Date.now()}`,
      type: "hustle",
      title: `${cleanName} was formed`,
      detail: gangCreationFree
        ? "The gang creation fee was waived after three qualified referrals."
        : `Paid ${formatGangster(gangCreationCostTokens)} $GANGSTER to create the gang.`,
      amount: gangCreationFree ? 0 : gangCreationCostTokens,
      time: "Just now",
    }, ...current]);
    return true;
  }

  function updateGangRank(playerId: string, rank: GangRank) {
    if (!gang || gang.ownerId !== CURRENT_PLAYER_ID) return;
    setGang((current) => current ? {
      ...current,
      members: current.members.map((member) => (
        member.playerId === playerId ? { ...member, rank } : member
      )),
    } : current);
  }

  function attemptGangJailbreak(playerId: string) {
    if (!gang || !gang.members.some((member) => member.playerId === playerId)) return;
    if ((jailedUntil[playerId] ?? 0) <= Date.now()) return;
    if (gangJailbreakCostTokens <= 0 || currentPlayer.claimed < gangJailbreakCostTokens) return;
    const memberName = players.find((player) => player.id === playerId)?.name ?? "Gang member";
    const freed = Math.random() < 0.25;
    setPlayers((current) => current.map((player) => (
      player.id === CURRENT_PLAYER_ID
        ? { ...player, claimed: player.claimed - gangJailbreakCostTokens }
        : player
    )));
    routeGangsterSpendToFarmPool(gangJailbreakCostTokens);
    if (freed) {
      setJailedUntil((current) => ({ ...current, [playerId]: 0 }));
    }
    setLastGangJailbreak({ memberName, freed, cost: gangJailbreakCostTokens });
    setActivities((current) => [{
      id: `gang-jailbreak-${Date.now()}`,
      type: "hustle",
      title: freed ? `${memberName} was broken out` : `${memberName} remains behind bars`,
      detail: freed
        ? "The same-gang 25% release roll succeeded."
        : "The same-gang 25% release roll failed and the payment was spent.",
      amount: gangJailbreakCostTokens,
      outcome: freed ? "success" : "failed",
      time: "Just now",
    }, ...current]);
  }

  const value = {
    players,
    currentPlayer,
    qualifiedReferrals,
    robberyBonusRate,
    cooldowns,
    atmCooldowns,
    burnedTotal,
    activities,
    lastRob,
    lastClaim,
    lastWithdrawal,
    contractConfigured,
    pendingAction,
    transactionHash,
    transactionError,
    averageHeld24h,
    withdrawalGrossLimit,
    withdrawalAvailableAt,
    dailyFarmPoolUsd,
    dailyBaseFarmPoolUsd,
    spendingFarmPoolUsd,
    effectivePowerShare,
    idleRewardPerHour,
    heatLevel,
    heatMultiplier,
    isHustling,
    hustleStartedAt,
    hustleAccumulatedMs,
    hustleStatePending,
    claimAvailableAt,
    claimTerms,
    atmPoolContributions,
    layingLowUntil,
    jailedUntil,
    claimLockedUntil,
    snitchOpportunity,
    lastSnitch,
    snitchCostTokens: price ? SNITCH_COST_USD / price.gangsterUsd : 0,
    jailPhones,
    jailPhoneCostTokens: price ? 2 / price.gangsterUsd : 0,
    lastJailPurchase,
    phoneHitOpportunity,
    lastPhoneHit,
    gang,
    gangCreationCostTokens,
    gangCreationFree,
    gangJailbreakCostTokens,
    lastGangJailbreak,
    gangsterSlots,
    activeGangsters,
    nextGangsterSlotCostUsd,
    nextGangsterSlotCostTokens,
    crewActive,
    slotUnlockError,
    claimEarnings,
    withdrawBalance,
    robPlayer,
    robAtm,
    addIdleEarnings,
    startHustling,
    layLow,
    snitch,
    buyJailPhone,
    callGangMember,
    createGang,
    updateGangRank,
    attemptGangJailbreak,
    unlockGangsterSlot,
  };

  return <MockGangContext.Provider value={value}>{children}</MockGangContext.Provider>;
}

export function useMockGang() {
  const context = useContext(MockGangContext);
  if (!context) throw new Error("useMockGang must be used inside MockGangProvider");
  return context;
}

export function formatGangster(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
