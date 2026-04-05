"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/context";
import { getEvidenceCount, getEvidence } from "@/lib/contracts";
import { EXPLORER_URL } from "@/lib/config";
import { truncateAddress } from "@/lib/utils";
import { FileSearch, Loader2, Search, ExternalLink, FileText } from "lucide-react";
import type { Evidence } from "@/lib/contracts";

export default function EvidencePage() {
  const { t } = useI18n();

  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">{t("evidence.title")}</h1>
          <p className="text-zinc-400">{t("evidence.subtitle")}</p>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-neon-purple/10 border border-neon-purple/20 text-sm text-neon-purple font-medium">
          {t("evidence.totalCount")}: {evidenceList.length}
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
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
          <FileSearch className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          <span className="ml-2 text-zinc-400">{t("evidence.loading")}</span>
        </div>
      ) : filteredEvidence.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileSearch className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
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
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">{t("evidence.escrowId")}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">{t("evidence.filename")}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">{t("evidence.submitter")}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">{t("evidence.timestamp")}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">{t("evidence.description")}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">{t("evidence.rootHash")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvidence.map((ev, i) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-neon-cyan">#{ev.escrowId.toString()}</td>
                    <td className="px-4 py-3 text-sm text-white">{ev.filename}</td>
                    <td className="px-4 py-3 text-sm font-mono text-zinc-400">{truncateAddress(ev.submitter)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{new Date(Number(ev.timestamp) * 1000).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400 max-w-[200px] truncate">{ev.description}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-zinc-500 truncate max-w-[100px]">{ev.rootHash.slice(0, 10)}...</code>
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
              <div key={i} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-neon-cyan">#{ev.escrowId.toString()}</span>
                  <span className="text-xs text-zinc-500">{new Date(Number(ev.timestamp) * 1000).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-white">{ev.filename}</span>
                </div>
                <p className="text-xs text-zinc-400">{ev.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">by {truncateAddress(ev.submitter)}</span>
                  <code className="text-xs text-zinc-600 font-mono">{ev.rootHash.slice(0, 16)}...</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
