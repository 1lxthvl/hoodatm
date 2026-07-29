"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function CustomConnectButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        const label = !connected
          ? "GET CHECKED"
          : chain.unsupported
            ? "SWITCH NETWORK"
            : account.displayName;

        return (
          <button
            className="flex items-center gap-2 rounded-full border border-lime-400/40 bg-lime-400/10 px-4 py-2 text-sm font-bold text-lime-100 transition hover:bg-lime-400/20"
            onClick={!connected ? openConnectModal : chain.unsupported ? openChainModal : openAccountModal}
            type="button"
            disabled={!mounted}
          >
            {label}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
