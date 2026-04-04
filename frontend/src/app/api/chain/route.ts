import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { zgTestnet } from "@/lib/config";

/**
 * Chain API Route
 *
 * Provides server-side contract read operations for the MemoryVault contract.
 * This avoids exposing contract ABI details to the client for complex queries.
 */

const MEMORY_VAULT_ADDRESS = "0x7826Ac2d7DC10Da069498268f22E8346cB1f082b";

const ABI = [
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
    inputs: [{ name: "owner", type: "address" }],
    name: "getFilesByOwner",
    outputs: [{ name: "", type: "uint256[]" }],
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
] as const;

// Singleton public client
let publicClient: ReturnType<typeof createPublicClient> | null = null;

function getClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: {
        ...zgTestnet,
        rpcUrls: {
          default: { http: [process.env.L1_RPC || "https://evmrpc-testnet.0g.ai"] },
        },
      },
      transport: http(),
    });
  }
  return publicClient;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  const client = getClient();

  try {
    switch (action) {
      case "stats": {
        const [fileCount, agentCount] = await Promise.all([
          client.readContract({
            address: MEMORY_VAULT_ADDRESS,
            abi: ABI,
            functionName: "fileCount",
          }),
          client.readContract({
            address: MEMORY_VAULT_ADDRESS,
            abi: ABI,
            functionName: "agentCount",
          }),
        ]);
        return NextResponse.json({
          fileCount: Number(fileCount),
          agentCount: Number(agentCount),
        });
      }

      case "file": {
        const fileId = searchParams.get("id");
        if (!fileId) {
          return NextResponse.json({ error: "Missing parameter: id" }, { status: 400 });
        }
        const file = await client.readContract({
          address: MEMORY_VAULT_ADDRESS,
          abi: ABI,
          functionName: "getFile",
          args: [BigInt(fileId)],
        });
        return NextResponse.json({ file });
      }

      case "files-by-owner": {
        const owner = searchParams.get("address");
        if (!owner) {
          return NextResponse.json({ error: "Missing parameter: address" }, { status: 400 });
        }
        const ids = await client.readContract({
          address: MEMORY_VAULT_ADDRESS,
          abi: ABI,
          functionName: "getFilesByOwner",
          args: [owner as `0x${string}`],
        });

        // Fetch all file details
        const files = await Promise.all(
          (ids as bigint[]).map(async (id) => {
            const file = await client.readContract({
              address: MEMORY_VAULT_ADDRESS,
              abi: ABI,
              functionName: "getFile",
              args: [id],
            });
            return { id: Number(id), ...file };
          })
        );

        return NextResponse.json({ files });
      }

      case "is-anchored": {
        const root = searchParams.get("root");
        if (!root) {
          return NextResponse.json({ error: "Missing parameter: root" }, { status: 400 });
        }
        const registered = await client.readContract({
          address: MEMORY_VAULT_ADDRESS,
          abi: ABI,
          functionName: "registeredRoots",
          args: [root as `0x${string}`],
        });
        return NextResponse.json({ anchored: Boolean(registered) });
      }

      default:
        return NextResponse.json(
          { error: "Unknown action. Use: stats, file, files-by-owner, is-anchored" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("[Chain API] Error:", error);
    return NextResponse.json(
      { error: error?.shortMessage || error?.message || "Chain query failed" },
      { status: 500 }
    );
  }
}
