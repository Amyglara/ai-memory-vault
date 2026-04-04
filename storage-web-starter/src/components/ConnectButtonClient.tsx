import { useEffect, useRef } from 'react';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useNetwork } from '@/app/providers';
import { useWalletContext } from '@/context/WalletContext';

// Client-side only component - no hydration issues since it's dynamically imported
export function ConnectButtonClient() {
  const { networkType } = useNetwork();
  const { address, isConnected, isConnecting, connect, isHydrated } = useWalletContext();
  const { open } = useWeb3Modal();
  
  // Use ref for key to avoid state updates during render
  const keyRef = useRef(`${networkType}-${Date.now()}`);
  
  // Update key when network type changes
  useEffect(() => {
    keyRef.current = `${networkType}-${Date.now()}`;
  }, [networkType]);

  if (!isHydrated) {
    // Return a skeleton/placeholder while hydrating
    return (
      <button
        disabled
        className="px-4 py-2 font-semibold text-sm bg-gray-200 text-transparent rounded-lg shadow-sm 
          flex items-center gap-2 animate-pulse"
      >
        Connect Wallet
      </button>
    );
  }

  if (isConnecting) {
    return (
      <button
        disabled
        className="px-4 py-2 font-semibold text-sm bg-gray-400 text-white rounded-lg shadow-sm 
          flex items-center gap-2 opacity-75 cursor-not-allowed"
      >
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Connecting...
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="relative flex items-center gap-2">
        <button
          onClick={() => open()}
          className="px-4 py-2 font-semibold text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-sm 
            hover:from-blue-600 hover:to-blue-700 transition-all duration-200 
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
            flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {`${address.slice(0, 6)}...${address.slice(-4)}`}
        </button>
      </div>
    );
  }

  return (
    <div key={keyRef.current}>
      <button
        onClick={() => connect()}
        className="px-4 py-2 font-semibold text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-sm 
          hover:from-blue-600 hover:to-blue-700 transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
          flex items-center gap-2"
      >
        Connect Wallet
      </button>
    </div>
  );
} 