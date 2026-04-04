"use client";

import { http, createStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { zgTestnet, projectId } from "@/config/wagmi";

// Create wagmi adapter for Reown AppKit
export const wagmiAdapter = new WagmiAdapter({
  networks: [zgTestnet],
  projectId,
  transports: {
    [zgTestnet.id]: http(),
  },
  ssr: true,
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  }),
});

// Re-export the wagmi config from adapter
export const config = wagmiAdapter.wagmiConfig;
