import { useCallback } from 'react';
import { useWalletContext } from '@/context/WalletContext';

/**
 * Compatibility layer for existing components
 * This hook replaces the direct Wagmi hooks with our hydration-safe WalletContext
 */
export function useWallet() {
  const { 
    address, 
    isConnected,
    isConnecting, 
    isHydrated,
    connect
  } = useWalletContext();
  
  // These functions are for backward compatibility
  const getEffectiveAddress = useCallback(() => {
    return address;
  }, [address]);
  
  const isEffectivelyConnected = useCallback(() => {
    return isConnected;
  }, [isConnected]);
  
  const forceReconnectWallet = useCallback(() => {
    if (isHydrated) {
      connect();
    }
  }, [connect, isHydrated]);
  
  return {
    address: getEffectiveAddress(),
    isConnected: isEffectivelyConnected(),
    status: isConnecting ? 'connecting' : isConnected ? 'connected' : 'disconnected',
    initializing: !isHydrated,
    directWalletAddress: address,
    forceReconnectWallet
  };
} 