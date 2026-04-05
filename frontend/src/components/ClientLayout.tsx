"use client";

import React, { useState, useEffect } from "react";
import { ContextProvider } from "@/context";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // CRITICAL: Always render WagmiProvider, even before mount.
  // Returning null here destroys the WagmiProvider context on navigation,
  // causing wallet disconnection on every page transition.
  // Instead, use CSS to hide content during hydration.
  return (
    <div style={mounted ? undefined : { visibility: "hidden" }}>
      <ContextProvider>{children}</ContextProvider>
    </div>
  );
}
