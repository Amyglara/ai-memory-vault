/**
 * Server-side 0G Storage Upload API
 *
 * Bypasses browser Mixed Content restrictions (storage nodes only support HTTP).
 * Accepts a base64-encoded file, uploads via 0G SDK on the server, returns rootHash.
 *
 * POST /api/storage/upload
 * Body: { fileName: string, fileData: string (base64) }
 * Response: { success: boolean, rootHash?: string, error?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  Blob as ZgBlob,
  Indexer,
} from "@0gfoundation/0g-ts-sdk";

// ===== Config =====

const STORAGE_RPC =
  process.env.NEXT_PUBLIC_STORAGE_RPC_TURBO ||
  "https://indexer-storage-testnet-turbo.0g.ai";
const L1_RPC = "https://evmrpc-testnet.0g.ai";
const STORAGE_PRIVATE_KEY = process.env.STORAGE_PRIVATE_KEY || process.env.COMPUTE_PRIVATE_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, fileData } = body;

    if (!fileName || !fileData) {
      return NextResponse.json(
        { success: false, error: "fileName and fileData (base64) are required" },
        { status: 400 }
      );
    }

    if (!STORAGE_PRIVATE_KEY) {
      return NextResponse.json(
        { success: false, error: "Storage private key not configured on server" },
        { status: 500 }
      );
    }

    console.log(`[Storage Upload] Starting upload for: ${fileName}`);

    // 1. Convert base64 to Uint8Array → File
    const buffer = Buffer.from(fileData, "base64");
    const file = new File([buffer], fileName, { type: "application/octet-stream" });

    // 2. Create blob and merkle tree
    console.log("[Storage Upload] Generating Merkle tree...");
    const blob = new ZgBlob(file);
    const [tree, treeErr] = await blob.merkleTree();
    if (treeErr || !tree) {
      throw new Error(treeErr?.message || "Failed to generate Merkle tree");
    }
    const rootHash = tree.rootHash();
    if (!rootHash) {
      throw new Error("Failed to get root hash");
    }
    console.log(`[Storage Upload] Root hash: ${rootHash}`);

    // 3. Upload to storage nodes (server-side, no Mixed Content restriction)
    // Uses @0gfoundation/0g-ts-sdk v1.2+ (old @0glabs v0.3 had ABI incompatibility)
    console.log("[Storage Upload] Uploading to storage nodes...");
    const provider = new ethers.JsonRpcProvider(L1_RPC);
    const wallet = new ethers.Wallet(STORAGE_PRIVATE_KEY, provider);

    const indexer = new Indexer(STORAGE_RPC);
    const uploadResult: any = await indexer.upload(blob, L1_RPC, wallet);

    console.log("[Storage Upload] Raw result:", typeof uploadResult, JSON.stringify(uploadResult, null, 2));

    // Handle different SDK return formats
    let txHash = "unknown";
    try {
      // v1.2+ may return nested objects
      if (typeof uploadResult === "object" && uploadResult !== null) {
        if (typeof uploadResult.txHash === "string") {
          txHash = uploadResult.txHash;
        } else if (Array.isArray(uploadResult)) {
          txHash = String(uploadResult[0] || "");
        } else {
          // Flatten: try to find txHash in nested structure
          const found = JSON.stringify(uploadResult).match(/"txHash"\s*:\s*"([^"]+)"/);
          txHash = found ? found[1] : "unknown";
        }
      } else if (typeof uploadResult === "string") {
        txHash = uploadResult;
      }
      console.log(`[Storage Upload] Upload complete! TX: ${txHash}`);
    } catch (parseErr: any) {
      console.warn("[Storage Upload] Could not parse txHash:", parseErr?.message);
    }

    return NextResponse.json({
      success: true,
      rootHash,
      txHash,
    });
  } catch (err: any) {
    console.error("[Storage Upload] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
