import { defineChain } from "viem";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL || "https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Robinhood Chain Explorer", url: "https://robinhoodchain.blockscout.com" },
  },
});

export const robinhoodChainTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Test Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL || "https://rpc.testnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Robinhood Chain Testnet Explorer", url: "https://explorer.testnet.chain.robinhood.com" },
  },
  testnet: true,
});

export const hoodAtmChain =
  process.env.NEXT_PUBLIC_ROBINHOOD_NETWORK === "testnet"
    ? robinhoodChainTestnet
    : robinhoodChain;

export const hoodAtmGameAbi = [
  {
    type: "function",
    name: "players",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "joined", type: "bool" },
      { name: "tier", type: "uint8" },
      { name: "power", type: "uint32" },
      { name: "directReferrals", type: "uint32" },
      { name: "unclaimed", type: "uint256" },
      { name: "rewardDebt", type: "uint256" },
      { name: "lifetimeEarned", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "pendingRewards",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimedBalance",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "actionNonces",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claimQuote",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "gross", type: "uint256" },
      { name: "burned", type: "uint256" },
      { name: "atmFee", type: "uint256" },
      { name: "bonus", type: "uint256" },
      { name: "feeBps", type: "uint16" },
      { name: "bonusBps", type: "uint16" },
      { name: "nextClaimAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "withdrawalQuote",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "grossLimit", type: "uint256" },
      { name: "averageHeld24h", type: "uint256" },
      { name: "nextWithdrawalAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "codeGrantedGangster",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "paidGangster",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "gangsterSlots",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "codeBonusSlotGranted",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "spendingFarmPoolContributed",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "activePurchasedGangsters",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "dailyBaseFarmUsd",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "atmWinChance",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "atmIndex", type: "uint8" },
    ],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    type: "function",
    name: "layLow",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "earningMultiplierBps",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "currentHeat",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "snitchCost",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "commitSnitch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "commitment", type: "bytes32" },
      { name: "maxGangsterAmount", type: "uint256" },
    ],
    outputs: [{ name: "requestId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "jailItemCost",
    stateMutability: "view",
    inputs: [{ name: "item", type: "uint8" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "commitJailPurchase",
    stateMutability: "nonpayable",
    inputs: [
      { name: "item", type: "uint8" },
      { name: "commitment", type: "bytes32" },
      { name: "maxGangsterAmount", type: "uint256" },
    ],
    outputs: [{ name: "requestId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "commitPhoneHit",
    stateMutability: "nonpayable",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [{ name: "requestId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "setUsername",
    stateMutability: "nonpayable",
    inputs: [{ name: "username", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveReferralCode",
    stateMutability: "view",
    inputs: [{ name: "username", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "commitPlayerRobbery",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "commitment", type: "bytes32" },
    ],
    outputs: [{ name: "requestId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "commitATMHit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "atmIndex", type: "uint8" },
      { name: "commitment", type: "bytes32" },
    ],
    outputs: [{ name: "requestId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "revealAction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "secret", type: "bytes32" },
      { name: "randomWord", type: "uint256" },
      { name: "deadline", type: "uint64" },
      { name: "resolverSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "join",
    stateMutability: "payable",
    inputs: [{ name: "referrer", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "requiredGangsterHold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "requiredJoinEth",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteTierUpgrade",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "targetTier", type: "uint8" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const hoodAtmGangAbi = [
  {
    type: "function",
    name: "creationCost",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "jailbreakCost",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createGang",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "tag", type: "string" },
      { name: "maxGangsterAmount", type: "uint256" },
    ],
    outputs: [{ name: "gangId", type: "uint256" }],
  },
  {
    type: "function",
    name: "inviteMember",
    stateMutability: "nonpayable",
    inputs: [{ name: "member", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "acceptInvitation",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "setMemberRank",
    stateMutability: "nonpayable",
    inputs: [
      { name: "member", type: "address" },
      { name: "rank", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "commitJailbreak",
    stateMutability: "nonpayable",
    inputs: [
      { name: "inmate", type: "address" },
      { name: "commitment", type: "bytes32" },
      { name: "maxGangsterAmount", type: "uint256" },
    ],
    outputs: [{ name: "requestId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "revealJailbreak",
    stateMutability: "nonpayable",
    inputs: [
      { name: "secret", type: "bytes32" },
      { name: "randomWord", type: "uint256" },
      { name: "deadline", type: "uint64" },
      { name: "resolverSignature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;
