"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Upload,
  HardDrive,
  FileText,
  Image,
  FileJson,
  File,
  Link2,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Clock,
  ArrowRight,
  Shield,
} from "lucide-react";
import { useAccount, useBalance } from "wagmi";
import { useNetwork } from "@/context";
import FileDropzone from "@/components/common/FileDropzone";
import {
  getNetworkConfig,
  getBrowserProvider,
  getBrowserSigner,
  createBlob,
  generateMerkleTree,
  getRootHash,
  createSubmission,
  getFlowContract,
  calculateFees,
  submitTransaction,
  uploadToStorage,
  downloadByRootHash,
  downloadBlobAsFile,
  type FeeInfo,
  type StorageUploadResult,
} from "@/lib/storage";
import {
  isRootRegistered,
  anchorFile,
  type FileRecord,
} from "@/lib/contracts";
import { EXPLORER_URL } from "@/lib/config";
import { cn, formatFileSize } from "@/lib/utils";

// ===== Types =====

type UploadStep =
  | "idle"
  | "merkle"
  | "fees"
  | "confirm"
  | "submit-tx"
  | "uploading"
  | "done"
  | "error";

interface UploadedFile {
  rootHash: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  txHash: string;
  uploadedAt: number;
  anchored: boolean;
  fileId?: number;
}

// ===== Helpers =====

function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return Image;
  if (contentType === "application/json") return FileJson;
  if (contentType.includes("pdf")) return FileText;
  return File;
}

function getExplorerTxUrl(txHash: string) {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

// ===== Main Component =====

export default function UploadPage() {
  const { isConnected, address } = useAccount();
  const { networkType } = useNetwork();
  const { data: balanceData } = useBalance({
    address: isConnected ? address : undefined,
    chainId: 16602,
  });

  // Upload state
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [feeInfo, setFeeInfo] = useState<FeeInfo | null>(null);
  const [uploadResult, setUploadResult] = useState<StorageUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // File list state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [anchoringHash, setAnchoringHash] = useState<string | null>(null);
  const [anchoringError, setAnchoringError] = useState<string | null>(null);

  // Load files from localStorage and contract on mount
  useEffect(() => {
    if (isConnected && address) {
      const stored = localStorage.getItem(`vault_files_${address.toLowerCase()}`);
      if (stored) {
        try {
          setUploadedFiles(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }
  }, [isConnected, address]);

  // Save to localStorage when files change
  const saveFiles = useCallback(
    (files: UploadedFile[]) => {
      if (address) {
        localStorage.setItem(
          `vault_files_${address.toLowerCase()}`,
          JSON.stringify(files)
        );
      }
    },
    [address]
  );

  // Check anchored status from contract
  useEffect(() => {
    if (!isConnected || !uploadedFiles.length) return;

    uploadedFiles.forEach(async (file, index) => {
      if (!file.anchored) {
        try {
          const registered = await isRootRegistered(file.rootHash);
          if (registered) {
            setUploadedFiles((prev) => {
              const updated = [...prev];
              updated[index] = { ...updated[index], anchored: true };
              saveFiles(updated);
              return updated;
            });
          }
        } catch {
          // ignore contract read errors
        }
      }
    });
  }, [isConnected, uploadedFiles.length]);

  // ===== Upload Handlers =====

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setUploadStep("idle");
    setFeeInfo(null);
    setUploadResult(null);
    setError(null);
  }, []);

  const handleUploadStart = useCallback(async () => {
    if (!selectedFile || !isConnected) return;

    const networkConfig = getNetworkConfig(networkType);
    let blob: any = null;

    try {
      // Step 1: Create blob and generate Merkle tree
      setUploadStep("merkle");
      blob = createBlob(selectedFile);
      const [tree, treeErr] = await generateMerkleTree(blob);
      if (treeErr || !tree) throw treeErr || new Error("Failed to generate Merkle tree");

      const [rootHash, rootErr] = getRootHash(tree);
      if (rootErr || !rootHash) throw rootErr || new Error("Failed to get root hash");

      // Step 2: Calculate fees
      setUploadStep("fees");
      const [provider, provErr] = await getBrowserProvider();
      if (provErr || !provider) throw provErr || new Error("No provider");

      const [signer, signerErr] = await getBrowserSigner(provider);
      if (signerErr || !signer) throw signerErr || new Error("No signer");

      const flowContract = getFlowContract(networkConfig.flowAddress, signer);
      const [submission, subErr] = await createSubmission(blob);
      if (subErr || !submission) throw subErr || new Error("Failed to create submission");

      const [fees, feesErr] = await calculateFees(submission, flowContract, provider);
      if (feesErr || !fees) throw feesErr || new Error("Failed to calculate fees");

      setFeeInfo(fees);
      setUploadStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUploadStep("error");
    }
  }, [selectedFile, isConnected, networkType]);

  const handleConfirmUpload = useCallback(async () => {
    if (!selectedFile || !feeInfo) return;

    const networkConfig = getNetworkConfig(networkType);
    let blob: any = null;

    try {
      blob = createBlob(selectedFile);

      // Regenerate tree & submission (blob state may not persist)
      const [tree, treeErr] = await generateMerkleTree(blob);
      if (treeErr || !tree) throw treeErr || new Error("Failed to generate Merkle tree");

      const [provider, provErr] = await getBrowserProvider();
      if (provErr || !provider) throw provErr || new Error("No provider");

      const [signer, signerErr] = await getBrowserSigner(provider);
      if (signerErr || !signer) throw signerErr || new Error("No signer");

      const flowContract = getFlowContract(networkConfig.flowAddress, signer);

      const [submission, subErr] = await createSubmission(blob);
      if (subErr || !submission) throw subErr || new Error("Failed to create submission");

      // Step 3: Submit transaction to Flow contract
      setUploadStep("submit-tx");
      const [txResult, txErr] = await submitTransaction(
        flowContract,
        submission,
        feeInfo.rawTotalFee
      );
      if (txErr || !txResult) throw txErr || new Error("Transaction failed");

      // Step 4: Upload to storage indexer
      setUploadStep("uploading");
      const [uploadOk, uploadErr] = await uploadToStorage(
        blob,
        networkConfig.storageRpc,
        networkConfig.l1Rpc,
        signer
      );
      if (uploadErr || !uploadOk) throw uploadErr || new Error("Upload to storage failed");

      // Get root hash for result
      const [rootHash, rootErr] = getRootHash(tree);
      if (rootErr || !rootHash) throw rootErr || new Error("Failed to get root hash");

      const result: StorageUploadResult = {
        rootHash,
        txHash: txResult.receipt.hash,
      };

      setUploadResult(result);
      setUploadStep("done");

      // Add to file list
      const newFile: UploadedFile = {
        rootHash,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        contentType: selectedFile.type || "application/octet-stream",
        txHash: txResult.receipt.hash,
        uploadedAt: Date.now(),
        anchored: false,
      };

      setUploadedFiles((prev) => {
        const updated = [newFile, ...prev];
        saveFiles(updated);
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUploadStep("error");
    } finally {
      // Clean up blob resources
      if (blob && typeof blob.close === "function") {
        try {
          await blob.close();
        } catch {
          // ignore
        }
      }
    }
  }, [selectedFile, feeInfo, networkType, saveFiles]);

  const handleAnchorToChain = useCallback(
    async (file: UploadedFile) => {
      if (!file || !address) return;

      setAnchoringHash(file.rootHash);
      setAnchoringError(null);

      try {
        const hash = await anchorFile(
          file.rootHash,
          file.fileName,
          file.fileSize,
          file.contentType
        );

        // Mark as anchored in local list
        setUploadedFiles((prev) => {
          const updated = prev.map((f) =>
            f.rootHash === file.rootHash ? { ...f, anchored: true } : f
          );
          saveFiles(updated);
          return updated;
        });
      } catch (err: any) {
        setAnchoringError(
          err?.shortMessage || err?.message || "Failed to anchor file on-chain"
        );
      } finally {
        setAnchoringHash(null);
      }
    },
    [address, saveFiles]
  );

  const handleDownload = useCallback(
    async (file: UploadedFile) => {
      const networkConfig = getNetworkConfig(networkType);
      const [data, err] = await downloadByRootHash(
        file.rootHash,
        networkConfig.storageRpc
      );
      if (err || !data) {
        alert(`Download failed: ${err?.message || "Unknown error"}`);
        return;
      }
      downloadBlobAsFile(data, file.fileName);
    },
    [networkType]
  );

  const handleReset = useCallback(() => {
    setUploadStep("idle");
    setSelectedFile(null);
    setFeeInfo(null);
    setUploadResult(null);
    setError(null);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">
          <span className="neon-text">Upload</span> to Memory Vault
        </h1>
        <p className="text-zinc-400">
          Store documents and knowledge on 0G decentralized storage
        </p>
      </div>

      {!isConnected ? (
        <div className="glass-card p-12 text-center">
          <Upload className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-2">
            Connect Wallet First
          </h3>
          <p className="text-zinc-500 text-sm">
            You need to connect your wallet to upload files
          </p>
        </div>
      ) : (
        <>
          {/* Upload Section */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <HardDrive className="w-5 h-5 text-neon-cyan" />
              <h2 className="text-lg font-semibold">File Upload</h2>
              <span className="ml-auto px-3 py-1 rounded-full text-xs font-medium bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
                {networkType === "turbo" ? "🐇 Turbo" : "🐢 Standard"}
              </span>
            </div>

            {/* Step indicator */}
            {uploadStep !== "idle" && (
              <div className="mb-6">
                <UploadProgress step={uploadStep} />
              </div>
            )}

            {/* Dropzone - only show when idle or error */}
            {(uploadStep === "idle" || uploadStep === "error") && (
              <>
                <FileDropzone
                  onFileDrop={handleFileSelect}
                  disabled={false}
                />

                {/* Selected file preview */}
                {selectedFile && (
                  <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    {React.createElement(getFileIcon(selectedFile.type), {
                      className: "w-8 h-8 text-zinc-400",
                    })}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatFileSize(selectedFile.size)} &middot;{" "}
                        {selectedFile.type || "Unknown type"}
                      </p>
                    </div>
                    <button
                      onClick={handleUploadStart}
                      className="neon-button px-4 py-2 text-sm flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                    </button>
                  </div>
                )}

                {/* Error display */}
                {error && (
                  <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-red-300 font-medium">Upload Failed</p>
                      <p className="text-xs text-red-400/80 mt-1 break-all">{error}</p>
                    </div>
                    <button
                      onClick={handleReset}
                      className="text-zinc-500 hover:text-white transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Fee confirmation */}
            {uploadStep === "confirm" && feeInfo && selectedFile && (
              <div className="mt-4 p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-4">
                <div className="flex items-center gap-3">
                  {React.createElement(getFileIcon(selectedFile.type), {
                    className: "w-8 h-8 text-zinc-400",
                  })}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-zinc-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Storage Fee</span>
                    <span className="text-zinc-200 font-mono">{feeInfo.storageFee} OG</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Estimated Gas</span>
                    <span className="text-zinc-200 font-mono">{feeInfo.estimatedGas} OG</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t border-white/[0.06]">
                    <span className="text-zinc-300">Total</span>
                    <span className="text-neon-cyan font-mono">{feeInfo.totalFee} OG</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleReset}
                    className="neon-button-outline px-4 py-2.5 text-sm flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmUpload}
                    className="neon-button px-4 py-2.5 text-sm flex-1 flex items-center justify-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Confirm & Upload
                  </button>
                </div>
              </div>
            )}

            {/* Success */}
            {uploadStep === "done" && uploadResult && (
              <div className="mt-4 p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">
                      Upload Complete!
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      File stored on 0G {networkType} network
                    </p>
                  </div>
                </div>

                <div className="bg-black/20 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-16">Root Hash</span>
                    <code className="text-xs text-neon-cyan font-mono truncate">
                      {uploadResult.rootHash}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-16">Tx Hash</span>
                    <a
                      href={getExplorerTxUrl(uploadResult.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-neon-blue hover:underline font-mono truncate flex items-center gap-1"
                    >
                      {uploadResult.txHash.slice(0, 6)}...{uploadResult.txHash.slice(-4)}
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="neon-button px-4 py-2.5 text-sm flex-1 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Another
                  </button>
                  <a
                    href={`#file-${uploadResult.rootHash.slice(0, 8)}`}
                    className="neon-button-outline px-4 py-2.5 text-sm flex items-center justify-center gap-2"
                  >
                    View Files
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* In-progress overlay (merkle/fees/submit-tx/uploading) */}
            {(uploadStep === "merkle" ||
              uploadStep === "fees" ||
              uploadStep === "submit-tx" ||
              uploadStep === "uploading") && (
              <div className="mt-6 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-neon-cyan animate-spin mx-auto" />
                <p className="text-sm text-zinc-300">
                  {uploadStep === "merkle" && "Generating Merkle tree..."}
                  {uploadStep === "fees" && "Calculating storage fees..."}
                  {uploadStep === "submit-tx" && "Submitting transaction to Flow contract..."}
                  {uploadStep === "uploading" && "Uploading to 0G Storage network..."}
                </p>
                <p className="text-xs text-zinc-500">
                  Please confirm the transaction in your wallet if prompted
                </p>
              </div>
            )}
          </div>

          {/* Anchoring Error Banner */}
          {anchoringError && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-amber-300 font-medium">Anchor Failed</p>
                <p className="text-xs text-amber-400/80 mt-0.5">{anchoringError}</p>
              </div>
              <button
                onClick={() => setAnchoringError(null)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Uploaded Files List */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-400">
                Uploaded Files
                {uploadedFiles.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-white/[0.06] text-xs text-zinc-500">
                    {uploadedFiles.length}
                  </span>
                )}
              </h3>
              {uploadedFiles.length > 0 && (
                <button
                  onClick={() => {
                    setUploadedFiles([]);
                    if (address) {
                      localStorage.removeItem(
                        `vault_files_${address.toLowerCase()}`
                      );
                    }
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {uploadedFiles.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                <HardDrive className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p>No files uploaded yet.</p>
                <p className="text-xs mt-1">Drop a file above to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {uploadedFiles.map((file) => (
                  <FileCard
                    key={file.rootHash}
                    file={file}
                    networkType={networkType}
                    isAnchoring={anchoringHash === file.rootHash}
                    onAnchor={handleAnchorToChain}
                    onDownload={handleDownload}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ===== Sub-components =====

const STEPS = [
  { key: "merkle", label: "Merkle Tree" },
  { key: "fees", label: "Calculate Fees" },
  { key: "submit-tx", label: "Submit TX" },
  { key: "uploading", label: "Upload" },
  { key: "done", label: "Complete" },
] as const;

function UploadProgress({ step }: { step: UploadStep }) {
  const activeIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex || step === "done";
        return (
          <React.Fragment key={s.key}>
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300",
                  isDone && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
                  isActive &&
                    "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 animate-pulse",
                  !isDone &&
                    !isActive &&
                    "bg-white/[0.04] text-zinc-600 border border-white/[0.06]"
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:inline transition-colors duration-300",
                  isActive ? "text-neon-cyan" : isDone ? "text-zinc-400" : "text-zinc-600"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-px min-w-[20px] mx-1 transition-colors duration-300",
                  i < activeIndex || step === "done"
                    ? "bg-emerald-500/30"
                    : "bg-white/[0.06]"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function FileCard({
  file,
  networkType,
  isAnchoring,
  onAnchor,
  onDownload,
}: {
  file: UploadedFile;
  networkType: "standard" | "turbo";
  isAnchoring: boolean;
  onAnchor: (file: UploadedFile) => void;
  onDownload: (file: UploadedFile) => void;
}) {
  const Icon = getFileIcon(file.contentType);
  const timeAgo = getTimeAgo(file.uploadedAt);

  return (
    <div
      id={`file-${file.rootHash.slice(0, 8)}`}
      className="group p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        {/* File icon */}
        <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-zinc-400" />
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
            {file.fileName}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-zinc-500">
              {formatFileSize(file.fileSize)}
            </span>
            <span className="text-xs text-zinc-600">&middot;</span>
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </span>
            {file.anchored && (
              <>
                <span className="text-xs text-zinc-600">&middot;</span>
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Anchored
                </span>
              </>
            )}
          </div>
          {/* Root hash */}
          <div className="mt-2 flex items-center gap-1.5">
            <code className="text-[10px] text-zinc-600 font-mono truncate">
              {file.rootHash}
            </code>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!file.anchored && (
            <button
              onClick={() => onAnchor(file)}
              disabled={isAnchoring}
              className={cn(
                "p-2 rounded-lg transition-all duration-200",
                isAnchoring
                  ? "opacity-50 cursor-not-allowed"
                  : "text-amber-400 hover:bg-amber-400/10 hover:text-amber-300"
              )}
              title="Anchor to chain"
            >
              {isAnchoring ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={() => onDownload(file)}
            className="p-2 rounded-lg text-zinc-500 hover:text-neon-cyan hover:bg-neon-cyan/10 transition-all duration-200"
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </button>
          <a
            href={getExplorerTxUrl(file.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-zinc-500 hover:text-neon-blue hover:bg-neon-blue/10 transition-all duration-200"
            title="View transaction"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
