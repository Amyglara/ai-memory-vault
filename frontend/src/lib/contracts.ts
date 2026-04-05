/**
 * TrustGateEscrow Contract Interaction Layer
 * Uses viem directly for type-safe contract reads/writes.
 */

import { createPublicClient, http, type Address } from "viem";
import { getWalletClient, getPublicClient as getWagmiPublicClient } from "@wagmi/core";
import { L1_RPC, zgTestnet } from "./config";
import { config as wagmiConfig } from "@/lib/wagmi";

// ===== Types =====

export enum EscrowStatus {
  Created = 0,
  Funded = 1,
  Evidence = 2,
  Disputed = 3,
  Resolved = 4,
  Released = 5,
  Refunded = 6,
}

export interface Escrow {
  buyer: string;
  seller: string;
  amount: bigint;
  fee: bigint;
  createdAt: bigint;
  deadline: bigint;
  status: number;
  description: string;
}

export interface Evidence {
  escrowId: bigint;
  submitter: string;
  rootHash: string;
  filename: string;
  description: string;
  timestamp: bigint;
}

export interface Arbitration {
  escrowId: bigint;
  aiVerdictHash: string;
  totalVoters: bigint;
  votesForBuyer: bigint;
  resolved: boolean;
  buyerWins: boolean;
}

export interface EscrowStats {
  funded: bigint;
  disputed: bigint;
  resolved: bigint;
  total: bigint;
}

export interface TrustInfo {
  trustScore: bigint;
  totalDisputes: bigint;
  correctVoteCount: bigint;
}

// ===== ABI =====

const TRUSTGATE_ESCROW_ABI = [
  // Read functions
  {
    inputs: [],
    name: "escrowCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "evidenceCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "escrowId", type: "uint256" }],
    name: "getEscrow",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "buyer", type: "address" },
          { name: "seller", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "fee", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "description", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getEscrowCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "buyer", type: "address" }],
    name: "getEscrowsByBuyer",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "seller", type: "address" }],
    name: "getEscrowsBySeller",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserEscrows",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "escrowId", type: "uint256" }],
    name: "getEscrowStatus",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "evidenceId", type: "uint256" }],
    name: "getEvidence",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "escrowId", type: "uint256" },
          { name: "submitter", type: "address" },
          { name: "rootHash", type: "bytes32" },
          { name: "filename", type: "string" },
          { name: "description", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "escrowId", type: "uint256" }],
    name: "getEvidenceByEscrow",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "escrowId", type: "uint256" }],
    name: "getArbitration",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "escrowId", type: "uint256" },
          { name: "aiVerdictHash", type: "bytes32" },
          { name: "totalVoters", type: "uint256" },
          { name: "votesForBuyer", type: "uint256" },
          { name: "resolved", type: "bool" },
          { name: "buyerWins", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getEscrowStats",
    outputs: [
      { name: "funded", type: "uint256" },
      { name: "disputed", type: "uint256" },
      { name: "resolved", type: "uint256" },
      { name: "total", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalValueLocked",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "addr", type: "address" }],
    name: "getPendingWithdrawal",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "arbitrator", type: "address" }],
    name: "getTrustInfo",
    outputs: [
      { name: "trustScore", type: "uint256" },
      { name: "totalDisputes", type: "uint256" },
      { name: "correctVoteCount", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "escrowId", type: "uint256" }],
    name: "getEscrowVoters",
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }],
    name: "hasVoted",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MIN_VOTERS",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Write functions
  {
    inputs: [
      { name: "seller", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "description", type: "string" },
      { name: "deadlineDuration", type: "uint256" },
    ],
    name: "createEscrow",
    outputs: [{ name: "escrowId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "escrowId", type: "uint256" }],
    name: "fundEscrow",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "rootHash", type: "bytes32" },
      { name: "filename", type: "string" },
      { name: "description", type: "string" },
    ],
    name: "submitEvidence",
    outputs: [{ name: "evidenceId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "escrowId", type: "uint256" }],
    name: "disputeEscrow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "aiVerdictHash", type: "bytes32" },
    ],
    name: "recordAIVerdict",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "voteForBuyer", type: "bool" },
    ],
    name: "castVote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "escrowId", type: "uint256" }],
    name: "resolveEscrow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "escrowId", type: "uint256" }],
    name: "releaseEscrow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "escrowId", type: "uint256" }],
    name: "refundEscrow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ===== Contract Address =====

export const TRUSTGATE_ADDRESS =
  "0xe65176BdaEBbCb9a4D12b8bAAaf95E7f3c68cd4a" as Address;

// ===== Public Client (for reads) =====

let _publicClient: ReturnType<typeof createPublicClient> | null = null;

function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: zgTestnet,
      transport: http(L1_RPC),
    });
  }
  return _publicClient;
}

// ===== Read Operations =====

export async function getEscrowCount(): Promise<bigint> {
  const client = getPublicClient();
  const count = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getEscrowCount",
  });
  return count as bigint;
}

export async function getEvidenceCount(): Promise<bigint> {
  const client = getPublicClient();
  const count = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "evidenceCount",
  });
  return count as bigint;
}

export async function getEscrow(escrowId: bigint): Promise<Escrow> {
  const client = getPublicClient();
  const escrow = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getEscrow",
    args: [escrowId],
  });
  return escrow as unknown as Escrow;
}

export async function getEvidence(evidenceId: bigint): Promise<Evidence> {
  const client = getPublicClient();
  const evidence = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getEvidence",
    args: [evidenceId],
  });
  return evidence as unknown as Evidence;
}

export async function getEvidenceByEscrow(escrowId: bigint): Promise<bigint[]> {
  const client = getPublicClient();
  const ids = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getEvidenceByEscrow",
    args: [escrowId],
  });
  return ids as bigint[];
}

export async function getArbitration(escrowId: bigint): Promise<Arbitration> {
  const client = getPublicClient();
  const arb = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getArbitration",
    args: [escrowId],
  });
  return arb as unknown as Arbitration;
}

export async function getEscrowsByBuyer(buyer: Address): Promise<bigint[]> {
  const client = getPublicClient();
  const ids = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getEscrowsByBuyer",
    args: [buyer],
  });
  return ids as bigint[];
}

export async function getEscrowsBySeller(seller: Address): Promise<bigint[]> {
  const client = getPublicClient();
  const ids = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getEscrowsBySeller",
    args: [seller],
  });
  return ids as bigint[];
}

export async function getUserEscrows(user: Address): Promise<bigint[]> {
  const client = getPublicClient();
  const ids = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getUserEscrows",
    args: [user],
  });
  return ids as bigint[];
}

export async function getEscrowStatus(escrowId: bigint): Promise<number> {
  const client = getPublicClient();
  const status = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getEscrowStatus",
    args: [escrowId],
  });
  return status as number;
}

export async function getEscrowStats(): Promise<EscrowStats> {
  const client = getPublicClient();
  const stats = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getEscrowStats",
  });
  const [funded, disputed, resolved, total] = stats as [bigint, bigint, bigint, bigint];
  return { funded, disputed, resolved, total };
}

export async function getTotalValueLocked(): Promise<bigint> {
  const client = getPublicClient();
  const tvl = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getTotalValueLocked",
  });
  return tvl as bigint;
}

export async function getPendingWithdrawal(addr: Address): Promise<bigint> {
  const client = getPublicClient();
  const amount = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getPendingWithdrawal",
    args: [addr],
  });
  return amount as bigint;
}

export async function getTrustInfo(arbitrator: Address): Promise<TrustInfo> {
  const client = getPublicClient();
  const info = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getTrustInfo",
    args: [arbitrator],
  });
  const [trustScore, totalDisputes, correctVoteCount] = info as [bigint, bigint, bigint];
  return { trustScore, totalDisputes, correctVoteCount };
}

export async function hasVoted(escrowId: bigint, voter: Address): Promise<boolean> {
  const client = getPublicClient();
  const voted = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "hasVoted",
    args: [escrowId, voter],
  });
  return voted as boolean;
}

export async function getEscrowVoters(escrowId: bigint): Promise<string[]> {
  const client = getPublicClient();
  const voters = await client.readContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName: "getEscrowVoters",
    args: [escrowId],
  });
  return voters as string[];
}

// ===== Write Operations (via wagmi — proper chain-aware for OKX/MetaMask/etc.) =====

/**
 * Send a contract write transaction via wagmi.
 * This ensures the correct chain is used regardless of wallet provider (OKX, MetaMask, etc.).
 * - walletClient.writeContract sends the tx through the connected wallet
 * - publicClient.waitForTransactionReceipt polls the chain RPC for confirmation
 */
// Extract only write function names from the ABI (exclude view/pure)
type WriteFunctionName = Extract<
  (typeof TRUSTGATE_ESCROW_ABI)[number],
  { type: "function"; stateMutability: "nonpayable" | "payable" }
>["name"];

async function writeContractViaWagmi(
  functionName: WriteFunctionName,
  args: readonly unknown[],
  value?: bigint
): Promise<string> {
  // Get the wallet client from wagmi config (works with OKX, MetaMask, etc.)
  const walletClient = await getWalletClient(wagmiConfig);

  if (!walletClient) {
    throw new Error("Wallet not connected. Please connect your wallet first.");
  }

  // Send the transaction through the connected wallet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hash = await walletClient.writeContract({
    address: TRUSTGATE_ADDRESS,
    abi: TRUSTGATE_ESCROW_ABI,
    functionName,
    args: args as any,
    value: value as any,
    chain: walletClient.chain,
  } as any);

  // Wait for receipt using wagmi's public client (same chain as wallet)
  const publicClient = getWagmiPublicClient(wagmiConfig);
  if (!publicClient) {
    throw new Error("Failed to get public client for chain confirmation.");
  }
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 120_000,
    retryDelay: 3_000,
  });

  if (receipt.status === "reverted") {
    throw new Error(`Transaction reverted. Hash: ${hash}`);
  }

  return hash;
}

export async function createEscrow(
  seller: string,
  amount: bigint,
  description: string,
  deadlineDuration: number
): Promise<string> {
  return writeContractViaWagmi("createEscrow", [
    seller as Address,
    amount,
    description,
    BigInt(deadlineDuration),
  ]);
}

/**
 * Create escrow + fund in one call (two sequential transactions).
 */
export async function createAndFundEscrow(
  seller: string,
  amount: bigint,
  description: string,
  deadlineDuration: number
): Promise<{ createHash: string; fundHash: string }> {
  // Step 1: createEscrow (nonpayable)
  const createHash = await writeContractViaWagmi("createEscrow", [
    seller as Address,
    amount,
    description,
    BigInt(deadlineDuration),
  ]);

  // Step 2: fundEscrow (payable) — getEscrowCount() returns escrowCount (post-increment),
  // so the actual new escrow ID is count - 1
  const escrowId = (await getEscrowCount()) - BigInt(1);
  const feeWei = (amount * BigInt(100)) / BigInt(10000); // 1%
  const totalRequired = amount + feeWei;

  const fundHash = await writeContractViaWagmi(
    "fundEscrow",
    [escrowId],
    totalRequired
  );

  return { createHash, fundHash };
}

export async function fundEscrow(
  escrowId: bigint,
  amount: bigint
): Promise<string> {
  return writeContractViaWagmi("fundEscrow", [escrowId], amount);
}

export async function submitEvidence(
  escrowId: bigint,
  rootHash: string,
  filename: string,
  description: string
): Promise<string> {
  return writeContractViaWagmi("submitEvidence", [
    escrowId,
    rootHash as `0x${string}`,
    filename,
    description,
  ]);
}

export async function disputeEscrow(escrowId: bigint): Promise<string> {
  return writeContractViaWagmi("disputeEscrow", [escrowId]);
}

export async function recordAIVerdict(
  escrowId: bigint,
  aiVerdictHash: string
): Promise<string> {
  return writeContractViaWagmi("recordAIVerdict", [
    escrowId,
    aiVerdictHash as `0x${string}`,
  ]);
}

export async function castVote(
  escrowId: bigint,
  voteForBuyer: boolean
): Promise<string> {
  return writeContractViaWagmi("castVote", [escrowId, voteForBuyer]);
}

export async function resolveEscrow(escrowId: bigint): Promise<string> {
  return writeContractViaWagmi("resolveEscrow", [escrowId]);
}

export async function releaseEscrow(escrowId: bigint): Promise<string> {
  return writeContractViaWagmi("releaseEscrow", [escrowId]);
}

export async function refundEscrow(escrowId: bigint): Promise<string> {
  return writeContractViaWagmi("refundEscrow", [escrowId]);
}

export async function withdrawFunds(): Promise<string> {
  return writeContractViaWagmi("withdraw", []);
}

// ===== Status Helpers =====

export const STATUS_LABELS: Record<number, string> = {
  [EscrowStatus.Created]: "Created",
  [EscrowStatus.Funded]: "Funded",
  [EscrowStatus.Evidence]: "Evidence",
  [EscrowStatus.Disputed]: "Disputed",
  [EscrowStatus.Resolved]: "Resolved",
  [EscrowStatus.Released]: "Released",
  [EscrowStatus.Refunded]: "Refunded",
};

export const STATUS_COLORS: Record<number, string> = {
  [EscrowStatus.Created]: "text-yellow-400",
  [EscrowStatus.Funded]: "text-blue-400",
  [EscrowStatus.Evidence]: "text-purple-400",
  [EscrowStatus.Disputed]: "text-red-400",
  [EscrowStatus.Resolved]: "text-green-400",
  [EscrowStatus.Released]: "text-emerald-400",
  [EscrowStatus.Refunded]: "text-gray-400",
};

// ===== Export ABI for external use =====
export { TRUSTGATE_ESCROW_ABI };
