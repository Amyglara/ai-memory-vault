"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAccount, useBalance } from "wagmi";
import { useNetwork, useI18n } from "@/context";
import {
  Shield,
  PlusCircle,
  Swords,
  FileSearch,
  ArrowRight,
  Database,
  Lock,
  AlertTriangle,
  FileText,
  Zap,
  Loader2,
  Scale,
  Cpu,
} from "lucide-react";
import {
  getEscrowStats,
  getTotalValueLocked,
  getUserEscrows,
} from "@/lib/contracts";
import type { Address } from "viem";

// ===== Types =====

interface DashboardStats {
  total: number;
  funded: number;
  disputed: number;
  totalLocked: string;
  myEscrows: number;
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
  const { t } = useI18n();

  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    funded: 0,
    disputed: 0,
    totalLocked: "0",
    myEscrows: 0,
    loading: false,
  });

  const loadStats = useCallback(async () => {
    setStats((prev) => ({ ...prev, loading: true }));

    try {
      const [escrowStats, tvl] = await Promise.all([
        getEscrowStats(),
        getTotalValueLocked(),
      ]);

      let myEscrows = 0;
      if (isConnected && address) {
        try {
          const myIds = await getUserEscrows(address as Address);
          myEscrows = myIds.length;
        } catch {
          // User may not have any escrows yet
        }
      }

      setStats({
        total: Number(escrowStats.total),
        funded: Number(escrowStats.funded),
        disputed: Number(escrowStats.disputed),
        totalLocked: (Number(tvl) / 1e18).toFixed(4),
        myEscrows,
        loading: false,
      });
    } catch {
      setStats((prev) => ({ ...prev, loading: false }));
    }
  }, [isConnected, address]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl glass-card p-8 md:p-12 group">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 via-transparent to-neon-purple/5" />
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-neon-cyan/5 blur-3xl group-hover:bg-neon-cyan/10 transition-all duration-700" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-neon-purple/5 blur-3xl group-hover:bg-neon-purple/10 transition-all duration-700" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
              {networkType === "turbo" ? t("common.turbo") : t("common.standard")} Network
            </div>
            {!isConnected && (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                {t("nav.walletNotConnected")}
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
                {t("nav.refresh")}
              </button>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            <span className="neon-text">{t("dashboard.hero.title")}</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mb-8 leading-relaxed">
            {t("dashboard.hero.description")}
          </p>

          <div className="flex flex-wrap gap-3">
            {!isConnected ? (
              <p className="text-zinc-500 text-sm">
                {t("dashboard.hero.connectHint")}
              </p>
            ) : (
              <>
                <Link
                  href="/create"
                  className="neon-button flex items-center gap-2 group/btn"
                >
                  <PlusCircle className="w-4 h-4" />
                  {t("dashboard.hero.createEscrow")}
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
                </Link>
                <Link
                  href="/disputes"
                  className="neon-button-outline flex items-center gap-2 group/btn"
                >
                  <Swords className="w-4 h-4" />
                  {t("dashboard.hero.manageDisputes")}
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
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
          label={t("dashboard.stats.totalEscrows")}
          value={stats.loading ? "..." : String(stats.total)}
          sublabel={
            isConnected && stats.myEscrows > 0
              ? t("dashboard.stats.yours", { count: stats.myEscrows })
              : "0G Chain"
          }
          color="cyan"
        />
        <StatCard
          icon={Lock}
          label={t("dashboard.stats.active")}
          value={stats.loading ? "..." : String(stats.funded)}
          sublabel="Funded + Evidence"
          color="blue"
        />
        <StatCard
          icon={AlertTriangle}
          label={t("dashboard.stats.disputed")}
          value={stats.loading ? "..." : String(stats.disputed)}
          sublabel="Awaiting Resolution"
          color="red"
        />
        <StatCard
          icon={Scale}
          label={t("dashboard.stats.totalLocked")}
          value={stats.loading ? "..." : stats.totalLocked}
          sublabel="OG Tokens"
          color="purple"
        />
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">{t("dashboard.quickActions")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickAction
            href="/create"
            icon={PlusCircle}
            title={t("dashboard.quickActions.createEscrow")}
            description={t("dashboard.quickActions.createEscrowDesc")}
            disabled={!isConnected}
          />
          <QuickAction
            href="/disputes"
            icon={Swords}
            title={t("dashboard.quickActions.manageDisputes")}
            description={t("dashboard.quickActions.manageDisputesDesc")}
            disabled={!isConnected}
          />
          <QuickAction
            href="/evidence"
            icon={FileSearch}
            title={t("dashboard.quickActions.evidenceLib")}
            description={t("dashboard.quickActions.evidenceLibDesc")}
            disabled={!isConnected}
          />
          <QuickAction
            href="https://docs.0g.ai"
            icon={FileText}
            title={t("dashboard.quickActions.docs")}
            description={t("dashboard.quickActions.docsDesc")}
            external
            goLabel={t("dashboard.quickActions.openDocs")}
          />
        </div>
      </section>

      {/* How It Works */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">{t("dashboard.howItWorks")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StepCard
            step={1}
            icon={Shield}
            title={t("dashboard.howItWorks.step1.title")}
            description={t("dashboard.howItWorks.step1.desc")}
            stepLabel="STEP"
          />
          <StepCard
            step={2}
            icon={Database}
            title={t("dashboard.howItWorks.step2.title")}
            description={t("dashboard.howItWorks.step2.desc")}
            stepLabel="STEP"
          />
          <StepCard
            step={3}
            icon={Cpu}
            title={t("dashboard.howItWorks.step3.title")}
            description={t("dashboard.howItWorks.step3.desc")}
            stepLabel="STEP"
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
  color: "cyan" | "purple" | "blue" | "red";
}) {
  const colorMap = {
    cyan: { bg: "bg-neon-cyan/10", text: "text-neon-cyan", border: "border-neon-cyan/10" },
    purple: { bg: "bg-neon-purple/10", text: "text-neon-purple", border: "border-neon-purple/10" },
    blue: { bg: "bg-neon-blue/10", text: "text-neon-blue", border: "border-neon-blue/10" },
    red: { bg: "bg-red-400/10", text: "text-red-400", border: "border-red-400/10" },
  };
  const c = colorMap[color];

  return (
    <div className="stat-card text-left glass-card-hover group">
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        <div className={`w-2 h-2 rounded-full ${c.bg} ${c.text} opacity-30`} />
      </div>
      <p className="text-2xl font-bold text-white tabular-nums tracking-tight">{value}</p>
      <p className="text-sm text-zinc-400 mt-0.5">{label}</p>
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
  goLabel,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  disabled?: boolean;
  external?: boolean;
  goLabel?: string;
}) {
  const Wrapper = external ? "a" : Link;
  const wrapperProps = external
    ? { href, target: "_blank", rel: "noopener noreferrer" }
    : { href };

  const { t } = useI18n();

  return (
    <Wrapper {...(wrapperProps as any)}>
      <div
        className={`glass-card-hover p-5 flex flex-col gap-3 group/action ${
          disabled ? "opacity-40 pointer-events-none" : "cursor-pointer"
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center group-hover/action:bg-white/[0.08] transition-colors">
          <Icon className="w-5 h-5 text-zinc-400 group-hover/action:text-neon-cyan transition-colors" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{description}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-600 font-medium group-hover/action:text-neon-cyan transition-colors">
          {external ? (goLabel || t("dashboard.quickActions.openDocs")) : (goLabel || t("dashboard.quickActions.goToPage"))}
          <ArrowRight className="w-3 h-3 transition-transform group-hover/action:translate-x-1" />
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
  stepLabel,
}: {
  step: number;
  icon: React.ElementType;
  title: string;
  description: string;
  stepLabel: string;
}) {
  const stepColors = ["text-neon-cyan", "text-neon-purple", "text-neon-cyan"];
  const stepBorderColors = ["border-neon-cyan/10", "border-neon-purple/10", "border-neon-cyan/10"];
  const stepBgColors = ["bg-neon-cyan/5", "bg-neon-purple/5", "bg-neon-cyan/5"];

  return (
    <div className={`glass-card p-6 relative overflow-hidden group hover:border-white/[0.12] transition-all duration-300 ${stepBorderColors[step - 1]}`}>
      <div className="absolute top-4 right-4 text-7xl font-black text-white/[0.02] group-hover:text-white/[0.04] transition-colors">
        {step}
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl ${stepBgColors[step - 1]} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
            <Icon className={`w-5 h-5 ${stepColors[step - 1]}`} />
          </div>
          <span className="text-xs font-mono text-zinc-500">{stepLabel} {step}</span>
          {step < 3 && (
            <ArrowRight className="w-3 h-3 text-zinc-600 ml-auto hidden lg:block" />
          )}
        </div>
        <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
