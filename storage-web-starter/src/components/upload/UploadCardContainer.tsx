import React, { useEffect, useState } from 'react';
import { useNetwork } from '@/app/providers';
import { UploadCard } from '@/components/upload/UploadCard';
import { HydrationErrorBoundary } from '@/components/common/HydrationErrorBoundary';

/**
 * A container component that ensures proper remounting of UploadCard when network changes.
 * This helps prevent stale state and rehydration issues.
 */
export default function UploadCardContainer() {
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
      <HydrationErrorBoundary>
        <UploadCard />
      </HydrationErrorBoundary>
    </div>
  );
} 