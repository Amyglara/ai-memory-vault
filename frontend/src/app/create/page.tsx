"use client";

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { useI18n } from "@/context";
import { createAndFundEscrow } from "@/lib/contracts";
import { EXPLORER_URL } from "@/lib/config";
import { Shield, Loader2, AlertCircle, CheckCircle2, Clock, Info, ArrowRight } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { parseEther, formatEther } from "viem";
import PageLayout from "@/components/layout/PageLayout";

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
      setError(t("create.selfDeal"));
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

  const pageContent = !isConnected ? (
    <div className="animate-slide-up flex items-center justify-center min-h-[60vh]">
      <div className="glass-card p-12 text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-6">
          <Shield className="w-10 h-10 text-zinc-600" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">{t("create.connectWallet")}</h2>
        <p className="text-zinc-500 text-sm">{t("create.connectWalletHint")}</p>
      </div>
    </div>
  ) : result && step === "done" ? (
    <div className="animate-slide-up max-w-lg mx-auto">
      <div className="glass-card p-8 text-center space-y-5">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-emerald-400/10 animate-ping" />
          </div>
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto relative" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">{t("create.successTitle")}</h2>
          <p className="text-zinc-400 text-sm mt-1">{t("create.successDesc")}</p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] group">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-400/10 flex items-center justify-center text-xs text-emerald-400 font-bold">1</span>
              <span className="text-zinc-400">{t("create.stepCreate")}</span>
            </div>
            <a
              href={`${EXPLORER_URL}/tx/${result.createHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-cyan hover:underline font-mono text-xs transition-colors"
            >
              {truncateAddress(result.createHash)} →
            </a>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] group">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-400/10 flex items-center justify-center text-xs text-emerald-400 font-bold">2</span>
              <span className="text-zinc-400">{t("create.stepFund")}</span>
            </div>
            <a
              href={`${EXPLORER_URL}/tx/${result.fundHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-cyan hover:underline font-mono text-xs transition-colors"
            >
              {truncateAddress(result.fundHash)} →
            </a>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <a href="/disputes" className="neon-button-outline flex-1 flex items-center justify-center gap-2 py-3">
            {t("create.viewDisputes")}
            <ArrowRight className="w-4 h-4" />
          </a>
          <a href="/" className="neon-button flex-1 flex items-center justify-center gap-2 py-3">
            {t("create.backToDashboard")}
          </a>
        </div>
      </div>
    </div>
  ) : (
    <div className="animate-slide-up max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{t("create.title")}</h1>
        <p className="text-zinc-400">{t("create.subtitle")}</p>
      </div>

      {/* Progress indicator during creation */}
      {creating && (
        <div className="glass-card p-5 space-y-4 border-neon-cyan/20">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
              step === "creating" ? "bg-neon-cyan/20 text-neon-cyan border-2 border-neon-cyan/40 shadow-neon" : "bg-emerald-400/20 text-emerald-400 border border-emerald-400/30"
            }`}>
              {step === "funding" || step === "done" ? "✓" : <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${step === "creating" ? "text-white" : "text-emerald-400"}`}>
                {t("create.stepCreate")}
              </p>
              <p className="text-xs text-zinc-500">{t("create.confirmWallet")}</p>
            </div>
            {step === "creating" && (
              <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
            )}
          </div>
          <div className="ml-5 border-l-2 border-white/[0.06] pl-4 pb-1">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                step === "funding" ? "bg-neon-cyan/20 text-neon-cyan border-2 border-neon-cyan/40 shadow-neon" : step === "done" ? "bg-emerald-400/20 text-emerald-400 border border-emerald-400/30" : "bg-zinc-800 text-zinc-600 border border-zinc-700"
              }`}>
                {step === "done" ? "✓" : step === "funding" ? <Loader2 className="w-4 h-4 animate-spin" /> : "2"}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${step === "funding" ? "text-white" : step === "done" ? "text-emerald-400" : "text-zinc-600"}`}>
                  {t("create.stepFund")}
                </p>
                <p className="text-xs text-zinc-500">{step === "funding" ? t("create.confirmPayment") : step === "done" ? t("create.completed") : t("create.waiting")}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className={`glass-card p-6 space-y-6 transition-opacity duration-300 ${creating ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Party Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <div className="w-5 h-5 rounded-md bg-neon-cyan/10 flex items-center justify-center">
              <span className="text-[10px] text-neon-cyan font-bold">1</span>
            </div>
            {t("create.partyInfo")}
          </div>

          {/* Seller Address */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">{t("create.sellerAddress")}</label>
            <input
              type="text"
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
              placeholder={t("create.sellerPlaceholder")}
              className="neon-input font-mono text-sm"
            />
          </div>
        </div>

        <div className="border-t border-white/[0.06]" />

        {/* Escrow Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <div className="w-5 h-5 rounded-md bg-neon-cyan/10 flex items-center justify-center">
              <span className="text-[10px] text-neon-cyan font-bold">2</span>
            </div>
            {t("create.escrowDetails")}
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
                className="neon-input font-mono text-sm pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-medium bg-white/[0.06] px-2 py-0.5 rounded-md">OG</span>
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
              className="neon-input text-sm resize-none"
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
                  className={`py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border ${
                    deadlineDays === opt.days
                      ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30 shadow-[0_0_15px_rgba(0,229,255,0.05)]"
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
        </div>

        <div className="border-t border-white/[0.06]" />

        {/* Fee Preview */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">{t("create.feePreview")}</h3>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">{t("create.escrowAmount")}</span>
              <span className="text-white font-mono">{amount || "0"} OG</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">{t("create.arbitrationFee")}</span>
              <span className="text-yellow-400 font-mono">{amountWei > BigInt(0) ? formatEther(feeWei) : "0"} OG</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2.5 flex justify-between text-sm font-semibold">
              <span className="text-white">{t("create.totalRequired")}</span>
              <span className="text-neon-cyan font-mono text-base">{amountWei > BigInt(0) ? formatEther(totalRequired) : "0"} OG</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-sm animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleCreateAndFund}
          disabled={creating}
          className="neon-button w-full flex items-center justify-center gap-2 py-3.5 text-base"
        >
          {creating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {step === "creating" ? t("create.creating") : t("create.funding")}
            </>
          ) : (
            <>
              <Shield className="w-5 h-5" />
              {t("create.createBtn")}
            </>
          )}
        </button>
      </div>

      {/* Info Hint */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-400/5 border border-blue-400/10">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-zinc-400 leading-relaxed">
          {t("create.infoHint")}
        </p>
      </div>
    </div>
  );

  return <PageLayout>{pageContent}</PageLayout>;
}
