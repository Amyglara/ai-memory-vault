/**
 * 0G Storage SDK Wrapper for Browser Environment
 * Based on storage-web-starter patterns
 */

import { Blob as ZgBlob, Indexer, type Blob as ZgBlobType, MerkleTree, getMarketContract, calculatePrice, FixedPriceFlow__factory } from "@0glabs/0g-ts-sdk";
import { BrowserProvider, Contract, formatEther } from "ethers";

// ===== Types =====

export interface StorageUploadResult {
  rootHash: string;
  txHash: string;
}

export interface FeeInfo {
  storageFee: string;
  estimatedGas: string;
  totalFee: string;
  rawStorageFee: bigint;
  rawGasFee: bigint;
  rawTotalFee: bigint;
  isLoading?: boolean;
}

export interface NetworkConfig {
  name: string;
  flowAddress: string;
  storageRpc: string;
  explorerUrl: string;
  l1Rpc: string;
}

// ===== Network Config =====

export function getNetworkConfig(networkType: "standard" | "turbo"): NetworkConfig {
  const NETWORKS: Record<string, NetworkConfig> = {
    standard: {
      name: "Standard",
      flowAddress:
        process.env.NEXT_PUBLIC_STANDARD_FLOW_ADDRESS ||
        "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296",
      storageRpc:
        process.env.NEXT_PUBLIC_STORAGE_RPC_STANDARD ||
        "https://indexer-storage-testnet-standard.0g.ai",
      explorerUrl:
        process.env.NEXT_PUBLIC_STANDARD_EXPLORER_URL ||
        "https://chainscan-galileo.0g.ai/tx/",
      l1Rpc:
        process.env.NEXT_PUBLIC_STANDARD_L1_RPC ||
        process.env.NEXT_PUBLIC_L1_RPC ||
        "https://evmrpc-testnet.0g.ai",
    },
    turbo: {
      name: "Turbo",
      flowAddress:
        process.env.NEXT_PUBLIC_TURBO_FLOW_ADDRESS ||
        "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296",
      storageRpc:
        process.env.NEXT_PUBLIC_STORAGE_RPC_TURBO ||
        "https://indexer-storage-testnet-turbo.0g.ai",
      explorerUrl:
        process.env.NEXT_PUBLIC_TURBO_EXPLORER_URL ||
        "https://chainscan-galileo.0g.ai/tx/",
      l1Rpc:
        process.env.NEXT_PUBLIC_TURBO_L1_RPC ||
        process.env.NEXT_PUBLIC_L1_RPC ||
        "https://evmrpc-testnet.0g.ai",
    },
  };

  return NETWORKS[networkType];
}

// ===== Provider & Signer =====

export async function getBrowserProvider(): Promise<
  [BrowserProvider | null, Error | null]
> {
  try {
    if (!(window as any).ethereum) {
      return [null, new Error("No Ethereum provider found. Please install MetaMask.")];
    }
    const provider = new BrowserProvider((window as any).ethereum);
    return [provider, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

export async function getBrowserSigner(
  provider: BrowserProvider
): Promise<[any | null, Error | null]> {
  try {
    const signer = await provider.getSigner();
    return [signer, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

// ===== Blob Operations =====

export function createBlob(file: File): ZgBlobType {
  return new ZgBlob(file);
}

export async function generateMerkleTree(
  blob: ZgBlobType
): Promise<[MerkleTree | null, Error | null]> {
  try {
    const [tree, treeErr] = await blob.merkleTree();
    if (treeErr !== null || !tree) {
      return [null, treeErr || new Error("Unknown error generating Merkle tree")];
    }
    return [tree, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

export function getRootHash(tree: MerkleTree): [string | null, Error | null] {
  try {
    const hash = tree.rootHash();
    if (!hash) {
      return [null, new Error("Failed to get root hash")];
    }
    return [hash, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

export async function createSubmission(
  blob: ZgBlobType
): Promise<[any | null, Error | null]> {
  try {
    const [submission, submissionErr] = await blob.createSubmission("0x");
    if (submissionErr !== null || submission === null) {
      return [null, submissionErr || new Error("Unknown error creating submission")];
    }
    return [submission, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

// ===== Fee Calculation =====

export function getFlowContract(flowAddress: string, signer: any): Contract {
  return FixedPriceFlow__factory.connect(flowAddress, signer) as unknown as Contract;
}

export async function calculateFees(
  submission: any,
  flowContract: Contract,
  provider: BrowserProvider
): Promise<[FeeInfo | null, Error | null]> {
  try {
    const marketAddr = await flowContract.market();
    const market = getMarketContract(marketAddr, provider);
    const pricePerSector = await market.pricePerSector();
    const storageFee = calculatePrice(submission, pricePerSector);

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);

    let gasEstimate;
    try {
      gasEstimate = await flowContract.submit.estimateGas(submission, {
        value: storageFee,
      });
    } catch {
      gasEstimate = BigInt(500000);
    }

    const estimatedGasFee = gasEstimate * gasPrice;
    const totalFee = BigInt(storageFee) + estimatedGasFee;

    return [
      {
        storageFee: formatEther(storageFee),
        estimatedGas: formatEther(estimatedGasFee),
        totalFee: formatEther(totalFee),
        rawStorageFee: storageFee,
        rawGasFee: estimatedGasFee,
        rawTotalFee: totalFee,
        isLoading: false,
      },
      null,
    ];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

// ===== Upload =====

export async function submitTransaction(
  flowContract: Contract,
  submission: any,
  value: bigint
): Promise<[any | null, Error | null]> {
  try {
    const tx = await flowContract.submit(submission, { value });
    const receipt = await tx.wait();
    return [{ tx, receipt }, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

export async function uploadToStorage(
  blob: ZgBlobType,
  storageRpc: string,
  l1Rpc: string,
  signer: any
): Promise<[boolean, Error | null]> {
  try {
    const indexer = new Indexer(storageRpc);
    const uploadOptions = {
      taskSize: 10,
      expectedReplica: 1,
      finalityRequired: true,
      tags: "0x",
      skipTx: false,
      fee: BigInt(0),
    };
    await indexer.upload(blob, l1Rpc, signer, uploadOptions);
    return [true, null];
  } catch (error) {
    return [false, error instanceof Error ? error : new Error(String(error))];
  }
}

// ===== Download (REST API — no SDK needed for browser) =====

export async function downloadByRootHash(
  rootHash: string,
  storageRpc: string
): Promise<[ArrayBuffer | null, Error | null]> {
  try {
    if (!rootHash) {
      return [null, new Error("Root hash is required")];
    }

    const apiUrl = `${storageRpc}/file?root=${rootHash}`;
    const response = await fetch(apiUrl);

    const contentType = response.headers.get("content-type");
    const isJsonResponse = contentType && contentType.includes("application/json");

    if (isJsonResponse) {
      const jsonData = await response.json();
      if (!response.ok || jsonData.code) {
        if (jsonData.code === 101) {
          return [null, new Error("File not found on storage network")];
        }
        return [null, new Error(`Download failed: ${jsonData.message || "Unknown error"}`)];
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      return [null, new Error(`Download failed with status ${response.status}: ${errorText}`)];
    }

    const fileData = await response.arrayBuffer();
    if (!fileData || fileData.byteLength === 0) {
      return [null, new Error("Downloaded file is empty")];
    }

    return [fileData, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

export function downloadBlobAsFile(fileData: ArrayBuffer, fileName: string): void {
  const byteArray = new Uint8Array(fileData);
  const blob = new Blob([byteArray]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || `download-${Date.now()}.bin`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
