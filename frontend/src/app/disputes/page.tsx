"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useI18n } from "@/context";
import {
  getEscrow,
  getArbitration,
  getEvidenceByEscrow,
  getEvidence,
  getEscrowVoters,
  hasVoted,
  getUserEscrows,
  getPendingWithdrawal,
  submitEvidence as submitEvidenceOnChain,
  recordAIVerdict,
  EscrowStatus,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/contracts";
import {
  fundEscrow,
  disputeEscrow,
  releaseEscrow,
  refundEscrow,
  castVote,
  resolveEscrow,
  withdrawFunds,
} from "@/lib/contracts";
import { truncateAddress } from "@/lib/utils";
import FileDropzone from "@/components/common/FileDropzone";
import PageLayout from "@/components/layout/PageLayout";
import {
  Swords,
  Shield,
  Loader2,
  AlertCircle,
  Clock,
  Upload,
  Vote,
  Scale,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Wallet,
  FileText,
  Cpu,
  Users,
  CheckCircle2,
  XCircle,
  Banknote,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Search,
  Inbox,
} from "lucide-react";
import type { Escrow, Evidence as EvidenceType, Arbitration } from "@/lib/contracts";
import type { Address } from "viem";

type TabKey = "all" | "active" | "disputed" | "resolved";

export default function DisputesPage() {
  const { isConnected, address } = useAccount();
  const { t } = useI18n();

  const [tab, setTab] = useState<TabKey>("all");
  const [escrowIds, setEscrowIds] = useState<bigint[]>([]);
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<bigint | null>(null);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<string>("0");
  const [searchQuery, setSearchQuery] = useState("");

  const loadEscrows = useCallback(async () => {
    if (!isConnected || !address) return;
    setLoading(true);
    setError("");

    try {
      const ids = await getUserEscrows(address as Address);
      setEscrowIds(ids);

      const escrowPromises = ids.map(async (id) => {
        try {
          return await getEscrow(id);
        } catch {
          return null;
        }
      });
      const results = await Promise.all(escrowPromises);
      setEscrows(results.filter(Boolean) as Escrow[]);

      // Check pending withdrawal
      try {
        const pw = await getPendingWithdrawal(address as Address);
        setPendingWithdrawal((Number(pw) / 1e18).toFixed(6));
      } catch {}
    } catch {
      setError(t("disputes.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [isConnected, address, t]);

  useEffect(() => {
    loadEscrows();
  }, [loadEscrows]);

  const filteredEscrows = escrows.filter((e) => {
    if (tab === "all") return true;
    if (tab === "active") return e.status === EscrowStatus.Funded || e.status === EscrowStatus.Evidence;
    if (tab === "disputed") return e.status === EscrowStatus.Disputed;
    if (tab === "resolved") return e.status === EscrowStatus.Resolved || e.status === EscrowStatus.Released || e.status === EscrowStatus.Refunded;
    return true;
  });

  // Apply search filter
  const displayedEscrows = searchQuery
    ? filteredEscrows.filter((e) =>
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        truncateAddress(e.buyer).toLowerCase().includes(searchQuery.toLowerCase()) ||
        truncateAddress(e.seller).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredEscrows;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: t("disputes.tabs.all") },
    { key: "active", label: t("disputes.tabs.active") },
    { key: "disputed", label: t("disputes.tabs.disputed") },
    { key: "resolved", label: t("disputes.tabs.resolved") },
  ];

  if (!isConnected) {
    return (
      <PageLayout>
        <div className="animate-slide-up flex items-center justify-center min-h-[60vh]">
          <div className="glass-card p-12 text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-6">
              <Swords className="w-10 h-10 text-zinc-600" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">{t("disputes.connectWallet")}</h2>
            <p className="text-zinc-500 text-sm">{t("disputes.connectWalletHint")}</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  const escrowCounts = {
    all: escrows.length,
    active: escrows.filter((e) => e.status === EscrowStatus.Funded || e.status === EscrowStatus.Evidence).length,
    disputed: escrows.filter((e) => e.status === EscrowStatus.Disputed).length,
    resolved: escrows.filter((e) => e.status === EscrowStatus.Resolved || e.status === EscrowStatus.Released || e.status === EscrowStatus.Refunded).length,
  };

  const pageContent = (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{t("disputes.title")}</h1>
          <p className="text-zinc-400 text-sm">{t("disputes.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {Number(pendingWithdrawal) > 0 && (
            <WithdrawBanner amount={pendingWithdrawal} onUpdate={loadEscrows} />
          )}
          <button
            onClick={loadEscrows}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/[0.06] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("nav.refresh")}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("disputes.searchPlaceholder")}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-all text-sm"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === tabItem.key
                ? "bg-neon-cyan/10 text-neon-cyan shadow-[0_0_15px_rgba(0,229,255,0.05)]"
                : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {tabItem.label}
            <span className="ml-1.5 text-xs tabular-nums opacity-60">
              ({escrowCounts[tabItem.key as keyof typeof escrowCounts]})
            </span>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          <span className="text-zinc-400 text-sm">{t("disputes.loading")}</span>
        </div>
      ) : displayedEscrows.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-400">{t("disputes.noEscrows")}</p>
          <p className="text-zinc-500 text-sm mt-1">{t("disputes.noEscrowsHint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedEscrows.map((escrow, index) => {
            // Find the original index to get escrowId
            const originalIndex = escrows.indexOf(escrow);
            return (
              <EscrowCard
                key={escrowIds[originalIndex]?.toString() || index}
                escrowId={escrowIds[originalIndex]!}
                escrow={escrow}
                isExpanded={expandedId === escrowIds[originalIndex]}
                onToggle={() => setExpandedId(expandedId === escrowIds[originalIndex] ? null : escrowIds[originalIndex]!)}
                currentUser={address!}
                onUpdate={loadEscrows}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  return <PageLayout>{pageContent}</PageLayout>;
}

// ===== Escrow Card =====

function EscrowCard({
  escrowId,
  escrow,
  isExpanded,
  onToggle,
  currentUser,
  onUpdate,
}: {
  escrowId: bigint;
  escrow: Escrow;
  isExpanded: boolean;
  onToggle: () => void;
  currentUser: string;
  onUpdate: () => void;
}) {
  const { t } = useI18n();
  const [actionLoading, setActionLoading] = useState("");

  const isBuyer = escrow.buyer.toLowerCase() === currentUser.toLowerCase();
  const isSeller = escrow.seller.toLowerCase() === currentUser.toLowerCase();
  const statusLabel = STATUS_LABELS[escrow.status] || "Unknown";
  const statusColor = STATUS_COLORS[escrow.status] || "text-zinc-400";

  const handleAction = async (action: string, fn: () => Promise<string>) => {
    setActionLoading(action);
    try {
      await fn();
      onUpdate();
    } catch (err: any) {
      console.error(`${action} failed:`, err);
    } finally {
      setActionLoading("");
    }
  };

  const amountEth = (Number(escrow.amount) / 1e18).toFixed(4);
  const deadlineDate = new Date(Number(escrow.deadline) * 1000).toLocaleDateString();

  return (
    <div className={`glass-card overflow-hidden transition-all duration-300 ${isExpanded ? "border-white/[0.12]" : ""}`}>
      {/* Card Header */}
      <button onClick={onToggle} className="w-full p-4 md:p-5 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors">
        <div className={`w-11 h-11 rounded-xl bg-neon-glow flex items-center justify-center shrink-0 transition-transform duration-300 ${isExpanded ? "scale-105 shadow-neon" : ""}`}>
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-zinc-500">#{escrowId.toString()}</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${statusColor.replace("text-", "bg-").replace("-400", "-400/10")} ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-sm text-zinc-300 truncate">{escrow.description}</p>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Banknote className="w-3 h-3" />
              {(Number(escrow.amount) / 1e18).toFixed(4)} OG
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(Number(escrow.deadline) * 1000).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className={`shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-white/[0.06] p-4 space-y-4 animate-slide-up">
          {/* Escrow Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-zinc-500 text-xs">{t("disputes.buyer")}</span>
              <p className="text-white font-mono text-xs mt-0.5">{truncateAddress(escrow.buyer)}</p>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">{t("disputes.seller")}</span>
              <p className="text-white font-mono text-xs mt-0.5">{truncateAddress(escrow.seller)}</p>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">{t("disputes.amount")}</span>
              <p className="text-neon-cyan font-mono text-xs mt-0.5">{amountEth} OG</p>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">{t("disputes.deadline")}</span>
              <p className="text-white text-xs mt-0.5">{deadlineDate}</p>
            </div>
          </div>

          {/* Role indicator */}
          <div className="flex gap-2">
            {isBuyer && <span className="px-2 py-1 rounded-md text-xs bg-blue-400/10 text-blue-400">You are Buyer</span>}
            {isSeller && <span className="px-2 py-1 rounded-md text-xs bg-purple-400/10 text-purple-400">You are Seller</span>}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {escrow.status === EscrowStatus.Created && isBuyer && (
              <ActionBtn
                label={t("disputes.fundBtn")}
                icon={<Banknote className="w-4 h-4" />}
                loading={actionLoading === "fund"}
                variant="cyan"
                onClick={() => handleAction("fund", () => fundEscrow(escrowId, escrow.amount + escrow.fee))}
              />
            )}
            {(escrow.status === EscrowStatus.Funded || escrow.status === EscrowStatus.Evidence) && (isBuyer || isSeller) && (
              <ActionBtn
                label={t("disputes.releaseBtn")}
                icon={<CheckCircle2 className="w-4 h-4" />}
                loading={actionLoading === "release"}
                variant="green"
                onClick={() => handleAction("release", () => releaseEscrow(escrowId))}
              />
            )}
            {(escrow.status === EscrowStatus.Funded || escrow.status === EscrowStatus.Evidence) && (isBuyer || isSeller) && (
              <ActionBtn
                label={t("disputes.disputeBtn")}
                icon={<AlertCircle className="w-4 h-4" />}
                loading={actionLoading === "dispute"}
                variant="red"
                onClick={() => handleAction("dispute", () => disputeEscrow(escrowId))}
              />
            )}
            {(escrow.status === EscrowStatus.Funded || escrow.status === EscrowStatus.Evidence) && (
              <ActionBtn
                label={t("disputes.refundBtn")}
                icon={<Clock className="w-4 h-4" />}
                loading={actionLoading === "refund"}
                variant="yellow"
                onClick={() => handleAction("refund", () => refundEscrow(escrowId))}
              />
            )}
          </div>

          {/* Evidence Section */}
          {escrow.status !== EscrowStatus.Created && (
            <EvidenceSection escrowId={escrowId} escrow={escrow} currentUser={currentUser} isParty={isBuyer || isSeller} onUpdate={onUpdate} />
          )}

          {/* Voting Section */}
          {escrow.status === EscrowStatus.Disputed && (
            <VotingSection escrowId={escrowId} currentUser={currentUser} isBuyer={isBuyer} isSeller={isSeller} onUpdate={onUpdate} />
          )}
        </div>
      )}
    </div>
  );
}

// ===== Evidence Section =====

function EvidenceSection({
  escrowId,
  escrow,
  currentUser,
  isParty,
  onUpdate,
}: {
  escrowId: bigint;
  escrow: Escrow;
  currentUser: string;
  isParty: boolean;
  onUpdate: () => void;
}) {
  const { t } = useI18n();
  const [evidenceList, setEvidenceList] = useState<EvidenceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  // AI Arbitration state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    buyerWins: boolean;
    confidence: number;
    reasoning: string;
  } | null>(null);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    loadEvidence();
  }, [escrowId]);

  const loadEvidence = async () => {
    setLoading(true);
    try {
      const ids = await getEvidenceByEscrow(escrowId);
      const items = await Promise.all(ids.map((id) => getEvidence(id)));
      setEvidenceList(items);
    } catch {
      // No evidence yet
    } finally {
      setLoading(false);
    }
  };

  /** Convert File to base64 string for server upload */
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove data URL prefix: "data:application/...;base64,"
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileDrop = async (file: File) => {
    setUploading(true);
    setUploadStep("Uploading to 0G Storage...");
    setUploadError("");

    try {
      // Server-side upload (bypasses browser Mixed Content restriction)
      const fileData = await fileToBase64(file);

      const res = await fetch("/api/storage/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileData }),
      });

      const data = await res.json();
      if (!data.success || !data.rootHash) {
        throw new Error(data.error || "Storage upload failed");
      }

      const rootHash = data.rootHash;
      console.log(`[Evidence] Uploaded: ${file.name} → ${rootHash}`);

      // Submit evidence on-chain
      setUploadStep("Submitting evidence on-chain...");
      await submitEvidenceOnChain(escrowId, rootHash, file.name, `Evidence uploaded by ${truncateAddress(currentUser)}`);
      
      setShowUpload(false);
      await loadEvidence();
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      setUploadStep("");
    }
  };

  const handleAIArbitrate = async () => {
    setAiLoading(true);
    setAiError("");
    setAiResult(null);

    try {
      // Fetch evidence content from 0G Storage for AI context
      const { downloadByRootHash } = await import("@/lib/storage");
      const { getNetworkConfig } = await import("@/lib/storage");
      const networkConfig = getNetworkConfig("turbo");

      const evidenceContexts: Array<{ filename: string; content: string }> = [];
      for (const ev of evidenceList) {
        try {
          const [data] = await downloadByRootHash(ev.rootHash, networkConfig.storageRpc);
          if (data) {
            const text = new TextDecoder().decode(data);
            evidenceContexts.push({ filename: ev.filename, content: text.slice(0, 2000) });
          }
        } catch {
          evidenceContexts.push({ filename: ev.filename, content: "[Binary file - could not read content]" });
        }
      }

      // Call AI arbitration API
      const res = await fetch("/api/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "arbitrate",
          disputeDescription: escrow.description,
          evidenceContexts,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "AI arbitration failed");
      
      setAiResult(data.verdict);

      // Record AI verdict hash on-chain
      const verdictStr = JSON.stringify(data.verdict);
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(verdictStr));
      const hashHex = "0x" + Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      
      try {
        await recordAIVerdict(escrowId, hashHex);
      } catch {
        // Non-critical — AI analysis is still shown
        console.warn("Failed to record AI verdict on-chain");
      }
    } catch (err: any) {
      setAiError(err?.message || "AI arbitration failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-neon-purple" />
          {t("disputes.evidence.title")}
          <span className="text-xs text-zinc-500 font-normal">({evidenceList.length})</span>
        </h3>
        {isParty && (
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors flex items-center gap-1"
          >
            <Upload className="w-3 h-3" />
            {showUpload ? "Hide Upload" : "Upload Evidence"}
          </button>
        )}
      </div>

      {/* Upload Area */}
      {showUpload && isParty && (
        <div className="space-y-3">
          {uploading && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-neon-cyan/5 border border-neon-cyan/10">
              <Loader2 className="w-4 h-4 animate-spin text-neon-cyan" />
              <span className="text-xs text-neon-cyan">{uploadStep}</span>
            </div>
          )}
          {uploadError && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>{uploadError}</span>
            </div>
          )}
          <FileDropzone onFileDrop={handleFileDrop} disabled={uploading} />
        </div>
      )}

      {/* Evidence List */}
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
      ) : evidenceList.length === 0 ? (
        <p className="text-xs text-zinc-500">{t("disputes.evidence.noEvidence")}</p>
      ) : (
        <div className="space-y-2">
          {evidenceList.map((ev, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
              <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{ev.filename}</p>
                <p className="text-xs text-zinc-500">
                  {truncateAddress(ev.submitter)} · {new Date(Number(ev.timestamp) * 1000).toLocaleString()}
                </p>
              </div>
              <code className="text-xs text-zinc-600 font-mono truncate max-w-[120px]">{ev.rootHash.slice(0, 10)}...</code>
            </div>
          ))}
        </div>
      )}

      {/* AI Arbitration Panel */}
      {escrow.status === EscrowStatus.Disputed && (
        <div className="border-t border-white/[0.06] pt-4 space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-neon-cyan" />
            {t("disputes.arbitration.title")}
            <span className="text-[10px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded">0G Compute</span>
          </h4>

          {!aiResult && !aiError && (
            <button
              onClick={handleAIArbitrate}
              disabled={aiLoading}
              className="w-full py-3 rounded-xl text-sm font-medium border border-neon-purple/20 bg-neon-purple/5 text-neon-purple hover:bg-neon-purple/10 hover:border-neon-purple/30 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("disputes.arbitration.analyzing")}
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  {t("disputes.arbitration.analyze")}
                </>
              )}
            </button>
          )}

          {aiError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-xs animate-fade-in">
              <AlertCircle className="w-3 h-3" />
              <span>{aiError}</span>
            </div>
          )}

          {aiResult && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${aiResult.buyerWins ? "bg-blue-400/20 text-blue-400" : "bg-red-400/20 text-red-400"}`}>
                    <Scale className="w-3 h-3" />
                  </div>
                  <span className={`text-sm font-bold ${aiResult.buyerWins ? "text-blue-400" : "text-red-400"}`}>
                    {aiResult.buyerWins ? t("disputes.arbitration.buyerWins") : t("disputes.arbitration.sellerWins")}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  {t("disputes.arbitration.confidence")}: <span className="text-white font-semibold">{aiResult.confidence}%</span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    aiResult.buyerWins
                      ? "bg-gradient-to-r from-blue-500 to-blue-400"
                      : "bg-gradient-to-r from-red-500 to-red-400"
                  }`}
                  style={{ width: `${aiResult.confidence}%` }}
                />
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{aiResult.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Voting Section =====

function VotingSection({
  escrowId,
  currentUser,
  isBuyer,
  isSeller,
  onUpdate,
}: {
  escrowId: bigint;
  currentUser: string;
  isBuyer: boolean;
  isSeller: boolean;
  onUpdate: () => void;
}) {
  const { t } = useI18n();
  const [arbitration, setArbitration] = useState<Arbitration | null>(null);
  const [voterList, setVoterList] = useState<string[]>([]);
  const [userVoted, setUserVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  useEffect(() => {
    loadArbitration();
  }, [escrowId]);

  const loadArbitration = async () => {
    try {
      const [arb, voters] = await Promise.all([
        getArbitration(escrowId),
        getEscrowVoters(escrowId),
      ]);
      setArbitration(arb as any);
      setVoterList(voters);
      const voted = await hasVoted(escrowId, currentUser as Address);
      setUserVoted(voted);
    } catch {}
  };

  const handleVote = async (voteForBuyer: boolean) => {
    setActionLoading("vote");
    try {
      await castVote(escrowId, voteForBuyer);
      loadArbitration();
    } catch (err: any) {
      console.error("Vote failed:", err);
    } finally {
      setActionLoading("");
    }
  };

  const handleResolve = async () => {
    setActionLoading("resolve");
    try {
      await resolveEscrow(escrowId);
      onUpdate();
    } catch (err: any) {
      console.error("Resolve failed:", err);
    } finally {
      setActionLoading("");
    }
  };

  const cannotVote = isBuyer || isSeller;

  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Vote className="w-4 h-4 text-yellow-400" />
        {t("disputes.voting.title")}
      </h3>

      {/* Arbitration Stats */}
      {arbitration && (
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-blue-400/5 border border-blue-400/10">
            <p className="text-lg font-bold text-blue-400">{arbitration.votesForBuyer.toString()}</p>
            <p className="text-xs text-zinc-500">{t("disputes.voting.votesForBuyer")}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-400/5 border border-red-400/10">
            <p className="text-lg font-bold text-red-400">{(arbitration.totalVoters - arbitration.votesForBuyer).toString()}</p>
            <p className="text-xs text-zinc-500">{t("disputes.voting.votesForSeller")}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <p className="text-lg font-bold text-white">{arbitration.totalVoters.toString()}</p>
            <p className="text-xs text-zinc-500">{t("disputes.voting.totalVoters")}</p>
          </div>
        </div>
      )}

      {/* Voter List */}
      {voterList.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {voterList.map((v, i) => (
            <span key={i} className="px-2 py-1 rounded-md text-xs font-mono bg-white/[0.04] text-zinc-400">
              {truncateAddress(v)}
            </span>
          ))}
        </div>
      )}

      {/* Vote Buttons */}
      {!arbitration?.resolved && !cannotVote && (
        <div className="space-y-2">
          {userVoted ? (
            <p className="text-sm text-zinc-400">{t("disputes.voting.alreadyVoted")}</p>
          ) : (
            <>
              {cannotVote ? (
                <p className="text-sm text-amber-400">{t("disputes.voting.cannotVoteOwn")}</p>
              ) : (
                <div className="flex gap-2">
                  <ActionBtn
                    label={t("disputes.voting.voteForBuyer")}
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    loading={actionLoading === "vote"}
                    variant="blue"
                    onClick={() => handleVote(true)}
                  />
                  <ActionBtn
                    label={t("disputes.voting.voteForSeller")}
                    icon={<XCircle className="w-4 h-4" />}
                    loading={actionLoading === "vote"}
                    variant="red"
                    onClick={() => handleVote(false)}
                  />
                </div>
              )}
            </>
          )}
          <p className="text-xs text-zinc-500">{t("disputes.voting.minVoters")}</p>
        </div>
      )}

      {/* Resolve Button */}
      {arbitration && arbitration.totalVoters >= BigInt(3) && !arbitration.resolved && (
        <ActionBtn
          label={t("disputes.voting.resolveBtn")}
          icon={<Scale className="w-4 h-4" />}
          loading={actionLoading === "resolve"}
          variant="cyan"
          onClick={handleResolve}
        />
      )}

      {/* Resolved */}
      {arbitration?.resolved && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-400/10 border border-emerald-400/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-400">
            {t("disputes.voting.resolved", {
              result: arbitration.buyerWins ? t("disputes.arbitration.buyerWins") : t("disputes.arbitration.sellerWins"),
            })}
          </span>
        </div>
      )}
    </div>
  );
}

// ===== Withdraw Banner =====

function WithdrawBanner({ amount, onUpdate }: { amount: string; onUpdate: () => void }) {
  const { t } = useI18n();
  const [withdrawing, setWithdrawing] = useState(false);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      await withdrawFunds();
      onUpdate();
    } catch (err) {
      console.error("Withdraw failed:", err);
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <button
      onClick={handleWithdraw}
      disabled={withdrawing}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20 transition-all text-sm"
    >
      {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
      <span>{t("disputes.withdrawBtn")}: {amount} OG</span>
    </button>
  );
}

// ===== Action Button =====

function ActionBtn({
  label,
  icon,
  loading,
  variant,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  loading: boolean;
  variant: "cyan" | "green" | "red" | "yellow" | "blue";
  onClick: () => void;
}) {
  const variantMap = {
    cyan: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 hover:bg-neon-cyan/20 hover:border-neon-cyan/30 hover:shadow-[0_0_15px_rgba(0,229,255,0.1)]",
    green: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 hover:bg-emerald-400/20 hover:border-emerald-400/30 hover:shadow-[0_0_15px_rgba(52,211,153,0.1)]",
    red: "bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/20 hover:border-red-400/30 hover:shadow-[0_0_15px_rgba(248,113,113,0.1)]",
    yellow: "bg-amber-400/10 text-amber-400 border-amber-400/20 hover:bg-amber-400/20 hover:border-amber-400/30 hover:shadow-[0_0_15px_rgba(251,191,36,0.1)]",
    blue: "bg-blue-400/10 text-blue-400 border-blue-400/20 hover:bg-blue-400/20 hover:border-blue-400/30 hover:shadow-[0_0_15px_rgba(96,165,250,0.1)]",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-all duration-200 ${variantMap[variant]} ${loading ? "opacity-50 cursor-wait" : "active:scale-95"}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}
