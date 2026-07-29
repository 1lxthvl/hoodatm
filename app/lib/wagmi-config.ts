import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, rabbyWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { robinhoodChain, robinhoodChainTestnet } from "./robinhood-chain";

const chains = [robinhoodChainTestnet, robinhoodChain] as const;
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const supportedWallets = [
  metaMaskWallet,
  rabbyWallet,
  injectedWallet,
  ...(walletConnectProjectId ? [walletConnectWallet] : []),
];
const connectors = connectorsForWallets(
  [
    {
      groupName: "Robinhood Chain wallets",
      wallets: supportedWallets,
    },
  ],
  {
    appName: "hoodATM",
    appDescription: "On-chain gangster game on Robinhood Chain",
    appUrl: "https://hoodatm.online",
    projectId: walletConnectProjectId || "hoodatm-injected-wallets-only",
  },
);

export const wagmiConfig = createConfig({
  chains,
  connectors,
  transports: {
    [robinhoodChain.id]: http(robinhoodChain.rpcUrls.default.http[0]),
    [robinhoodChainTestnet.id]: http(robinhoodChainTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});
