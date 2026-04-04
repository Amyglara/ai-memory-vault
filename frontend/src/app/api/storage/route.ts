import { NextRequest, NextResponse } from "next/server";

/**
 * Storage API Route
 *
 * GET /api/storage?root=0x... — Download file from 0G Storage (proxy)
 * GET /api/storage/info?root=0x... — Get file metadata from contract
 */

const STORAGE_RPC_TURBO =
  process.env.STORAGE_RPC_TURBO || "https://indexer-storage-testnet-turbo.0g.ai";
const STORAGE_RPC_STANDARD =
  process.env.STORAGE_RPC_STANDARD || "https://indexer-storage-testnet-standard.0g.ai";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rootHash = searchParams.get("root");
  const mode = searchParams.get("mode"); // "download" | "info"

  if (!rootHash) {
    return NextResponse.json(
      { error: "Missing required parameter: root" },
      { status: 400 }
    );
  }

  // Validate root hash format
  if (!/^0x[a-fA-F0-9]{64}$/.test(rootHash)) {
    return NextResponse.json(
      { error: "Invalid root hash format. Expected 0x-prefixed 64 hex chars." },
      { status: 400 }
    );
  }

  const network = searchParams.get("network") || "turbo";
  const storageRpc = network === "standard" ? STORAGE_RPC_STANDARD : STORAGE_RPC_TURBO;

  // File download proxy
  if (mode === "download" || !mode) {
    try {
      const apiUrl = `${storageRpc}/file?root=${rootHash}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        return NextResponse.json(
          { error: `Storage download failed: ${response.status} ${response.statusText}` },
          { status: response.status }
        );
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const contentLength = response.headers.get("content-length");

      const buffer = await response.arrayBuffer();

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": contentLength || String(buffer.byteLength),
          "Content-Disposition": `attachment; filename="vault-${rootHash.slice(0, 8)}.bin"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (error) {
      console.error("[Storage API] Download error:", error);
      return NextResponse.json(
        { error: "Failed to fetch file from storage network" },
        { status: 500 }
      );
    }
  }

  // File existence check
  if (mode === "exists") {
    try {
      const apiUrl = `${storageRpc}/file?root=${rootHash}`;
      const response = await fetch(apiUrl, { method: "HEAD" });

      if (response.ok) {
        return NextResponse.json({
          exists: true,
          size: response.headers.get("content-length"),
        });
      }

      return NextResponse.json({ exists: false });
    } catch (error) {
      console.error("[Storage API] Exists check error:", error);
      return NextResponse.json({ exists: false });
    }
  }

  return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
}
