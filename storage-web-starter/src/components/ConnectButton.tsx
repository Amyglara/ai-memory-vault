import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Create a placeholder component for SSR
const ButtonPlaceholder = () => (
  <div className="px-4 py-2 rounded-lg bg-blue-500 text-white opacity-0">
    Connect Wallet
  </div>
);

// Use dynamic import with ssr: false to completely skip this component during server rendering
// This guarantees no hydration mismatches since the component only exists client-side
const DynamicConnectButton = dynamic(
  () => import('./ConnectButtonClient').then(mod => mod.ConnectButtonClient),
  { 
    ssr: false,
    loading: ButtonPlaceholder 
  }
);

export default function ConnectButton() {
  const [mounted, setMounted] = useState(false);
  
  // Only show component after client-side hydration is complete
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Show placeholder during SSR and initial client render
  if (!mounted) {
    return <ButtonPlaceholder />;
  }
  
  // Only render the actual button component after hydration is complete
  return <DynamicConnectButton />;
} 