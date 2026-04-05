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
  // Use createStorage without custom storage — wagmi handles SSR gracefully
  // by falling back to in-memory storage on the server and localStorage on the client
});

// Re-export the wagmi config from adapter
export const config = wagmiAdapter.wagmiConfig;
