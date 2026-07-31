import "server-only";
import {
  createWalletClient,
  http,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hoodAtmChain, hoodAtmGameAbi } from "./robinhood-chain";
import type { GangsterCharacter } from "./player-registry";

const characterTier: Record<GangsterCharacter, number> = {
  Hoodlum: 1,
  Captain: 2,
  General: 3,
  OG: 4,
};

export function tierForCharacter(character: GangsterCharacter | null | undefined) {
  if (!character) return 0;
  return characterTier[character] ?? 0;
}

function granterAccount() {
  const key = process.env.HOODATM_CODE_GRANTER_PRIVATE_KEY?.trim();
  if (!key) return null;
  const normalized = (key.startsWith("0x") ? key : `0x${key}`) as Hex;
  return privateKeyToAccount(normalized);
}

/** Applies an off-chain code/admin grant on-chain. No-ops if granter key is unset. */
export async function markCodeGrantedOnChain(
  wallet: string,
  character: GangsterCharacter | null | undefined,
) {
  const gameAddress = process.env.NEXT_PUBLIC_HOODATM_GAME_ADDRESS;
  if (!gameAddress || !isAddress(gameAddress) || !isAddress(wallet)) {
    return { skipped: true as const, reason: "missing-game-or-wallet" };
  }
  const account = granterAccount();
  if (!account) {
    return { skipped: true as const, reason: "missing-granter-key" };
  }
  const tier = tierForCharacter(character);
  const rpc =
    process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL
    || "https://rpc.mainnet.chain.robinhood.com";
  const client = createWalletClient({
    account,
    chain: hoodAtmChain,
    transport: http(rpc),
  });
  const hash = await client.writeContract({
    address: gameAddress as Address,
    abi: hoodAtmGameAbi,
    functionName: "markCodeGrantedGangster",
    args: [wallet as Address, tier],
  });
  return { skipped: false as const, hash, tier };
}
