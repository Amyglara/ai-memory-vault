/**
 * 0G Compute Broker Service
 * Server-side only — keeps PRIVATE_KEY secure in API Routes.
 *
 * Flow:
 *   1. createBroker() → singleton broker instance
 *   2. listServices() → available AI providers
 *   3. acknowledgeProvider(addr) → one-time per provider
 *   4. transferFund(addr, amount) → min 1 OG per provider
 *   5. chat(provider, messages) → OpenAI-compatible with auth headers
 *   6. processResponse(provider, chatId, content) → settle payment
 */

import { ethers } from "ethers";
import OpenAI from "openai";

// Lazy-import the broker SDK (server-only)
let ZGComputeNetworkBroker: any;
let createZGComputeNetworkBrokerFn: any;

async function loadSDK() {
  if (!ZGComputeNetworkBroker) {
    const mod = await import("@0glabs/0g-serving-broker");
    ZGComputeNetworkBroker = mod.ZGComputeNetworkBroker;
    createZGComputeNetworkBrokerFn = mod.createZGComputeNetworkBroker;
  }
}

// ===== Config =====

const RPC_URL = process.env.COMPUTE_RPC_URL || "https://evmrpc-testnet.0g.ai";

const OFFICIAL_PROVIDERS: Record<string, string> = {
  "llama-3.3-70b-instruct": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
  "deepseek-r1-70b": "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3",
  "qwen2.5-vl-72b-instruct": "0x6D233D2610c32f630ED53E8a7Cbf759568041f8f",
};

// ===== Types =====

export interface ComputeService {
  provider: string;
  url: string;
  model: string;
  serviceType: string;
  inputPrice: string;
  outputPrice: string;
  verifiability: string;
  isOfficial: boolean;
  modelName: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  chatId: string;
  model: string;
  provider: string;
  verified: boolean;
}

// ===== Broker Singleton =====

let brokerInstance: any = null;
let brokerInitPromise: Promise<any> | null = null;

async function getBroker(): Promise<any> {
  if (brokerInstance) return brokerInstance;
  if (brokerInitPromise) return brokerInitPromise;

  brokerInitPromise = (async () => {
    await loadSDK();
    const privateKey = process.env.COMPUTE_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("COMPUTE_PRIVATE_KEY is not set in environment variables");
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    brokerInstance = await createZGComputeNetworkBrokerFn(wallet);
    console.log(`[Compute] Broker initialized for ${wallet.address}`);
    return brokerInstance;
  })();

  return brokerInitPromise;
}

// ===== Public API =====

export async function listServices(): Promise<ComputeService[]> {
  const broker = await getBroker();
  const services = await broker.inference.listService();

  return services.map((s: any) => {
    const modelName =
      Object.entries(OFFICIAL_PROVIDERS).find(
        ([, addr]) => addr.toLowerCase() === s.provider.toLowerCase()
      )?.[0] || "Unknown";

    return {
      provider: s.provider,
      url: s.url,
      model: s.model || modelName,
      serviceType: s.serviceType || "inference",
      inputPrice: ethers.formatEther(s.inputPrice || 0),
      outputPrice: ethers.formatEther(s.outputPrice || 0),
      verifiability: s.verifiability || "none",
      isOfficial:
        Object.values(OFFICIAL_PROVIDERS)
          .map((a) => a.toLowerCase())
          .includes(s.provider.toLowerCase()),
      modelName,
    };
  });
}

export async function getServiceMetadata(providerAddress: string): Promise<{
  endpoint: string;
  model: string;
}> {
  const broker = await getBroker();
  return broker.inference.getServiceMetadata(providerAddress);
}

export async function acknowledgeProvider(
  providerAddress: string
): Promise<string> {
  const broker = await getBroker();
  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    return `Provider ${providerAddress} acknowledged`;
  } catch (err: any) {
    if (err?.message?.includes("already acknowledged")) {
      return `Provider ${providerAddress} already acknowledged`;
    }
    throw err;
  }
}

export async function transferFundToProvider(
  providerAddress: string,
  amountOg: number
): Promise<string> {
  const broker = await getBroker();
  const amount = ethers.parseEther(amountOg.toString());
  await broker.ledger.transferFund(providerAddress, "inference", amount);
  return `Transferred ${amountOg} OG to provider`;
}

/**
 * Ensure a provider is ready for use:
 * acknowledge + fund transfer (idempotent)
 */
export async function ensureProviderReady(
  providerAddress: string,
  fundAmount = 1.0
): Promise<void> {
  // Acknowledge (idempotent)
  await acknowledgeProvider(providerAddress);

  // Transfer funds (may fail if already funded — ignore)
  try {
    await transferFundToProvider(providerAddress, fundAmount);
  } catch (err: any) {
    // If insufficient main balance, warn but don't block
    console.warn(
      `[Compute] Fund transfer warning: ${err?.message || err}`
    );
  }
}

/**
 * Send a chat completion request (non-streaming).
 * Returns the full response text.
 */
export async function chat(
  providerAddress: string,
  messages: ChatMessage[],
  contextText?: string
): Promise<ChatResult> {
  const broker = await getBroker();

  // Prepare messages with optional RAG context
  const systemMsg: ChatMessage = {
    role: "system",
    content:
      "You are a helpful AI assistant for the AI Memory Vault project. " +
      "You help users understand their stored documents and knowledge. " +
      "Be concise and accurate.",
  };

  const finalMessages = contextText
    ? [
        systemMsg,
        {
          role: "system" as const,
          content: `[Retrieved Context from stored documents]:\n${contextText}\n\nUse the above context to answer the user's question. If the context doesn't contain relevant information, say so.`,
        },
        ...messages,
      ]
    : [systemMsg, ...messages];

  // Get service metadata
  const { endpoint, model } = await broker.inference.getServiceMetadata(
    providerAddress
  );

  // Generate auth headers (single-use)
  const queryText = messages[messages.length - 1]?.content || "";
  const headers = await broker.inference.getRequestHeaders(
    providerAddress,
    queryText
  );

  // Convert headers to plain object
  const headerObj: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      headerObj[key] = value;
    }
  }

  // Create OpenAI client and send request
  const openai = new OpenAI({
    baseURL: endpoint,
    apiKey: "", // 0G Compute uses header-based auth
  });

  const completion = await openai.chat.completions.create(
    {
      model,
      messages: finalMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    },
    { headers: headerObj }
  );

  const content = completion.choices[0]?.message?.content || "";
  const chatId = completion.id;

  // Process payment
  let verified = false;
  try {
    verified = await broker.inference.processResponse(
      providerAddress,
      chatId,
      content
    );
  } catch (err) {
    console.warn(`[Compute] Payment processing warning: ${err}`);
  }

  return {
    content,
    chatId,
    model,
    provider: providerAddress,
    verified,
  };
}

/**
 * Stream a chat completion using the raw fetch API.
 * Returns a ReadableStream of SSE data.
 */
export async function chatStream(
  providerAddress: string,
  messages: ChatMessage[],
  contextText?: string
): Promise<{ stream: ReadableStream; chatId: string }> {
  const broker = await getBroker();

  // Prepare messages with optional RAG context
  const systemMsg: ChatMessage = {
    role: "system",
    content:
      "You are a helpful AI assistant for the AI Memory Vault project. " +
      "You help users understand their stored documents and knowledge. " +
      "Be concise and accurate.",
  };

  const finalMessages = contextText
    ? [
        systemMsg,
        {
          role: "system" as const,
          content: `[Retrieved Context from stored documents]:\n${contextText}\n\nUse the above context to answer the user's question. If the context doesn't contain relevant information, say so.`,
        },
        ...messages,
      ]
    : [systemMsg, ...messages];

  // Get service metadata
  const { endpoint, model } = await broker.inference.getServiceMetadata(
    providerAddress
  );

  // Generate auth headers (single-use)
  const queryText = messages[messages.length - 1]?.content || "";
  const headers = await broker.inference.getRequestHeaders(
    providerAddress,
    queryText
  );

  // Convert headers to plain object
  const headerObj: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      headerObj[key] = value;
    }
  }

  // Use raw fetch for streaming
  const streamUrl = `${endpoint}/chat/completions`;
  const response = await fetch(streamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headerObj,
    },
    body: JSON.stringify({
      model,
      messages: finalMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stream request failed (${response.status}): ${errorText}`);
  }

  // Extract chat ID from SSE stream (first few chunks)
  // We'll return the raw stream; the chatId is extracted client-side from data
  const chatId = `stream-${Date.now()}`;

  return { stream: response.body!, chatId };
}

/**
 * Process payment after streaming completes.
 * chatId should come from the SSE `id` field.
 */
export async function processStreamPayment(
  providerAddress: string,
  chatId: string,
  fullContent: string
): Promise<boolean> {
  const broker = await getBroker();
  try {
    return await broker.inference.processResponse(
      providerAddress,
      chatId,
      fullContent
    );
  } catch (err) {
    console.warn(`[Compute] Stream payment warning: ${err}`);
    return false;
  }
}

/**
 * Get account balance info.
 */
export async function getAccountInfo(): Promise<any> {
  const broker = await getBroker();
  const info = await broker.ledger.getLedger();

  // Serialize BigInt
  return JSON.parse(JSON.stringify(info, (_, v) =>
    typeof v === "bigint" ? v.toString() : v
  ));
}

/**
 * Download a file from 0G Storage for RAG context.
 */
export async function fetchFileContent(
  rootHash: string,
  storageRpc: string
): Promise<string> {
  const url = `${storageRpc}/file?root=${rootHash}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const buffer = await response.arrayBuffer();

  // Try to decode as text
  if (
    contentType.includes("text") ||
    contentType.includes("json") ||
    contentType.includes("markdown")
  ) {
    return new TextDecoder().decode(buffer);
  }

  // For binary files, return a placeholder
  return `[Binary file: ${contentType}, ${buffer.byteLength} bytes]`;
}
