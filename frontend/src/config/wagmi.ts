// 0G Network chain definition + base config
// The actual wagmi config used by the app comes from wagmiAdapter (see wagmiAdapter.ts)

import type { Chain } from "viem";
import { EXPLORER_URL } from "@/lib/config";

export const CHAIN_ID = 16602;
export const CHAIN_NAME = "0G Galileo Testnet";
export const L1_RPC = process.env.NEXT_PUBLIC_L1_RPC || "https://evmrpc-testnet.0g.ai";
export const EXPLORER_URL_OUT = EXPLORER_URL;

export const zgTestnet: Chain = {
  id: CHAIN_ID,
  name: CHAIN_NAME,
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
};

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || "demo";
