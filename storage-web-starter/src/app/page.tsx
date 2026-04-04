'use client';

import dynamic from 'next/dynamic';
import React, { Suspense } from 'react';

// Import the client page with ssr: false to completely avoid hydration mismatches
const ClientOnlyPage = dynamic(
  () => import('./client-page').then(mod => mod.ClientPage),
  { 
    ssr: false,
    loading: () => <LoadingFallback />
  }
);

// Simple loading fallback for the initial page load
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-pulse text-blue-600 text-xl font-semibold">
        Loading application...
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ClientOnlyPage />
    </Suspense>
  );
}
