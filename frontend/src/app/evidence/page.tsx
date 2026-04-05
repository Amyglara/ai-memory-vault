"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/context";
import { getEvidenceCount, getEvidence } from "@/lib/contracts";
import { EXPLORER_URL } from "@/lib/config";
import { truncateAddress, truncateHash } from "@/lib/utils";
import { FileSearch, Loader2, Search, ExternalLink, FileText, Download, Copy, Check, Inbox, Hash } from "lucide-react";
import type { Evidence } from "@/lib/contracts";
import PageLayout from "@/components/layout/PageLayout";

export default function EvidencePage() {
  const { t } = useI18n();

  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const loadEvidence = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const count = await getEvidenceCount();
      const promises = [];
      for (let i = 0; i < Number(count); i++) {
        promises.push(getEvidence(BigInt(i)));
      }
      const items = await Promise.all(promises);
      setEvidenceList(items);
    } catch {
      setError(t("evidence.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  const filteredEvidence = evidenceList.filter((ev) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      ev.escrowId.toString().includes(q) ||
      ev.submitter.toLowerCase().includes(q) ||
      ev.filename.toLowerCase().includes(q) ||
      ev.description.toLowerCase().includes(q) ||
      ev.rootHash.toLowerCase().includes(q)
    );
  });

  const handleDownload = async (ev: Evidence) => {
    setDownloading(ev.rootHash);
    try {
      const { downloadByRootHash, downloadBlobAsFile, getNetworkConfig } = await import("@/lib/storage");
      const networkConfig = getNetworkConfig("turbo");
      const [data, err] = await downloadByRootHash(ev.rootHash, networkConfig.storageRpc);
      if (err || !data) throw new Error(err?.message || "Download failed");
      downloadBlobAsFile(data, ev.filename);
    } catch (err: any) {
      setError(err?.message || "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch {}
  };

  const pageContent = (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{t("evidence.title")}</h1>
          <p className="text-zinc-400 text-sm">{t("evidence.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-neon-purple/10 border border-neon-purple/20 text-sm text-neon-purple font-medium tabular-nums">
            {t("evidence.totalCount")}: {evidenceList.length}
          </div>
          <button
            onClick={loadEvidence}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/[0.06] disabled:opacity-50"
          >
            <FileSearch className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("nav.refresh")}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("evidence.searchPlaceholder")}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-all text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-sm animate-fade-in">
          <FileSearch className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          <span className="text-zinc-400 text-sm">{t("evidence.loading")}</span>
        </div>
      ) : filteredEvidence.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-400">{t("evidence.noEvidence")}</p>
          <p className="text-zinc-500 text-sm mt-1">{t("evidence.noEvidenceHint")}</p>
        </div>
      ) : (
        /* Evidence Table */
        <div className="glass-card overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{t("evidence.escrowId")}</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{t("evidence.filename")}</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{t("evidence.submitter")}</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{t("evidence.timestamp")}</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{t("evidence.description")}</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Root Hash</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvidence.map((ev, i) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3 text-sm font-mono text-neon-cyan">#{ev.escrowId.toString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                        <span className="text-sm text-white truncate max-w-[150px]">{ev.filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-zinc-400">{truncateAddress(ev.submitter)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{new Date(Number(ev.timestamp) * 1000).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400 max-w-[200px] truncate">{ev.description}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleCopyHash(ev.rootHash)}
                        className="flex items-center gap-1.5 group/hover text-xs font-mono text-zinc-500 hover:text-neon-cyan transition-colors"
                        title="Click to copy"
                      >
                        <Hash className="w-3 h-3" />
                        {truncateHash(ev.rootHash, 8, 6)}
                        {copiedHash === ev.rootHash ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-0 group-hover/hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownload(ev)}
                          disabled={downloading === ev.rootHash}
                          className="p-2 rounded-lg text-zinc-400 hover:text-neon-cyan hover:bg-neon-cyan/10 transition-all disabled:opacity-50"
                          title="Download file"
                        >
                          {downloading === ev.rootHash ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        <a
                          href={`${EXPLORER_URL}/tx/${ev.rootHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg text-zinc-400 hover:text-neon-purple hover:bg-neon-purple/10 transition-all"
                          title="View on explorer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-white/[0.06]">
            {filteredEvidence.map((ev, i) => (
              <div key={i} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neon-cyan">#{ev.escrowId.toString()}</span>
                    <span className="text-xs text-zinc-500">{new Date(Number(ev.timestamp) * 1000).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDownload(ev)}
                      disabled={downloading === ev.rootHash}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-neon-cyan hover:bg-neon-cyan/10 transition-all disabled:opacity-50"
                    >
                      {downloading === ev.rootHash ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={`${EXPLORER_URL}/tx/${ev.rootHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-neon-purple hover:bg-neon-purple/10 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-white">{ev.filename}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{ev.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded">by {truncateAddress(ev.submitter)}</span>
                  <button
                    onClick={() => handleCopyHash(ev.rootHash)}
                    className="text-[10px] font-mono text-zinc-600 hover:text-neon-cyan transition-colors flex items-center gap-1"
                  >
                    {truncateHash(ev.rootHash, 8, 6)}
                    {copiedHash === ev.rootHash ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return <PageLayout>{pageContent}</PageLayout>;
}
