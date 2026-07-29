"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

export function PlayerTracker() {
  const { address, isConnected } = useAccount();
  const lastTrackedWallet = useRef("");

  useEffect(() => {
    const referralCode = new URLSearchParams(window.location.search).get("ref");
    if (referralCode) window.localStorage.setItem("hoodatm_referral_code", referralCode);
  }, []);

  useEffect(() => {
    if (!isConnected || !address || lastTrackedWallet.current === address.toLowerCase()) return;
    lastTrackedWallet.current = address.toLowerCase();
    const gangsterUsername = window.localStorage.getItem("hoodatm_username");
    const referralCode = window.localStorage.getItem("hoodatm_referral_code");
    void fetch("/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address, gangsterUsername, referralCode }),
    });
  }, [address, isConnected]);

  return null;
}
