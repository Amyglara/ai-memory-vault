import React, { useEffect, useState } from 'react';
import { useNetwork } from '@/app/providers';
import { DownloadCard } from '@/components/download/DownloadCard';

/**
 * A container component that ensures proper remounting of DownloadCard when network changes.
 * This helps prevent stale state and rehydration issues.
 */
export default function DownloadCardContainer() {
  const { networkType } = useNetwork();
  const [key, setKey] = useState(Date.now());
  
  // Force remount when network changes
  useEffect(() => {
    // Generate a new key to force a complete remount
    setKey(Date.now());
  }, [networkType]);
  
  return (
    // Use both networkType and a timestamp key to ensure proper remounting
    <div key={`${networkType}-${key}`}>
      <DownloadCard />
    </div>
  );
} 