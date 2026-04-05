// 0G Network Configuration
// Centralized config for all 0G services

export const CHAIN_ID = 16602; // 0G Galileo Testnet
export const CHAIN_NAME = "0G Galileo Testnet";

// RPC endpoints
export const L1_RPC = process.env.NEXT_PUBLIC_L1_RPC || "https://evmrpc-testnet.0g.ai";
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://chainscan-galileo.0g.ai";

// 0G Storage
export const STORAGE_RPC_TURBO = process.env.NEXT_PUBLIC_STORAGE_RPC_TURBO || "https://indexer-storage-testnet-turbo.0g.ai";
export const STORAGE_RPC_STANDARD = process.env.NEXT_PUBLIC_STORAGE_RPC_STANDARD || "https://indexer-storage-testnet-standard.0g.ai";

// 0G Storage Flow Contract (Galileo Testnet)
export const FLOW_ADDRESS = process.env.NEXT_PUBLIC_FLOW_ADDRESS || "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296";

// 0G Compute (API endpoints will be configured via broker SDK)
export const COMPUTE_DEFAULT_MODEL = process.env.NEXT_PUBLIC_COMPUTE_MODEL || "qwen-2.5-7b-instruct";

// App metadata
export const APP_NAME = "TrustGate";
export const APP_DESCRIPTION = "Decentralized Escrow & Arbitration Protocol on 0G Network";

// Chain definition for wagmi
export const zgTestnet = {
  id: CHAIN_ID,
  name: CHAIN_NAME,
  network: "0g-galileo-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "OG",
    symbol: "OG",
  },
  rpcUrls: {
    default: {
      http: [L1_RPC],
    },
    public: {
      http: [L1_RPC],
    },
  },
  blockExplorers: {
    default: {
      name: "0G Explorer",
      url: EXPLORER_URL,
    },
  },
} as const;
