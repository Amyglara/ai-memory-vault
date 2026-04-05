"use client";

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { useI18n } from "@/context";
import { createEscrow, fundEscrow } from "@/lib/contracts";
import { EXPLORER_URL } from "@/lib/config";
import { Shield, Loader2, AlertCircle, CheckCircle2, Clock, Info } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { parseEther, formatEther } from "viem";

export default function CreateEscrowPage() {
  const { isConnected, address } = useAccount();
  const { t } = useI18n();

  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [deadlineDays, setDeadlineDays] = useState(7);
  const [creating, setCreating] = useState(false);
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ txHash: string; escrowId?: string } | null>(null);
  const [step, setStep] = useState<"form" | "funding">("form");

  const amountWei = amount ? parseEther(amount) : BigInt(0);
  const feeWei = (amountWei * BigInt(100)) / BigInt(10000); // 1%
  const totalRequired = amountWei + feeWei;

  const validate = (): boolean => {
    setError("");
    if (!seller.startsWith("0x") || seller.length !== 42) {
      setError(t("create.invalidAddress"));
      return false;
    }
    if (seller.toLowerCase() === address?.toLowerCase()) {
      setError("Cannot create escrow with yourself");
      return false;
    }
    if (!amount || Number(amount) <= 0) {
      setError(t("create.invalidAmount"));
      return false;
    }
    if (!description.trim()) {
      setError(t("create.emptyDescription"));
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setCreating(true);
    setError("");

    try {
      const txHash = await createEscrow(
        seller,
        amountWei,
        description,
        deadlineDays * 86400
      );
      setSuccess({ txHash });
      setStep("funding");
    } catch (err: any) {
      setError(err?.message || t("create.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const handleFund = async () => {
    setFunding(true);
    setError("");

    try {
      const txHash = await fundEscrow(BigInt(0), totalRequired);
      setSuccess({ txHash });
    } catch (err: any) {
      setError(err?.message || "Failed to fund escrow");
    } finally {
      setFunding(false);
    }
  };

  const deadlineOptions = [
    { days: 3, label: t("create.days3") },
    { days: 7, label: t("create.days7") },
    { days: 14, label: t("create.days14") },
    { days: 30, label: t("create.days30") },
  ];

  if (!isConnected) {
    return (
      <div className="animate-slide-up">
        <div className="glass-card p-12 text-center">
          <Shield className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">{t("create.connectWallet")}</h2>
          <p className="text-zinc-500">{t("create.connectWalletHint")}</p>
        </div>
      </div>
    );
  }

  if (success && step === "funding" && !funding) {
    return (
      <div className="animate-slide-up max-w-lg mx-auto">
        <div className="glass-card p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">{t("create.createSuccess", { txHash: truncateAddress(success.txHash) })}</h2>
          <p className="text-zinc-400 text-sm mb-6">{t("create.fundHint")}</p>
          <div className="space-y-3">
            <button onClick={handleFund} disabled={funding} className="neon-button w-full flex items-center justify-center gap-2">
              {funding ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {funding ? "Funding..." : `Fund ${amount} OG + Fee`}
            </button>
            <a href={`${EXPLORER_URL}/tx/${success.txHash}`} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-neon-cyan hover:underline">
              View Transaction →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{t("create.title")}</h1>
        <p className="text-zinc-400">{t("create.subtitle")}</p>
      </div>

      {/* Form */}
      <div className="glass-card p-6 space-y-6">
        {/* Seller Address */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">{t("create.sellerAddress")}</label>
          <input
            type="text"
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
            placeholder={t("create.sellerPlaceholder")}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-all font-mono text-sm"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">{t("create.amount")}</label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t("create.amountPlaceholder")}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-all font-mono text-sm pr-16"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-medium">OG</span>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">{t("create.description")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("create.descriptionPlaceholder")}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-all text-sm resize-none"
          />
        </div>

        {/* Deadline */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">{t("create.deadline")}</label>
          <div className="grid grid-cols-4 gap-2">
            {deadlineOptions.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setDeadlineDays(opt.days)}
                className={`py-2.5 rounded-lg text-sm font-medium transition-all border ${
                  deadlineDays === opt.days
                    ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30"
                    : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
            <Clock className="w-3 h-3" />
            <span>{deadlineDays} {t("create.deadlineDays")}</span>
          </div>
        </div>

        {/* Fee Preview */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">{t("create.feePreview")}</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Escrow Amount</span>
              <span className="text-white font-mono">{amount || "0"} OG</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">{t("create.arbitrationFee")}</span>
              <span className="text-yellow-400 font-mono">{amountWei > BigInt(0) ? formatEther(feeWei) : "0"} OG</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between text-sm font-semibold">
              <span className="text-white">{t("create.totalRequired")}</span>
              <span className="text-neon-cyan font-mono">{amountWei > BigInt(0) ? formatEther(totalRequired) : "0"} OG</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleCreate}
          disabled={creating || step === "funding"}
          className="neon-button w-full flex items-center justify-center gap-2 py-3"
        >
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("create.creating")}
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" />
              {t("create.createBtn")}
            </>
          )}
        </button>
      </div>

      {/* Info Hint */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-400/5 border border-blue-400/10">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-zinc-400 leading-relaxed">
          {t("create.fundHint")} The seller can release funds after delivery, or either party can raise a dispute for AI-powered arbitration.
        </p>
      </div>
    </div>
  );
}
