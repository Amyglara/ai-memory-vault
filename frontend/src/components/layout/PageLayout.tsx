"use client";

import React from "react";
import Navbar, { Footer } from "@/components/layout/Navbar";

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen bg-grid-pattern flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-7xl flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
