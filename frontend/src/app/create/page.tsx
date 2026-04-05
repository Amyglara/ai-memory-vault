"use client";

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { useI18n } from "@/context";
import { createAndFundEscrow } from "@/lib/contracts";
import { EXPLORER_URL } from "@/lib/config";
import { Shield, Loader2, AlertCircle, CheckCircle2, Clock, Info, ArrowRight } from "lucide-react";
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
  const [step, setStep] = useState<"idle" | "creating" | "funding" | "done">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ createHash: string; fundHash: string } | null>(null);

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

  const handleCreateAndFund = async () => {
    if (!validate()) return;
    setCreating(true);
    setStep("creating");
    setError("");

    try {
      const res = await createAndFundEscrow(
        seller,
        amountWei,
        description,
        deadlineDays * 86400
      );
      setResult(res);
      setStep("done");
    } catch (err: any) {
      const msg = err?.message || t("create.createFailed");
      // Clean up RPC error messages
      setError(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
      setStep("idle");
    } finally {
      setCreating(false);
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

  // Success state
  if (result && step === "done") {
    return (
      <div className="animate-slide-up max-w-lg mx-auto">
        <div className="glass-card p-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
          <h2 className="text-xl font-semibold text-white">{t("create.createSuccess", { txHash: "" })}</h2>
          <p className="text-zinc-400 text-sm">Escrow created and funded successfully!</p>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <span className="text-zinc-400">1. Create Tx</span>
              <a
                href={`${EXPLORER_URL}/tx/${result.createHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon-cyan hover:underline font-mono text-xs"
              >
                {truncateAddress(result.createHash)} →
              </a>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <span className="text-zinc-400">2. Fund Tx</span>
              <a
                href={`${EXPLORER_URL}/tx/${result.fundHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon-cyan hover:underline font-mono text-xs"
              >
                {truncateAddress(result.fundHash)} →
              </a>
            </div>
          </div>

          <a href="/" className="neon-button w-full flex items-center justify-center gap-2 mt-4">
            Back to Dashboard
            <ArrowRight className="w-4 h-4" />
          </a>
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

      {/* Progress indicator during creation */}
      {creating && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step === "creating" ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30" : "bg-emerald-400/20 text-emerald-400 border border-emerald-400/30"
            }`}>
              {step === "funding" || step === "done" ? "✓" : "1"}
            </div>
            <div>
              <p className={`text-sm font-medium ${step === "creating" ? "text-white" : "text-emerald-400"}`}>
                Creating Escrow...
              </p>
              <p className="text-xs text-zinc-500">Confirm in your wallet</p>
            </div>
            {step === "creating" && <Loader2 className="w-4 h-4 text-neon-cyan animate-spin ml-auto" />}
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step === "funding" ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30" : step === "done" ? "bg-emerald-400/20 text-emerald-400 border border-emerald-400/30" : "bg-zinc-800 text-zinc-600 border border-zinc-700"
            }`}>
              {step === "done" ? "✓" : "2"}
            </div>
            <div>
              <p className={`text-sm font-medium ${step === "funding" ? "text-white" : step === "done" ? "text-emerald-400" : "text-zinc-600"}`}>
                Funding Escrow
              </p>
              <p className="text-xs text-zinc-500">{step === "funding" ? "Confirm payment in your wallet" : step === "done" ? "Completed" : "Waiting..."}</p>
            </div>
            {step === "funding" && <Loader2 className="w-4 h-4 text-neon-cyan animate-spin ml-auto" />}
          </div>
        </div>
      )}

      {/* Form */}
      <div className={`glass-card p-6 space-y-6 ${creating ? "opacity-50 pointer-events-none" : ""}`}>
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
          onClick={handleCreateAndFund}
          disabled={creating}
          className="neon-button w-full flex items-center justify-center gap-2 py-3"
        >
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {step === "creating" ? "Creating..." : "Funding..."}
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
          This will create and fund the escrow in two transactions. The seller can release funds after delivery, or either party can raise a dispute for AI-powered arbitration.
        </p>
      </div>
    </div>
  );
}
