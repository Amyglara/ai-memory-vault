import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAccount, useConnect, useBalance } from 'wagmi';
import { zgTestnet } from '@/config';

// Types for our wallet context
interface WalletContextType {
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isHydrated: boolean;
  balance: {
    formatted: string | undefined;
    symbol: string | undefined;
    loading: boolean;
  };
  connect: () => void;
}

// Create the context with a default value
const WalletContext = createContext<WalletContextType>({
  address: undefined,
  isConnected: false,
  isConnecting: false,
  isHydrated: false,
  balance: {
    formatted: undefined,
    symbol: undefined,
    loading: true,
  },
  connect: () => {},
});

// Hook to use the wallet context
export const useWalletContext = () => useContext(WalletContext);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Track hydration state
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Wagmi hooks - only used after hydration
  const { address, isConnected, isConnecting } = useAccount();
  const { connect: wagmiConnect, connectors } = useConnect();
  
  // Only fetch balance if we're hydrated and connected
  const shouldFetchBalance = isHydrated && isConnected && !!address;
  const { data: balanceData, isLoading: isBalanceLoading } = useBalance(
    shouldFetchBalance 
      ? {
          address,
          chainId: zgTestnet.id,
        }
      : { address: undefined }
  );
  
  // Mark as hydrated on client side
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  
  // Simplified connect function
  const connect = () => {
    if (!isHydrated) return;
    
    const injector = connectors.find(c => c.id === 'injected');
    if (injector) {
      wagmiConnect({ connector: injector });
    }
  };
  
  // Create a stable wallet context value
  const walletContextValue: WalletContextType = {
    address,
    isConnected: isHydrated ? isConnected : false,
    isConnecting: isHydrated ? isConnecting : false,
    isHydrated,
    balance: {
      formatted: balanceData?.formatted,
      symbol: balanceData?.symbol,
      loading: isBalanceLoading,
    },
    connect,
  };
  
  return (
    <WalletContext.Provider value={walletContextValue}>
      {children}
    </WalletContext.Provider>
  );
}; 