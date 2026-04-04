"use client";

import React from "react";
import Navbar from "@/components/layout/Navbar";
import DashboardPage from "@/components/pages/DashboardPage";

export function ClientPage() {
  return (
    <div className="relative z-10 min-h-screen bg-grid-pattern">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <DashboardPage />
      </main>
    </div>
  );
}
