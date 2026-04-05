/**
 * Compute API Routes
 * Handles all 0G Compute interactions server-side.
 *
 * GET  /api/compute?action=services         → List available AI services
 * GET  /api/compute?action=account          → Get account balance info
 * POST /api/compute?action=query             → Send a non-streaming query
 * POST /api/compute?action=stream            → Stream a chat completion (SSE)
 * POST /api/compute?action=acknowledge       → Acknowledge a provider
 * POST /api/compute?action=fund-provider     → Transfer funds to provider
 * POST /api/compute?action=ensure-ready      → Ensure provider is ready (ack + fund)
 * POST /api/compute?action=rag-context       → Fetch file content for RAG
 * POST /api/compute?action=arbitrate          → AI dispute arbitration analysis
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listServices,
  chat,
  chatStream,
  processStreamPayment,
  ensureProviderReady,
  acknowledgeProvider,
  transferFundToProvider,
  getAccountInfo,
  fetchFileContent,
  arbitrate,
  type ChatMessage,
} from "@/lib/compute";

// ===== GET =====

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "services": {
        const services = await listServices();
        return NextResponse.json({ success: true, services });
      }

      case "account": {
        const info = await getAccountInfo();
        return NextResponse.json({ success: true, info });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Unknown action. Use: services, account" },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error(`[Compute API] GET ${action} error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// ===== POST =====

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "query": {
        const { provider, messages, contextText } = body;
        if (!provider || !messages?.length) {
          return NextResponse.json(
            { success: false, error: "provider and messages are required" },
            { status: 400 }
          );
        }
        const result = await chat(provider, messages, contextText);
        return NextResponse.json({ success: true, ...result });
      }

      case "stream": {
        const { provider, messages, contextText } = body;
        if (!provider || !messages?.length) {
          return NextResponse.json(
            { success: false, error: "provider and messages are required" },
            { status: 400 }
          );
        }

        // Get the SSE stream from broker
        const { stream } = await chatStream(
          provider,
          messages as ChatMessage[],
          contextText
        );

        // Forward the SSE stream to the client
        return new NextResponse(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      case "process-payment": {
        const { provider, chatId, content } = body;
        if (!provider || !chatId) {
          return NextResponse.json(
            { success: false, error: "provider, chatId, and content required" },
            { status: 400 }
          );
        }
        const verified = await processStreamPayment(
          provider,
          chatId,
          content || ""
        );
        return NextResponse.json({ success: true, verified });
      }

      case "acknowledge": {
        const { provider } = body;
        if (!provider) {
          return NextResponse.json(
            { success: false, error: "provider address required" },
            { status: 400 }
          );
        }
        const msg = await acknowledgeProvider(provider);
        return NextResponse.json({ success: true, message: msg });
      }

      case "fund-provider": {
        const { provider, amount } = body;
        if (!provider || !amount) {
          return NextResponse.json(
            { success: false, error: "provider and amount required" },
            { status: 400 }
          );
        }
        const msg = await transferFundToProvider(provider, Number(amount));
        return NextResponse.json({ success: true, message: msg });
      }

      case "ensure-ready": {
        const { provider, fundAmount } = body;
        if (!provider) {
          return NextResponse.json(
            { success: false, error: "provider required" },
            { status: 400 }
          );
        }
        await ensureProviderReady(provider, fundAmount);
        return NextResponse.json({
          success: true,
          message: `Provider ${provider} ready`,
        });
      }

      case "rag-context": {
        const { rootHash, storageRpc } = body;
        if (!rootHash || !storageRpc) {
          return NextResponse.json(
            { success: false, error: "rootHash and storageRpc required" },
            { status: 400 }
          );
        }
        const content = await fetchFileContent(rootHash, storageRpc);
        return NextResponse.json({ success: true, content });
      }

      case "arbitrate": {
        const { disputeDescription, evidenceContexts } = body;
        if (!disputeDescription) {
          return NextResponse.json(
            { success: false, error: "disputeDescription is required" },
            { status: 400 }
          );
        }
        const result = await arbitrate(
          disputeDescription,
          evidenceContexts || []
        );
        return NextResponse.json({ success: true, ...result });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error:
              "Unknown action. Use: query, stream, process-payment, acknowledge, fund-provider, ensure-ready, rag-context",
          },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error("[Compute API] POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
