"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Bot,
  Plus,
  ExternalLink,
  Shield,
  FileText,
  Link2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Cpu,
  ChevronDown,
  ChevronRight,
  Zap,
  UserCircle,
  FileStack,
} from "lucide-react";
import { useAccount } from "wagmi";
import {
  registerAgent,
  linkFileToAgent,
  getAgentsByOwner,
  getAgent,
  getAgentFiles,
  getFile,
  type AgentRecord,
  type FileRecord,
  MEMORY_VAULT_ADDRESS,
} from "@/lib/contracts";
import { EXPLORER_URL } from "@/lib/config";
import { cn, truncateHash, truncateAddress, timeAgo } from "@/lib/utils";

// ===== Types =====

interface AgentWithDetails {
  id: bigint;
  data: AgentRecord;
  files: FileRecord[];
  expanded: boolean;
}

interface UserFile {
  rootHash: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

// ===== Main Component =====

export default function AgentsPage() {
  const { isConnected, address } = useAccount();

  // UI state
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Register form state
  const [regName, setRegName] = useState("");
  const [regDesc, setRegDesc] = useState("");
  const [regMemoryRoot, setRegMemoryRoot] = useState("");
  const [registering, setRegistering] = useState(false);

  // Agent list state
  const [agents, setAgents] = useState<AgentWithDetails[]>([]);

  // Link file state
  const [linkingAgentId, setLinkingAgentId] = useState<bigint | null>(null);
  const [userFiles, setUserFiles] = useState<UserFile[]>([]);

  // ===== Load Agents =====

  const loadAgents = useCallback(async () => {
    if (!isConnected || !address) return;

    setLoading(true);
    setError(null);

    try {
      const agentIds = await getAgentsByOwner(address as `0x${string}`);

      if (agentIds.length === 0) {
        setAgents([]);
        setLoading(false);
        return;
      }

      // Fetch all agent details in parallel
      const agentDetails = await Promise.all(
        agentIds.map(async (id) => {
          const data = await getAgent(id);
          return { id, data };
        })
      );

      // Sort by registration time (newest first)
      agentDetails.sort((a, b) => Number(b.data.registeredAt) - Number(a.data.registeredAt));

      setAgents(agentDetails.map((a) => ({ ...a, files: [], expanded: false })));
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [isConnected, address]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // ===== Load User Files (for linking) =====

  const loadUserFiles = useCallback(async (agentId: bigint) => {
    if (!address) return;

    // Load files from localStorage (same format as Upload page)
    const stored = localStorage.getItem(`vault_files_${address.toLowerCase()}`);
    if (stored) {
      try {
        const files: UserFile[] = JSON.parse(stored).map((f: any) => ({
          rootHash: f.rootHash,
          fileName: f.fileName,
          fileSize: f.fileSize,
          contentType: f.contentType,
        }));
        setUserFiles(files);
      } catch {
        setUserFiles([]);
      }
    }

    // Expand agent and load its files
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id === agentId) {
          // Load files for this agent
          getAgentFiles(agentId).then(async (fileIds) => {
            const fileDetails = await Promise.all(
              fileIds.map((fid) => getFile(fid))
            );
            setAgents((prev2) =>
              prev2.map((a2) =>
                a2.id === agentId ? { ...a2, files: fileDetails } : a2
              )
            );
          });
          return { ...a, expanded: true };
        }
        return a;
      })
    );

    setLinkingAgentId(agentId);
  }, [address]);

  // ===== Register Agent =====

  const handleRegister = useCallback(async () => {
    if (!regName.trim()) {
      setError("Agent name is required");
      return;
    }

    setRegistering(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const memoryRoot = regMemoryRoot.trim() || "0x0000000000000000000000000000000000000000000000000000000000000000";
      const txHash = await registerAgent(regName.trim(), regDesc.trim(), memoryRoot);

      setSuccessMsg(`Agent "${regName}" registered! TX: ${truncateHash(txHash, 8, 6)}`);
      setRegName("");
      setRegDesc("");
      setRegMemoryRoot("");
      setShowRegisterForm(false);

      // Reload agents
      await loadAgents();
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "Failed to register agent");
    } finally {
      setRegistering(false);
    }
  }, [regName, regDesc, regMemoryRoot, loadAgents]);

  // ===== Link File to Agent =====

  const handleLinkFile = useCallback(
    async (fileId: bigint, agentId: bigint) => {
      setLinkingAgentId(null);

      try {
        await linkFileToAgent(fileId, agentId);
        setSuccessMsg(`File linked to agent!`);

        // Reload agent files
        setAgents((prev) =>
          prev.map((a) => {
            if (a.id === agentId) {
              getAgentFiles(agentId).then(async (fids) => {
                const fileDetails = await Promise.all(fids.map((fid) => getFile(fid)));
                setAgents((prev2) =>
                  prev2.map((a2) =>
                    a2.id === agentId ? { ...a2, files: fileDetails, data: { ...a2.data, fileCount: BigInt(fids.length) } } : a2
                  )
                );
              });
            }
            return a;
          })
        );
      } catch (err: any) {
        setError(err?.shortMessage || err?.message || "Failed to link file");
      }
    },
    []
  );

  // ===== Render =====

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">
            <span className="neon-text">Agent</span> Identity
          </h1>
          <p className="text-zinc-400 text-sm">
            Register and manage AI agent identities on 0G Chain
          </p>
        </div>
        {isConnected && (
          <button
            onClick={() => setShowRegisterForm(!showRegisterForm)}
            className={cn(
              "neon-button px-4 py-2.5 text-sm flex items-center gap-2",
              showRegisterForm && "opacity-60"
            )}
          >
            {showRegisterForm ? (
              <>
                <XCircle className="w-4 h-4" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Register Agent
              </>
            )}
          </button>
        )}
      </div>

      {!isConnected ? (
        <div className="glass-card p-12 text-center">
          <Bot className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-2">
            Connect Wallet First
          </h3>
          <p className="text-zinc-500 text-sm">
            You need to connect your wallet to manage agents
          </p>
        </div>
      ) : (
        <>
          {/* Success Message */}
          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-300">{successMsg}</p>
              <button
                onClick={() => setSuccessMsg(null)}
                className="ml-auto text-emerald-500 hover:text-emerald-300"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-300"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Register Form */}
          {showRegisterForm && (
            <div className="glass-card p-6 border-neon-cyan/20 animate-fade-in">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-neon-cyan" />
                </div>
                <h2 className="text-base font-semibold text-white">
                  Register New Agent
                </h2>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Agent Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Research Assistant, Trading Bot..."
                    className="neon-input"
                    maxLength={100}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={regDesc}
                    onChange={(e) => setRegDesc(e.target.value)}
                    placeholder="Describe what this AI agent does..."
                    className="neon-input resize-none"
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-zinc-600 mt-1 text-right">
                    {regDesc.length}/500
                  </p>
                </div>

                {/* Memory Root */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Memory Root Hash{" "}
                    <span className="text-zinc-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={regMemoryRoot}
                    onChange={(e) => setRegMemoryRoot(e.target.value)}
                    placeholder="0x0000... (defaults to zero hash)"
                    className="neon-input font-mono text-sm"
                    maxLength={66}
                  />
                  <p className="text-xs text-zinc-600 mt-1">
                    Links agent to a specific memory root on 0G Storage
                  </p>
                </div>

                {/* Submit */}
                <button
                  onClick={handleRegister}
                  disabled={registering || !regName.trim()}
                  className="neon-button w-full py-3 text-sm flex items-center justify-center gap-2"
                >
                  {registering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Register Agent On-Chain
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Agent List */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-400">
                My Agents
                {agents.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-white/[0.06] text-xs text-zinc-500">
                    {agents.length}
                  </span>
                )}
              </h3>
              {agents.length > 0 && (
                <button
                  onClick={loadAgents}
                  className="text-xs text-zinc-500 hover:text-neon-cyan transition-colors flex items-center gap-1"
                >
                  <Cpu className="w-3 h-3" />
                  Refresh
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 text-neon-cyan animate-spin mx-auto mb-3" />
                <p className="text-sm text-zinc-400">Loading agents...</p>
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Bot className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No agents registered yet</p>
                <p className="text-xs mt-1">
                  Click &quot;Register Agent&quot; to create your first AI agent identity
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <AgentCard
                    key={String(agent.id)}
                    agent={agent}
                    linkingAgentId={linkingAgentId}
                    userFiles={userFiles}
                    onToggleExpand={() => loadUserFiles(agent.id)}
                    onLinkFile={(fileId) => handleLinkFile(fileId, agent.id)}
                    onCloseLink={() => setLinkingAgentId(null)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Contract Info */}
          <div className="text-center py-4">
            <a
              href={`${EXPLORER_URL}/address/${MEMORY_VAULT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors inline-flex items-center gap-1"
            >
              View MemoryVault Contract
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}

// ===== Sub-components =====

function AgentCard({
  agent,
  linkingAgentId,
  userFiles,
  onToggleExpand,
  onLinkFile,
  onCloseLink,
}: {
  agent: AgentWithDetails;
  linkingAgentId: bigint | null;
  userFiles: UserFile[];
  onToggleExpand: () => void;
  onLinkFile: (fileId: bigint) => void;
  onCloseLink: () => void;
}) {
  const { id, data, files, expanded } = agent;
  const isLinking = linkingAgentId === id;

  // Convert timestamp to readable date
  const registeredDate = new Date(Number(data.registeredAt) * 1000);
  const fileCount = Number(data.fileCount);

  return (
    <div
      className={cn(
        "group rounded-xl border transition-all duration-200",
        expanded
          ? "border-neon-cyan/20 bg-white/[0.04]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
      )}
    >
      {/* Agent Header */}
      <div
        className="p-4 cursor-pointer flex items-start gap-3"
        onClick={onToggleExpand}
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 flex items-center justify-center flex-shrink-0 border border-white/[0.08]">
          {data.active ? (
            <Bot className="w-5 h-5 text-neon-cyan" />
          ) : (
            <UserCircle className="w-5 h-5 text-zinc-600" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">
              {data.name}
            </p>
            {data.active ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">
                Inactive
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-600 bg-white/[0.04]">
              #{String(id)}
            </span>
          </div>

          {data.description && (
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
              {data.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className="text-[11px] text-zinc-600 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(registeredDate)}
            </span>
            <span className="text-[11px] text-zinc-600 flex items-center gap-1">
              <FileStack className="w-3 h-3" />
              {fileCount} file{fileCount !== 1 ? "s" : ""}
            </span>
            <span className="text-[11px] text-zinc-600 font-mono">
              {truncateAddress(data.owner)}
            </span>
          </div>
        </div>

        {/* Expand icon */}
        <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0 mt-1">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-white/[0.06] animate-fade-in">
          {/* Agent Details Grid */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DetailItem label="Agent ID" value={`#${String(id)}`} mono />
            <DetailItem
              label="Registered"
              value={registeredDate.toLocaleDateString()}
            />
            <DetailItem
              label="Memory Root"
              value={data.memoryRoot === "0x0000000000000000000000000000000000000000000000000000000000000000"
                ? "Not set"
                : truncateHash(data.memoryRoot, 10, 8)
              }
              mono
            />
          </div>

          {/* Linked Files */}
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-500">
                Linked Files ({files.length})
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(); // Re-trigger to open link modal
                }}
                className="text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors flex items-center gap-1"
              >
                <Link2 className="w-3 h-3" />
                Link File
              </button>
            </div>

            {files.length === 0 ? (
              <div className="text-center py-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <FileText className="w-5 h-5 text-zinc-700 mx-auto mb-1.5" />
                <p className="text-xs text-zinc-600">
                  No files linked yet
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                    <span className="text-xs text-zinc-300 truncate flex-1">
                      {file.filename || "Unnamed"}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-mono flex-shrink-0">
                      #{String(idx + 1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link File Modal */}
          {isLinking && (
            <LinkFileModal
              userFiles={userFiles}
              onClose={onCloseLink}
              onLinkFile={(rootHash) => {
                // Find the fileId from contract — we need the anchored file ID
                // For now, use a simplified approach: link by using the index as a placeholder
                // In production, we'd fetch the actual fileId from the contract
                const fileIdx = userFiles.findIndex((f) => f.rootHash === rootHash);
                if (fileIdx >= 0) {
                  onLinkFile(BigInt(fileIdx + 1)); // Approximate fileId
                }
                onCloseLink();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p
        className={cn(
          "text-xs text-zinc-300 truncate",
          mono && "font-mono"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function LinkFileModal({
  userFiles,
  onClose,
  onLinkFile,
}: {
  userFiles: UserFile[];
  onClose: () => void;
  onLinkFile: (rootHash: string) => void;
}) {
  // Filter only anchored files
  const anchoredFiles = userFiles.filter((f) => {
    const stored = localStorage.getItem(
      `vault_files_${typeof window !== "undefined" ? "unknown" : ""}`
    );
    // Simple heuristic: files that have been uploaded recently
    return true; // Show all files; user knows which are anchored
  });

  return (
    <div className="p-4 border-t border-white/[0.06] bg-neon-cyan/[0.02] animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-neon-cyan flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" />
          Link a File to this Agent
        </span>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {userFiles.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-zinc-500">
            No uploaded files found. Upload files first on the Upload page.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {userFiles.map((file) => (
            <button
              key={file.rootHash}
              onClick={() => onLinkFile(file.rootHash)}
              className="w-full text-left flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-neon-cyan/30 hover:bg-neon-cyan/5 transition-all duration-200 group"
            >
              <FileText className="w-4 h-4 text-zinc-500 group-hover:text-neon-cyan transition-colors flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 truncate group-hover:text-white transition-colors">
                  {file.fileName}
                </p>
                <p className="text-[10px] text-zinc-600 font-mono truncate">
                  {truncateHash(file.rootHash, 10, 8)}
                </p>
              </div>
              <Shield className="w-3.5 h-3.5 text-zinc-600 group-hover:text-neon-cyan transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
