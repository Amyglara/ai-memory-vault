"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useI18n } from "@/context";
import {
  getEscrow,
  getEscrowsByBuyer,
  getEscrowsBySeller,
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
  submitEvidence,
} from "@/lib/contracts";
import { EXPLORER_URL } from "@/lib/config";
import { truncateAddress } from "@/lib/utils";
import FileDropzone from "@/components/common/FileDropzone";
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

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: t("disputes.tabs.all") },
    { key: "active", label: t("disputes.tabs.active") },
    { key: "disputed", label: t("disputes.tabs.disputed") },
    { key: "resolved", label: t("disputes.tabs.resolved") },
  ];

  if (!isConnected) {
    return (
      <div className="animate-slide-up">
        <div className="glass-card p-12 text-center">
          <Swords className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">{t("disputes.connectWallet")}</h2>
          <p className="text-zinc-500">{t("disputes.connectWalletHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">{t("disputes.title")}</h1>
          <p className="text-zinc-400">{t("disputes.subtitle")}</p>
        </div>
        {Number(pendingWithdrawal) > 0 && (
          <WithdrawBanner amount={pendingWithdrawal} onUpdate={loadEscrows} />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === tabItem.key
                ? "bg-neon-cyan/10 text-neon-cyan"
                : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {tabItem.label}
            <span className="ml-1.5 text-xs opacity-60">
              ({escrows.filter((e) => {
                if (tabItem.key === "all") return true;
                if (tabItem.key === "active") return e.status === EscrowStatus.Funded || e.status === EscrowStatus.Evidence;
                if (tabItem.key === "disputed") return e.status === EscrowStatus.Disputed;
                if (tabItem.key === "resolved") return e.status === EscrowStatus.Resolved || e.status === EscrowStatus.Released || e.status === EscrowStatus.Refunded;
                return true;
              }).length})
            </span>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          <span className="ml-2 text-zinc-400">{t("disputes.loading")}</span>
        </div>
      ) : filteredEscrows.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Shield className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">{t("disputes.noEscrows")}</p>
          <p className="text-zinc-500 text-sm mt-1">{t("disputes.noEscrowsHint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEscrows.map((escrow, index) => (
            <EscrowCard
              key={escrowIds[index]?.toString() || index}
              escrowId={escrowIds[index]!}
              escrow={escrow}
              isExpanded={expandedId === escrowIds[index]}
              onToggle={() => setExpandedId(expandedId === escrowIds[index] ? null : escrowIds[index]!)}
              currentUser={address!}
              onUpdate={loadEscrows}
            />
          ))}
        </div>
      )}
    </div>
  );
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
    <div className="glass-card overflow-hidden">
      {/* Card Header */}
      <button onClick={onToggle} className="w-full p-4 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors">
        <div className="w-10 h-10 rounded-lg bg-neon-glow flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-zinc-500">#{escrowId.toString()}</span>
            <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
          </div>
          <p className="text-sm text-zinc-300 truncate">{escrow.description}</p>
          <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
            <span>💰 {amountEth} OG</span>
            <span>🕐 {deadlineDate}</span>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
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

  const handleFileDrop = async (file: File) => {
    setUploading(true);
    setUploadStep("Preparing upload...");
    setUploadError("");

    try {
      // Step 1: Create blob and generate Merkle tree
      setUploadStep("Generating Merkle tree...");
      const { createBlob, generateMerkleTree, getRootHash, uploadToStorage, getNetworkConfig } = await import("@/lib/storage");
      const blob = createBlob(file);
      const [tree, treeErr] = await generateMerkleTree(blob);
      if (treeErr || !tree) throw new Error(treeErr?.message || "Failed to generate Merkle tree");

      const [rootHash, hashErr] = getRootHash(tree);
      if (hashErr || !rootHash) throw new Error(hashErr?.message || "Failed to get root hash");

      // Step 2: Upload to 0G Storage
      setUploadStep("Uploading to 0G Storage...");
      const networkConfig = getNetworkConfig("turbo");
      const { getBrowserProvider, getBrowserSigner } = await import("@/lib/storage");
      const [provider, provErr] = await getBrowserProvider();
      if (provErr || !provider) throw new Error(provErr?.message || "No wallet provider");
      const [signer, signerErr] = await getBrowserSigner(provider);
      if (signerErr || !signer) throw new Error(signerErr?.message || "Failed to get signer");

      const [uploaded, uploadErr] = await uploadToStorage(blob, networkConfig.storageRpc, networkConfig.l1Rpc, signer);
      if (!uploaded || uploadErr) throw new Error(uploadErr?.message || "Storage upload failed");

      // Step 3: Submit evidence on-chain
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
            <Cpu className="w-4 h-4 text-neon-cyan" />
            AI Arbitration
            <span className="text-xs text-zinc-500 font-normal">0G Compute</span>
          </h4>

          {!aiResult && !aiError && (
            <button
              onClick={handleAIArbitrate}
              disabled={aiLoading}
              className="neon-button w-full flex items-center justify-center gap-2 py-2.5 text-sm"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing evidence with AI...
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  Run AI Analysis
                </>
              )}
            </button>
          )}

          {aiError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>{aiError}</span>
            </div>
          )}

          {aiResult && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${aiResult.buyerWins ? "text-blue-400" : "text-red-400"}`}>
                  {aiResult.buyerWins ? "Buyer Wins" : "Seller Wins"}
                </span>
                <span className="text-xs text-zinc-500">
                  Confidence: <span className="text-white font-medium">{aiResult.confidence}%</span>
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    aiResult.buyerWins ? "bg-blue-400" : "bg-red-400"
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
    cyan: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 hover:bg-neon-cyan/20",
    green: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 hover:bg-emerald-400/20",
    red: "bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/20",
    yellow: "bg-amber-400/10 text-amber-400 border-amber-400/20 hover:bg-amber-400/20",
    blue: "bg-blue-400/10 text-blue-400 border-blue-400/20 hover:bg-blue-400/20",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${variantMap[variant]} ${loading ? "opacity-50" : ""}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}
