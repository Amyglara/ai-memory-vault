/**
 * MemoryVault Contract Interaction Layer
 * Uses viem directly for type-safe contract reads/writes,
 * avoiding @wagmi/core version conflicts with @wagmi/core@2 vs @wagmi/core@3.
 */

import { createPublicClient, http, type Address } from "viem";
import { L1_RPC, zgTestnet } from "./config";

// ===== ABI =====

const MEMORY_VAULT_ABI = [
  // Read functions
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "files",
    outputs: [
      { name: "rootHash", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "timestamp", type: "uint256" },
      { name: "filename", type: "string" },
      { name: "fileSize", type: "uint256" },
      { name: "contentType", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "agents",
    outputs: [
      { name: "owner", type: "address" },
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "memoryRoot", type: "bytes32" },
      { name: "registeredAt", type: "uint256" },
      { name: "fileCount", type: "uint256" },
      { name: "active", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "fileCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "agentCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "getFilesByOwner",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "getAgentsByOwner",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "fileId", type: "uint256" }],
    name: "getFile",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "rootHash", type: "bytes32" },
          { name: "owner", type: "address" },
          { name: "timestamp", type: "uint256" },
          { name: "filename", type: "string" },
          { name: "fileSize", type: "uint256" },
          { name: "contentType", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getAgent",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "name", type: "string" },
          { name: "description", type: "string" },
          { name: "memoryRoot", type: "bytes32" },
          { name: "registeredAt", type: "uint256" },
          { name: "fileCount", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getAgentFiles",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "fileId", type: "uint256" }],
    name: "getFileAgent",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "bytes32" }],
    name: "registeredRoots",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  // Write functions
  {
    inputs: [
      { name: "rootHash", type: "bytes32" },
      { name: "filename", type: "string" },
      { name: "fileSize", type: "uint256" },
      { name: "contentType", type: "string" },
    ],
    name: "anchorFile",
    outputs: [{ name: "fileId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "memoryRoot", type: "bytes32" },
    ],
    name: "registerAgent",
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "fileId", type: "uint256" },
      { name: "agentId", type: "uint256" },
    ],
    name: "linkFileToAgent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "memoryRoot", type: "bytes32" },
    ],
    name: "updateAgent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "fileId", type: "uint256" },
      { name: "filename", type: "string" },
      { name: "contentType", type: "string" },
    ],
    name: "updateFileMetadata",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "deactivateAgent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ===== Contract Address =====

export const MEMORY_VAULT_ADDRESS = "0x7826Ac2d7DC10Da069498268f22E8346cB1f082b" as Address;

// ===== Types =====

export interface FileRecord {
  rootHash: string;
  owner: string;
  timestamp: bigint;
  filename: string;
  fileSize: bigint;
  contentType: string;
}

export interface AgentRecord {
  owner: string;
  name: string;
  description: string;
  memoryRoot: string;
  registeredAt: bigint;
  fileCount: bigint;
  active: boolean;
}

// ===== Public Client (for reads) =====

let _publicClient: ReturnType<typeof createPublicClient> | null = null;

function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: zgTestnet,
      transport: http(),
    });
  }
  return _publicClient;
}

// ===== Read Operations =====

export async function getFileCount(): Promise<bigint> {
  const client = getPublicClient();
  const count = await client.readContract({
    address: MEMORY_VAULT_ADDRESS,
    abi: MEMORY_VAULT_ABI,
    functionName: "fileCount",
  });
  return count as bigint;
}

export async function getAgentCount(): Promise<bigint> {
  const client = getPublicClient();
  const count = await client.readContract({
    address: MEMORY_VAULT_ADDRESS,
    abi: MEMORY_VAULT_ABI,
    functionName: "agentCount",
  });
  return count as bigint;
}

export async function getFile(fileId: bigint): Promise<FileRecord> {
  const client = getPublicClient();
  const file = await client.readContract({
    address: MEMORY_VAULT_ADDRESS,
    abi: MEMORY_VAULT_ABI,
    functionName: "getFile",
    args: [fileId],
  });
  return file as unknown as FileRecord;
}

export async function getAgent(agentId: bigint): Promise<AgentRecord> {
  const client = getPublicClient();
  const agent = await client.readContract({
    address: MEMORY_VAULT_ADDRESS,
    abi: MEMORY_VAULT_ABI,
    functionName: "getAgent",
    args: [agentId],
  });
  return agent as unknown as AgentRecord;
}

export async function getFilesByOwner(owner: Address): Promise<bigint[]> {
  const client = getPublicClient();
  const files = await client.readContract({
    address: MEMORY_VAULT_ADDRESS,
    abi: MEMORY_VAULT_ABI,
    functionName: "getFilesByOwner",
    args: [owner],
  });
  return files as bigint[];
}

export async function getAgentsByOwner(owner: Address): Promise<bigint[]> {
  const client = getPublicClient();
  const agents = await client.readContract({
    address: MEMORY_VAULT_ADDRESS,
    abi: MEMORY_VAULT_ABI,
    functionName: "getAgentsByOwner",
    args: [owner],
  });
  return agents as bigint[];
}

export async function getAgentFiles(agentId: bigint): Promise<bigint[]> {
  const client = getPublicClient();
  const files = await client.readContract({
    address: MEMORY_VAULT_ADDRESS,
    abi: MEMORY_VAULT_ABI,
    functionName: "getAgentFiles",
    args: [agentId],
  });
  return files as bigint[];
}

export async function isRootRegistered(rootHash: string): Promise<boolean> {
  const client = getPublicClient();
  const registered = await client.readContract({
    address: MEMORY_VAULT_ADDRESS,
    abi: MEMORY_VAULT_ABI,
    functionName: "registeredRoots",
    args: [rootHash as `0x${string}`],
  });
  return registered as boolean;
}

// ===== Write Operations (via window.ethereum — browser only) =====

async function getEthereumProvider() {
  if (typeof window === "undefined") {
    throw new Error("Window provider is only available in the browser");
  }
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error("No Ethereum provider found. Please install MetaMask.");
  }
  return ethereum;
}

function encodeFunctionCall(
  functionName: string,
  args: readonly unknown[]
): string {
  // Minimal ABI encoder for common types
  // For production, use viem's encodeFunctionData
  const { encodeFunctionData } = require("viem");
  return encodeFunctionData({
    abi: MEMORY_VAULT_ABI,
    functionName,
    args,
  });
}

async function sendTransaction(to: string, data: string) {
  const ethereum = await getEthereumProvider();

  const accounts = await ethereum.request({
    method: "eth_requestAccounts",
  });
  const from = accounts[0];

  const txHash = await ethereum.request({
    method: "eth_sendTransaction",
    params: [
      {
        to,
        from,
        data,
      },
    ],
  });

  // Wait for receipt
  return new Promise<{ hash: string }>((resolve, reject) => {
    const checkReceipt = async () => {
      try {
        const receipt = await ethereum.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });
        if (receipt) {
          resolve({ hash: txHash });
        } else {
          setTimeout(checkReceipt, 2000);
        }
      } catch (err) {
        reject(err);
      }
    };
    setTimeout(checkReceipt, 2000);
  });
}

export async function anchorFile(
  rootHash: string,
  filename: string,
  fileSize: number,
  contentType: string
): Promise<string> {
  const { encodeFunctionData } = await import("viem");
  const data = encodeFunctionData({
    abi: MEMORY_VAULT_ABI,
    functionName: "anchorFile",
    args: [rootHash as `0x${string}`, filename, BigInt(fileSize), contentType],
  });
  const result = await sendTransaction(MEMORY_VAULT_ADDRESS, data);
  return result.hash;
}

export async function registerAgent(
  name: string,
  description: string,
  memoryRoot: string
): Promise<string> {
  const { encodeFunctionData } = await import("viem");
  const data = encodeFunctionData({
    abi: MEMORY_VAULT_ABI,
    functionName: "registerAgent",
    args: [name, description, memoryRoot as `0x${string}`],
  });
  const result = await sendTransaction(MEMORY_VAULT_ADDRESS, data);
  return result.hash;
}

export async function linkFileToAgent(
  fileId: bigint,
  agentId: bigint
): Promise<string> {
  const { encodeFunctionData } = await import("viem");
  const data = encodeFunctionData({
    abi: MEMORY_VAULT_ABI,
    functionName: "linkFileToAgent",
    args: [fileId, agentId],
  });
  const result = await sendTransaction(MEMORY_VAULT_ADDRESS, data);
  return result.hash;
}

// ===== Export ABI for external use =====
export { MEMORY_VAULT_ABI };
