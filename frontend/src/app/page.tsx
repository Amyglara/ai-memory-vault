"use client";

import dynamic from "next/dynamic";
import React, { Suspense } from "react";

const ClientOnlyPage = dynamic(
  () => import("./client-page").then((mod) => mod.ClientPage),
  {
    ssr: false,
    loading: () => <LoadingFallback />,
  }
);

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 rounded-full border-2 border-neon-cyan/30 animate-ping" />
          <div className="absolute inset-2 rounded-full border-2 border-t-neon-cyan border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-zinc-400 text-sm tracking-wider uppercase">
          Initializing Vault...
        </p>
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
