"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { truncateAddress } from "@/lib/utils";
import { useI18n } from "@/context";
import type { TranslationKey } from "@/lib/i18n";
import {
  Shield,
  PlusCircle,
  Swords,
  FileSearch,
  Menu,
  X,
  Wallet,
  LogOut,
  ChevronDown,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balanceData } = useBalance({
    address: isConnected ? address : undefined,
    chainId: 16602,
  });
  const { locale, setLocale, t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const modalApi = useReownModal();

  const handleConnect = useCallback(() => {
    modalApi?.open().catch(console.error);
  }, [modalApi]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setWalletMenuOpen(false);
  }, [disconnect]);

  const navLinks: { href: string; label: TranslationKey; icon: React.ElementType }[] = [
    { href: "/", label: "nav.dashboard", icon: Shield },
    { href: "/create", label: "nav.create", icon: PlusCircle },
    { href: "/disputes", label: "nav.disputes", icon: Swords },
    { href: "/evidence", label: "nav.evidence", icon: FileSearch },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-dark-900/80 backdrop-blur-xl">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-neon-glow flex items-center justify-center group-hover:shadow-neon transition-shadow duration-300">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              <span className="neon-text">Trust</span>
              <span className="text-zinc-400">Gate</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "text-neon-cyan bg-neon-cyan/10"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  {t(link.label)}
                </Link>
              );
            })}
          </div>

          {/* Right Side: Lang + Wallet + Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-white/[0.08]"
                title="Switch Language"
              >
                <Languages className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-medium uppercase">{locale === "zh" ? "中" : "EN"}</span>
              </button>

              {langMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setLangMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-36 rounded-xl bg-dark-800 border border-white/10 shadow-xl z-50 py-1.5 animate-slide-up">
                    <button
                      onClick={() => { setLocale("en"); setLangMenuOpen(false); }}
                      className={cn(
                        "flex items-center gap-2 w-full px-4 py-2.5 text-sm transition-colors",
                        locale === "en" ? "text-neon-cyan bg-neon-cyan/5" : "text-zinc-300 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <span className="text-base">🇺🇸</span>
                      English
                      {locale === "en" && <span className="ml-auto text-neon-cyan text-xs">✓</span>}
                    </button>
                    <button
                      onClick={() => { setLocale("zh"); setLangMenuOpen(false); }}
                      className={cn(
                        "flex items-center gap-2 w-full px-4 py-2.5 text-sm transition-colors",
                        locale === "zh" ? "text-neon-cyan bg-neon-cyan/5" : "text-zinc-300 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <span className="text-base">🇨🇳</span>
                      中文
                      {locale === "zh" && <span className="ml-auto text-neon-cyan text-xs">✓</span>}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Wallet Button */}
            {isConnected && address ? (
              <div className="relative">
                <button
                  onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-medium text-white">
                    {truncateAddress(address)}
                  </span>
                  {balanceData && (
                    <span className="text-xs text-zinc-500 hidden lg:inline">
                      {Number(balanceData.formatted).toFixed(3)} {balanceData.symbol}
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </button>

                {/* Wallet Dropdown */}
                {walletMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setWalletMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-dark-800 border border-white/10 shadow-xl z-50 py-2 animate-slide-up">
                      <div className="px-4 py-2 border-b border-white/[0.06]">
                        <p className="text-xs text-zinc-500">{t("nav.connected")}</p>
                        <p className="text-sm font-mono text-white mt-0.5">
                          {truncateAddress(address)}
                        </p>
                        {balanceData && (
                          <p className="text-xs text-emerald-400 mt-1">
                            {Number(balanceData.formatted).toFixed(4)} {balanceData.symbol}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={handleDisconnect}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        {t("nav.disconnect")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={!modalApi}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
                  modalApi
                    ? "bg-gradient-to-r from-neon-cyan/20 to-purple-500/20 border border-neon-cyan/30 hover:border-neon-cyan/50 hover:from-neon-cyan/30 hover:to-purple-500/30 text-white hover:shadow-neon cursor-pointer"
                    : "bg-white/5 border border-white/10 text-zinc-500 cursor-not-allowed"
                )}
              >
                <Wallet className="w-4 h-4" />
                {t("nav.connectWallet")}
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-white/[0.06] mt-2 pt-4 animate-slide-up">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "text-neon-cyan bg-neon-cyan/10"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  {t(link.label)}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}

/**
 * Hook to access the Reown AppKit modal open/close functions.
 */
function useReownModal() {
  const [modalApi, setModalApi] = useState<{
    open: (opts?: any) => Promise<any>;
    close: () => Promise<any>;
  } | null>(null);

  useEffect(() => {
    import("@reown/appkit/react").then((mod) => {
      if (mod.modal) {
        const m = mod.modal!;
        setModalApi({
          open: (opts) => m.open(opts),
          close: () => m.close(),
        });
      }
    }).catch(console.error);
  }, []);

  return modalApi;
}
