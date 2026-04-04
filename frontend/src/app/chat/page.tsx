"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Database,
  ChevronDown,
  Trash2,
  MessageSquare,
  Zap,
  AlertCircle,
  RefreshCw,
  FileText,
  X,
} from "lucide-react";
import { useAccount } from "wagmi";
import { useNetwork, useI18n } from "@/context";
import { getNetworkConfig } from "@/lib/storage";
import { cn, truncateHash } from "@/lib/utils";

// ===== Types =====

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  chatId?: string;
}

interface ComputeService {
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

interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  messageCount: number;
}

interface RAGStatus {
  active: boolean;
  fileName: string;
  rootHash: string;
  loading: boolean;
}

// ===== Helpers =====

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getConversationTitle(firstMessage: string): string {
  return firstMessage.slice(0, 40) + (firstMessage.length > 40 ? "..." : "");
}

// ===== Main Component =====

export default function ChatPage() {
  const { isConnected, address } = useAccount();
  const { networkType } = useNetwork();
  const { t } = useI18n();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Conversations
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [showConvoList, setShowConvoList] = useState(false);

  // Services
  const [services, setServices] = useState<ComputeService[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  // RAG
  const [ragStatus, setRagStatus] = useState<RAGStatus>({
    active: false,
    fileName: "",
    rootHash: "",
    loading: false,
  });
  const [userFiles, setUserFiles] = useState<
    { rootHash: string; fileName: string }[]
  >([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ===== Load saved state =====

  useEffect(() => {
    if (!address) return;

    // Load conversations
    const savedConvos = localStorage.getItem(
      `vault_convos_${address.toLowerCase()}`
    );
    if (savedConvos) {
      try {
        setConversations(JSON.parse(savedConvos));
      } catch { /* ignore */ }
    }

    // Load selected provider
    const savedProvider = localStorage.getItem(
      `vault_chat_provider_${address.toLowerCase()}`
    );
    if (savedProvider) setSelectedProvider(savedProvider);

    // Load user files from storage uploads
    const savedFiles = localStorage.getItem(
      `vault_files_${address.toLowerCase()}`
    );
    if (savedFiles) {
      try {
        const files = JSON.parse(savedFiles);
        setUserFiles(
          files.map((f: any) => ({
            rootHash: f.rootHash,
            fileName: f.fileName,
          }))
        );
      } catch { /* ignore */ }
    }
  }, [address]);

  // ===== Save conversations =====

  const saveConversations = useCallback(
    (convos: ConversationMeta[]) => {
      if (address) {
        localStorage.setItem(
          `vault_convos_${address.toLowerCase()}`,
          JSON.stringify(convos)
        );
      }
    },
    [address]
  );

  // ===== Load messages for active conversation =====

  useEffect(() => {
    if (!activeConvoId) {
      setMessages([]);
      return;
    }
    const saved = localStorage.getItem(
      `vault_messages_${activeConvoId}`
    );
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, [activeConvoId]);

  // ===== Save messages for active conversation =====

  const saveMessages = useCallback((convoId: string, msgs: ChatMessage[]) => {
    localStorage.setItem(`vault_messages_${convoId}`, JSON.stringify(msgs));
  }, []);

  // ===== Auto-scroll =====

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  // ===== Fetch services =====

  const fetchServices = useCallback(async () => {
    setIsLoadingServices(true);
    try {
      const res = await fetch("/api/compute?action=services");
      const data = await res.json();
      if (data.success) {
        setServices(data.services);
        // Auto-select first official provider
        if (!selectedProvider) {
          const official = data.services.find(
            (s: ComputeService) => s.isOfficial
          );
          if (official) {
            setSelectedProvider(official.provider);
            localStorage.setItem(
              `vault_chat_provider_${address?.toLowerCase()}`,
              official.provider
            );
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch services:", err);
    } finally {
      setIsLoadingServices(false);
    }
  }, [selectedProvider, address]);

  useEffect(() => {
    if (isConnected) {
      fetchServices();
    }
  }, [isConnected, fetchServices]);

  // ===== Send message =====

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming || !selectedProvider) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    // Create or update conversation
    let convoId = activeConvoId;
    if (!convoId) {
      convoId = generateId();
      const newConvo: ConversationMeta = {
        id: convoId,
        title: getConversationTitle(userMessage.content),
        createdAt: Date.now(),
        messageCount: 1,
      };
      setConversations((prev) => {
        const updated = [newConvo, ...prev];
        saveConversations(updated);
        return updated;
      });
      setActiveConvoId(convoId);
      setMessages([]);
    }

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveMessages(convoId, updatedMessages);

    // Update convo meta
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === convoId
          ? {
              ...c,
              messageCount: c.messageCount + 1,
              title:
                c.messageCount === 0
                  ? getConversationTitle(userMessage.content)
                  : c.title,
            }
          : c
      );
      saveConversations(updated);
      return updated;
    });

    setInputValue("");
    setIsStreaming(true);
    setStreamContent("");
    setError(null);

    // Prepare messages for API (exclude system messages)
    const apiMessages = updatedMessages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      // Fetch RAG context if active
      let ragContext: string | undefined;
      if (ragStatus.active && ragStatus.rootHash) {
        const networkConfig = getNetworkConfig(networkType);
        const ragRes = await fetch("/api/compute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rag-context",
            rootHash: ragStatus.rootHash,
            storageRpc: networkConfig.storageRpc,
          }),
        });
        const ragData = await ragRes.json();
        if (ragData.success) {
          ragContext = ragData.content;
        }
      }

      // Ensure provider is ready
      const ensureRes = await fetch("/api/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ensure-ready",
          provider: selectedProvider,
        }),
      });
      const ensureData = await ensureRes.json();
      if (!ensureData.success) {
        throw new Error(ensureData.error || "Failed to prepare provider");
      }

      // Stream chat
      abortRef.current = new AbortController();
      const streamRes = await fetch("/api/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stream",
          provider: selectedProvider,
          messages: apiMessages,
          contextText: ragContext,
        }),
        signal: abortRef.current.signal,
      });

      if (!streamRes.ok) {
        const errorData = await streamRes.json();
        throw new Error(errorData.error || `Stream failed: ${streamRes.status}`);
      }

      // Read SSE stream
      const reader = streamRes.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let extractedChatId = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) {
                  fullContent += delta;
                  setStreamContent(fullContent);
                }
                // Extract chat ID
                if (parsed.id && !extractedChatId) {
                  extractedChatId = parsed.id;
                  setCurrentChatId(parsed.id);
                }
              } catch {
                // Non-JSON SSE data, skip
              }
            }
          }
        }
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: fullContent || "No response received.",
        timestamp: Date.now(),
        chatId: extractedChatId,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveMessages(convoId!, finalMessages);
      setStreamContent("");
      setCurrentChatId(extractedChatId || `stream-${Date.now()}`);

      // Process payment in background
      if (extractedChatId) {
        fetch("/api/compute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "process-payment",
            provider: selectedProvider,
            chatId: extractedChatId,
            content: fullContent,
          }),
        }).catch((err) => console.warn("Payment processing:", err));
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Failed to get response");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [
    inputValue,
    isStreaming,
    selectedProvider,
    messages,
    activeConvoId,
    ragStatus,
    networkType,
    saveMessages,
    saveConversations,
  ]);

  // ===== New conversation =====

  const handleNewConvo = useCallback(() => {
    setActiveConvoId(null);
    setMessages([]);
    setStreamContent("");
    setError(null);
    setCurrentChatId(null);
    setRagStatus({ active: false, fileName: "", rootHash: "", loading: false });
    inputRef.current?.focus();
  }, []);

  // ===== Delete conversation =====

  const handleDeleteConvo = useCallback(
    (convoId: string) => {
      setConversations((prev) => {
        const updated = prev.filter((c) => c.id !== convoId);
        saveConversations(updated);
        return updated;
      });
      localStorage.removeItem(`vault_messages_${convoId}`);
      if (activeConvoId === convoId) {
        handleNewConvo();
      }
    },
    [activeConvoId, handleNewConvo, saveConversations]
  );

  // ===== Keyboard =====

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ===== Render =====

  if (!isConnected) {
    return (
      <div className="max-w-5xl mx-auto animate-slide-up">
        <div className="glass-card p-12 text-center">
          <MessageSquare className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-2">
            {t("chat.connectWallet")}
          </h3>
          <p className="text-zinc-500 text-sm">
            {t("chat.connectWalletHint")}
          </p>
        </div>
      </div>
    );
  }

  const selectedService = services.find(
    (s) => s.provider === selectedProvider
  );

  return (
    <div className="max-w-6xl mx-auto animate-slide-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">
            <span className="neon-text">{t("chat.title").split(" ")[0]}</span> {t("chat.title").split(" ").slice(1).join(" ")}
          </h1>
          <p className="text-zinc-400">
            {t("chat.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Provider selector */}
          <div className="relative">
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                localStorage.setItem(
                  `vault_chat_provider_${address?.toLowerCase()}`,
                  e.target.value
                );
              }}
              disabled={isLoadingServices}
              className="neon-input pr-8 py-2 text-sm appearance-none cursor-pointer min-w-[200px]"
            >
              {isLoadingServices ? (
                <option>{t("chat.loadingServices")}</option>
              ) : services.length === 0 ? (
                <option>{t("chat.noServices")}</option>
              ) : (
                services.map((s) => (
                  <option key={s.provider} value={s.provider}>
                    {s.modelName || s.model}
                    {s.isOfficial ? " ★" : ""}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Sidebar - Conversation List */}
        <div
          className={cn(
            "w-64 flex-shrink-0 transition-all duration-300 overflow-hidden",
            showConvoList ? "w-64 opacity-100" : "w-0 opacity-0"
          )}
        >
          <div className="glass-card p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-400">
                {t("chat.conversations")}
              </h3>
              <button
                onClick={handleNewConvo}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-neon-cyan hover:bg-neon-cyan/10 transition-all"
                title={t("chat.newConvo")}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {conversations.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-8">
                  {t("chat.noConversations")}
                </p>
              ) : (
                conversations.map((convo) => (
                  <div
                    key={convo.id}
                    onClick={() => {
                      setActiveConvoId(convo.id);
                    }}
                    className={cn(
                      "group p-2.5 rounded-lg cursor-pointer transition-all text-left",
                      convo.id === activeConvoId
                        ? "bg-neon-cyan/10 border border-neon-cyan/20"
                        : "hover:bg-white/[0.04] border border-transparent"
                    )}
                  >
                    <p className="text-xs text-zinc-300 truncate font-medium">
                      {convo.title}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-zinc-600">
                        {convo.messageCount} {t("chat.messages")}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConvo(convo.id);
                        }}
                        className="p-0.5 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 glass-card flex flex-col min-w-0">
          {/* Chat toolbar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
            <button
              onClick={() => setShowConvoList(!showConvoList)}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
              title="Toggle conversations"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            <div className="flex-1" />

            {/* Model info */}
            {selectedService && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <Sparkles className="w-3.5 h-3.5 text-neon-purple" />
                <span className="text-xs text-zinc-400">
                  {selectedService.modelName}
                </span>
                {selectedService.isOfficial && (
                  <Zap className="w-3 h-3 text-amber-400" />
                )}
              </div>
            )}

            {/* RAG toggle */}
            {userFiles.length > 0 && (
              <div className="relative">
                <select
                  value={
                    ragStatus.active ? ragStatus.rootHash : "__none__"
                  }
                  onChange={(e) => {
                    if (e.target.value === "__none__") {
                      setRagStatus({
                        active: false,
                        fileName: "",
                        rootHash: "",
                        loading: false,
                      });
                    } else {
                      const file = userFiles.find(
                        (f) => f.rootHash === e.target.value
                      );
                      if (file) {
                        setRagStatus({
                          active: true,
                          fileName: file.fileName,
                          rootHash: file.rootHash,
                          loading: false,
                        });
                      }
                    }
                  }}
                  className="neon-input py-1.5 px-3 text-xs appearance-none cursor-pointer min-w-[140px] pr-6"
                >
                  <option value="__none__">{t("chat.noRag")}</option>
                  {userFiles.map((f) => (
                    <option key={f.rootHash} value={f.rootHash}>
                      {f.fileName}
                    </option>
                  ))}
                </select>
                <Database className="w-3.5 h-3.5 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            <button
              onClick={handleNewConvo}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
              title={t("chat.newConvo")}
              >
                <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* RAG indicator */}
          {ragStatus.active && (
            <div className="px-4 py-2 bg-neon-cyan/5 border-b border-neon-cyan/10 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-neon-cyan" />
                <span className="text-xs text-neon-cyan">
                  {t("chat.ragIndicator", { fileName: ragStatus.fileName })}
                </span>
              <button
                onClick={() =>
                  setRagStatus({
                    active: false,
                    fileName: "",
                    rootHash: "",
                    loading: false,
                  })
                }
                className="ml-auto p-0.5 rounded text-neon-cyan/60 hover:text-neon-cyan transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && !isStreaming && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4 max-w-sm">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-white/[0.08] flex items-center justify-center mx-auto">
                    <Bot className="w-8 h-8 text-neon-cyan" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-200 mb-2">
                      {t("chat.welcome.title")}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {t("chat.welcome.subtitle")}
                    </p>
                  </div>
                  {selectedService && (
                    <div className="flex items-center justify-center gap-2 text-xs text-zinc-600">
                      <Sparkles className="w-3 h-3" />
                      {selectedService.modelName}
                      {selectedService.isOfficial && " (Official)"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-neon-cyan" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "chat-message-user text-zinc-100"
                      : "chat-message-ai text-zinc-200"
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-zinc-400" />
                  </div>
                )}
              </div>
            ))}

            {/* Streaming content */}
            {isStreaming && streamContent && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-neon-cyan" />
                </div>
                <div className="chat-message-ai max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed text-zinc-200">
                  <div className="whitespace-pre-wrap break-words">
                    {streamContent}
                    <span className="inline-block w-2 h-4 bg-neon-cyan/60 animate-pulse ml-0.5 align-text-bottom" />
                  </div>
                </div>
              </div>
            )}

            {/* Loading indicator (before stream starts) */}
            {isStreaming && !streamContent && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-neon-cyan" />
                </div>
                <div className="chat-message-ai rounded-2xl px-4 py-3">
                  <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 flex-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-white/[0.06]">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    selectedProvider
                      ? t("chat.inputPlaceholder")
                      : t("chat.selectProvider")
                  }
                  disabled={isStreaming || !selectedProvider}
                  rows={1}
                  className="neon-input pr-12 py-3 resize-none max-h-32 overflow-y-auto disabled:opacity-50"
                  style={{ minHeight: "44px" }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={
                  isStreaming || !inputValue.trim() || !selectedProvider
                }
                className={cn(
                  "p-3 rounded-xl transition-all duration-200",
                  inputValue.trim() && selectedProvider && !isStreaming
                    ? "neon-button px-4 py-3"
                    : "bg-white/[0.04] text-zinc-600 cursor-not-allowed"
                )}
              >
                {isStreaming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Bottom info */}
            <div className="flex items-center justify-between mt-2 px-1">
              <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                {selectedService && (
                  <>
                    <span>
                      {t("chat.inPrice", { price: selectedService.inputPrice })}
                    </span>
                    <span>
                      {t("chat.outPrice", { price: selectedService.outputPrice })}
                    </span>
                  </>
                )}
                {selectedService?.verifiability === "TeeML" && (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" />
                    {t("chat.teeVerified")}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-700">
                {t("chat.computeNetwork")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
