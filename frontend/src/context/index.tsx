"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { ReactNode, useState, useEffect, useRef, createContext, useContext } from "react";
import { config, wagmiAdapter } from "@/config/wagmiAdapter";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/config";
import { zgTestnet, projectId } from "@/config/wagmi";

// ===== Network Context =====

export type NetworkType = "standard" | "turbo";

interface NetworkContextType {
  networkType: NetworkType;
  setNetworkType: React.Dispatch<React.SetStateAction<NetworkType>>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}

// ===== Main Provider =====

export function ContextProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [networkType, setNetworkType] = useState<NetworkType>("turbo");
  const initialized = useRef(false);
  const appkitInitialized = useRef(false);

  // Initialize Reown AppKit (client-side only)
  useEffect(() => {
    if (appkitInitialized.current) return;
    appkitInitialized.current = true;

    // Dynamic import to avoid SSR issues
    import("@reown/appkit/react").then(({ createAppKit }) => {
      createAppKit({
        adapters: [wagmiAdapter],
        projectId,
        networks: [zgTestnet],
        defaultNetwork: zgTestnet,
        metadata: {
          name: APP_NAME,
          description: APP_DESCRIPTION,
          url: typeof window !== "undefined" ? window.location.origin : "https://ai-memory-vault.app",
          icons: ["/favicon.ico"],
        },
        // Allow connecting even if MetaMask is on a different chain
        allowUnsupportedChain: true,
        // Enable both injected wallets (MetaMask etc.) and WalletConnect
        enableEIP6963: true,
        enableWalletConnect: true,
        // Disable Coinbase smart wallet to reduce noise
        enableCoinbase: false,
        themeMode: "dark",
        features: {
          analytics: true,
          swaps: false,
          onramp: false,
          email: false,
          socials: undefined,
          history: false,
          allWallets: true,
        },
      });
    }).catch(console.error);
  }, []);

  // Restore networkType from localStorage
  useEffect(() => {
    if (initialized.current) return;
    const timer = setTimeout(() => {
      const saved = localStorage.getItem("networkType") as NetworkType | null;
      if (saved) setNetworkType(saved);
      initialized.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Persist networkType to localStorage
  useEffect(() => {
    if (!initialized.current) return;
    localStorage.setItem("networkType", networkType);
  }, [networkType]);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <NetworkContext.Provider value={{ networkType, setNetworkType }}>
          {children}
        </NetworkContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
