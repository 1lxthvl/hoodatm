import {
  GANGSTER_TOKEN_ADDRESS,
  GANGSTER_TOKEN_DECIMALS,
  GANGSTER_TOKEN_IMAGE_PATH,
  GANGSTER_TOKEN_SYMBOL,
} from "./gangster-economy";

type WatchAssetRequest = {
  method: "wallet_watchAsset";
  params: {
    type: "ERC20";
    options: {
      address: string;
      symbol: string;
      decimals: number;
      image?: string;
    };
  };
};

type EthereumProvider = {
  request: (args: WatchAssetRequest) => Promise<boolean>;
};

function resolveTokenImageUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${GANGSTER_TOKEN_IMAGE_PATH}`;
}

export async function addGangsterTokenToWallet(
  request?: (args: WatchAssetRequest) => Promise<unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const image = resolveTokenImageUrl();
  const payload: WatchAssetRequest = {
    method: "wallet_watchAsset",
    params: {
      type: "ERC20",
      options: {
        address: GANGSTER_TOKEN_ADDRESS,
        symbol: GANGSTER_TOKEN_SYMBOL,
        decimals: GANGSTER_TOKEN_DECIMALS,
        ...(image ? { image } : {}),
      },
    },
  };

  try {
    if (request) {
      await request(payload);
      return { ok: true };
    }

    const ethereum = (window as Window & { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum?.request) {
      return { ok: false, error: "Connect a wallet that supports adding tokens." };
    }

    await ethereum.request(payload);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet rejected adding $GANGSTER.";
    return { ok: false, error: message };
  }
}
