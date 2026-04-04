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

  if (!mounted) {
    return null;
  }

  return <ContextProvider>{children}</ContextProvider>;
}
