"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAccount, useBalance } from "wagmi";
import { useNetwork } from "@/context";
import {
  Brain,
  Upload,
  MessageSquare,
  Bot,
  ArrowRight,
  Shield,
  Database,
  Cpu,
  FileText,
  Zap,
  Loader2,
} from "lucide-react";
import {
  getFileCount,
  getAgentCount,
  getFilesByOwner,
  getAgentsByOwner,
} from "@/lib/contracts";
import type { Address } from "viem";

// ===== Types =====

interface ChainStats {
  totalFiles: number;
  totalAgents: number;
  myFiles: number;
  myAgents: number;
  loading: boolean;
}

// ===== Main Component =====

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const { data: balanceData } = useBalance({
    address: isConnected ? address : undefined,
    chainId: 16602,
  });
  const { networkType } = useNetwork();

  const [stats, setStats] = useState<ChainStats>({
    totalFiles: 0,
    totalAgents: 0,
    myFiles: 0,
    myAgents: 0,
    loading: false,
  });

  const loadStats = useCallback(async () => {
    setStats((prev) => ({ ...prev, loading: true }));

    try {
      const [totalFiles, totalAgents] = await Promise.all([
        getFileCount(),
        getAgentCount(),
      ]);

      let myFiles = 0;
      let myAgents = 0;

      if (isConnected && address) {
        try {
          const [myFileIds, myAgentIds] = await Promise.all([
            getFilesByOwner(address as Address),
            getAgentsByOwner(address as Address),
          ]);
          myFiles = myFileIds.length;
          myAgents = myAgentIds.length;
        } catch {
          // Owner queries may fail for non-registered users
        }
      }

      setStats({
        totalFiles: Number(totalFiles),
        totalAgents: Number(totalAgents),
        myFiles,
        myAgents,
        loading: false,
      });
    } catch {
      setStats((prev) => ({ ...prev, loading: false }));
    }
  }, [isConnected, address]);

  // Load stats on mount and when wallet connects
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  // AI Conversations count from localStorage
  const conversationCount = isConnected
    ? (() => {
        try {
          const stored = localStorage.getItem(
            `vault_conversations_${address?.toLowerCase()}`
          );
          return stored ? JSON.parse(stored).length : 0;
        } catch {
          return 0;
        }
      })()
    : 0;

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl glass-card p-8 md:p-12">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 via-transparent to-neon-purple/5" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
              {networkType === "turbo" ? "🐇 Turbo" : "🐢 Standard"} Network
            </div>
            {!isConnected && (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Wallet Not Connected
              </div>
            )}
            {isConnected && (
              <button
                onClick={loadStats}
                className="px-3 py-1 rounded-full text-xs font-medium bg-white/[0.04] text-zinc-500 border border-white/[0.06] hover:text-zinc-300 hover:border-white/[0.12] transition-all flex items-center gap-1"
                disabled={stats.loading}
              >
                {stats.loading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                Refresh
              </button>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            <span className="neon-text">AI Memory Vault</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mb-8">
            Store AI agent memories and knowledge on 0G decentralized storage.
            Powered by 0G Storage, 0G Compute, and 0G Chain.
          </p>

          <div className="flex flex-wrap gap-3">
            {!isConnected ? (
              <p className="text-zinc-500 text-sm">
                Connect your wallet to get started →
              </p>
            ) : (
              <>
                <Link
                  href="/upload"
                  className="neon-button flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Memory
                </Link>
                <Link
                  href="/chat"
                  className="neon-button-outline flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Start AI Chat
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Database}
          label="Stored Files"
          value={stats.loading ? "..." : String(stats.totalFiles)}
          sublabel={
            isConnected && stats.myFiles > 0
              ? `${stats.myFiles} yours`
              : "0G Storage"
          }
          color="cyan"
        />
        <StatCard
          icon={Bot}
          label="AI Agents"
          value={stats.loading ? "..." : String(stats.totalAgents)}
          sublabel={
            isConnected && stats.myAgents > 0
              ? `${stats.myAgents} yours`
              : "0G Chain"
          }
          color="purple"
        />
        <StatCard
          icon={MessageSquare}
          label="Conversations"
          value={isConnected ? String(conversationCount) : "—"}
          sublabel="0G Compute"
          color="blue"
        />
        <StatCard
          icon={Brain}
          label="Network"
          value="0G"
          sublabel="Galileo Testnet"
          color="cyan"
        />
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickAction
            href="/upload"
            icon={Upload}
            title="Upload Document"
            description="Store knowledge to 0G decentralized storage"
            disabled={!isConnected}
          />
          <QuickAction
            href="/chat"
            icon={MessageSquare}
            title="AI Conversation"
            description="Chat with AI using 0G Compute LLM"
            disabled={!isConnected}
          />
          <QuickAction
            href="/agents"
            icon={Bot}
            title="Manage Agents"
            description="Register and manage on-chain AI agent identities"
            disabled={!isConnected}
          />
          <QuickAction
            href="https://docs.0g.ai"
            icon={FileText}
            title="0G Documentation"
            description="Learn about 0G Network"
            external
          />
        </div>
      </section>

      {/* How It Works */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StepCard
            step={1}
            icon={Shield}
            title="Upload & Store"
            description="Upload documents to 0G decentralized storage. Merkle root hash anchors data integrity on-chain."
          />
          <StepCard
            step={2}
            icon={Cpu}
            title="AI Reasoning"
            description="0G Compute powers LLM inference with RAG. AI retrieves stored knowledge to enhance conversations."
          />
          <StepCard
            step={3}
            icon={Zap}
            title="On-chain Identity"
            description="Register AI agents on 0G Chain. Link memories to agent identities for verifiable AI history."
          />
        </div>
      </section>
    </div>
  );
}

/* ===== Sub-components ===== */

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sublabel: string;
  color: "cyan" | "purple" | "blue";
}) {
  const colorMap = {
    cyan: "text-neon-cyan bg-neon-cyan/10",
    purple: "text-neon-purple bg-neon-purple/10",
    blue: "text-neon-blue bg-neon-blue/10",
  };

  return (
    <div className="stat-card text-center glass-card-hover">
      <div
        className={`w-12 h-12 rounded-xl ${colorMap[color]} flex items-center justify-center mb-2`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="text-xs text-zinc-500 mt-1">{sublabel}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
  disabled = false,
  external = false,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  disabled?: boolean;
  external?: boolean;
}) {
  const Wrapper = external ? "a" : Link;
  const wrapperProps = external
    ? { href, target: "_blank", rel: "noopener noreferrer" }
    : { href };

  return (
    <Wrapper {...(wrapperProps as any)}>
      <div
        className={`glass-card-hover p-5 flex flex-col gap-3 ${
          disabled ? "opacity-40 pointer-events-none" : "cursor-pointer"
        }`}
      >
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
          <Icon className="w-5 h-5 text-zinc-300" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-zinc-500 mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-neon-cyan font-medium">
          {external ? "Open docs" : "Go to page"}
          <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </Wrapper>
  );
}

function StepCard({
  step,
  icon: Icon,
  title,
  description,
}: {
  step: number;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-card p-6 relative overflow-hidden">
      <div className="absolute top-4 right-4 text-6xl font-black text-white/[0.03]">
        {step}
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-neon-glow flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs font-mono text-zinc-500">STEP {step}</span>
        </div>
        <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
