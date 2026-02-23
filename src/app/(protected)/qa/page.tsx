"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Bot,
  Bug,
  ClipboardList,
  Loader2,
  Pin,
  Search,
  SendHorizontal,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLocalStorage } from "usehooks-ts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import useProject from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type MessageRole = "user" | "assistant";
type MessageState = "done" | "streaming" | "error";
type ChatMode = "ask" | "analyze" | "debug" | "plan";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  state: MessageState;
  createdAt: number;
}

interface MemoryItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

type ProjectConversationStore = Record<string, ChatMessage[]>;
type ProjectMemoryStore = Record<string, MemoryItem[]>;

const HISTORY_STORAGE_KEY = "dionysus-qa-history-v1";
const MEMORY_STORAGE_KEY = "dionysus-qa-memory-v1";
const CHAT_MODE_STORAGE_KEY = "dionysus-qa-mode-v1";
const MAX_MEMORY_ITEMS = 8;

const CHAT_MODE_ORDER: ChatMode[] = ["ask", "analyze", "debug", "plan"];
const CHAT_MODE_CONFIG: Record<
  ChatMode,
  {
    label: string;
    helper: string;
    instruction: string;
    quickPrompts: string[];
    icon: typeof Search;
  }
> = {
  ask: {
    label: "Ask",
    helper: "General repository Q&A with concise answers.",
    instruction: "Answer directly using repository context and highlight uncertainty.",
    quickPrompts: [
      "What changed in the latest commits?",
      "Any risky changes before release?",
      "Summarize backend related updates.",
      "What should we test first?",
    ],
    icon: Search,
  },
  analyze: {
    label: "Analyze",
    helper: "Structured analysis with reasoning and tradeoffs.",
    instruction: "Provide a structured analysis with key risks, impact, and recommended actions.",
    quickPrompts: [
      "Analyze the architectural impact of recent commits.",
      "What performance risks do you see?",
      "Which files are most change-prone?",
      "What are the top three release blockers?",
    ],
    icon: Sparkles,
  },
  debug: {
    label: "Debug",
    helper: "Failure-focused mode with root-cause guidance.",
    instruction: "Focus on bug diagnosis, likely root causes, and concrete verification steps.",
    quickPrompts: [
      "Where could a null/undefined bug occur?",
      "What changed that can break auth flow?",
      "Suggest a debugging checklist for recent backend changes.",
      "Which recent commit is most likely to introduce regressions?",
    ],
    icon: Bug,
  },
  plan: {
    label: "Plan",
    helper: "Execution planning mode for next milestones.",
    instruction: "Return a practical implementation plan with priority order and effort notes.",
    quickPrompts: [
      "Plan next sprint tasks based on recent changes.",
      "What should we ship this week to reduce risk?",
      "Break down release-readiness actions.",
      "Prioritize the highest-impact technical debt fixes.",
    ],
    icon: Wrench,
  },
};

const createMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizeAiText = (value: string) =>
  value
    .replace(/\r/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .trim();

const truncateText = (value: string, maxLength: number) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;

const QaPage = () => {
  const { project, projectId } = useProject();
  const [question, setQuestion] = useState("");
  const [chatMode, setChatMode] = useLocalStorage<ChatMode>(CHAT_MODE_STORAGE_KEY, "ask");
  const [conversationByProject, setConversationByProject] =
    useLocalStorage<ProjectConversationStore>(HISTORY_STORAGE_KEY, {});
  const [memoryByProject, setMemoryByProject] = useLocalStorage<ProjectMemoryStore>(
    MEMORY_STORAGE_KEY,
    {},
  );
  const chatViewportRef = useRef<HTMLDivElement | null>(null);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const askRepoAi = api.project.askRepoAi.useMutation();

  const activeMode = CHAT_MODE_CONFIG[chatMode];
  const ModeIcon = activeMode.icon;

  const activeMessages = useMemo(() => {
    if (!projectId) {
      return [];
    }

    return conversationByProject[projectId] ?? [];
  }, [conversationByProject, projectId]);

  const activeMemory = useMemo(() => {
    if (!projectId) {
      return [];
    }

    return memoryByProject[projectId] ?? [];
  }, [memoryByProject, projectId]);

  const isStreamingMessage = activeMessages.some((message) => message.state === "streaming");
  const canSend = Boolean(projectId && question.trim()) && !askRepoAi.isPending && !isStreamingMessage;

  const updateConversationForProject = useCallback(
    (targetProjectId: string, updater: (previous: ChatMessage[]) => ChatMessage[]) => {
      setConversationByProject((previousStore) => {
        const previousConversation = previousStore[targetProjectId] ?? [];
        const nextConversation = updater(previousConversation);
        return {
          ...previousStore,
          [targetProjectId]: nextConversation,
        };
      });
    },
    [setConversationByProject],
  );

  const updateMemoryForProject = useCallback(
    (targetProjectId: string, updater: (previous: MemoryItem[]) => MemoryItem[]) => {
      setMemoryByProject((previousStore) => {
        const previousMemory = previousStore[targetProjectId] ?? [];
        const nextMemory = updater(previousMemory);
        return {
          ...previousStore,
          [targetProjectId]: nextMemory,
        };
      });
    },
    [setMemoryByProject],
  );

  const streamAssistantMessage = useCallback(
    (targetProjectId: string, messageId: string, finalText: string) => {
      return new Promise<void>((resolve) => {
        const safeText =
          finalText.trim().length > 0
            ? finalText
            : "I could not find enough repository context for that answer.";

        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
        }

        let cursor = 0;
        const chunkSize = safeText.length > 1000 ? 18 : safeText.length > 350 ? 11 : 7;

        streamIntervalRef.current = setInterval(() => {
          cursor = Math.min(safeText.length, cursor + chunkSize);

          updateConversationForProject(targetProjectId, (previousConversation) =>
            previousConversation.map((message) => {
              if (message.id !== messageId) {
                return message;
              }

              return {
                ...message,
                content: safeText.slice(0, cursor),
                state: cursor >= safeText.length ? "done" : "streaming",
              };
            }),
          );

          if (cursor >= safeText.length) {
            if (streamIntervalRef.current) {
              clearInterval(streamIntervalRef.current);
              streamIntervalRef.current = null;
            }
            resolve();
          }
        }, 26);
      });
    },
    [updateConversationForProject],
  );

  useEffect(() => {
    const container = chatViewportRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "auto",
    });
  }, [activeMessages, askRepoAi.isPending]);

  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, []);

  const clearCurrentConversation = () => {
    if (!projectId) {
      toast.error("Select a project first");
      return;
    }

    updateConversationForProject(projectId, () => []);
  };

  const pinAssistantMessage = (message: ChatMessage) => {
    if (!projectId) {
      toast.error("Select a project first");
      return;
    }

    if (message.role !== "assistant" || message.state !== "done") {
      return;
    }

    const cleanContent = message.content.trim();
    if (!cleanContent) {
      return;
    }

    let alreadyPinned = false;

    updateMemoryForProject(projectId, (previousMemory) => {
      alreadyPinned = previousMemory.some((item) => item.content === cleanContent);
      if (alreadyPinned) {
        return previousMemory;
      }

      const title = truncateText(cleanContent.split("\n").find(Boolean) ?? "Pinned insight", 80);
      const nextItem: MemoryItem = {
        id: createMessageId(),
        title,
        content: cleanContent,
        createdAt: Date.now(),
      };
      return [nextItem, ...previousMemory].slice(0, MAX_MEMORY_ITEMS);
    });

    if (alreadyPinned) {
      toast.info("This answer is already in project memory");
      return;
    }

    toast.success("Pinned answer to project memory");
  };

  const removeMemoryItem = (memoryId: string) => {
    if (!projectId) {
      return;
    }

    updateMemoryForProject(projectId, (previousMemory) =>
      previousMemory.filter((item) => item.id !== memoryId),
    );
  };

  const insertMemoryIntoQuestion = (memoryItem: MemoryItem) => {
    const memorySnippet = `Use this saved context: ${truncateText(memoryItem.content, 320)}`;
    setQuestion((previousQuestion) => {
      if (!previousQuestion.trim()) {
        return memorySnippet;
      }

      return `${previousQuestion.trim()}\n\n${memorySnippet}`;
    });
  };

  const handleSend = async () => {
    if (!projectId) {
      toast.error("Select a project from the sidebar first");
      return;
    }

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      toast.error("Type a question before sending");
      return;
    }

    const targetProjectId = projectId;
    const memoryContext = activeMemory
      .slice(0, 3)
      .map((item, index) => `${index + 1}. ${truncateText(item.content, 320)}`)
      .join("\n");

    const prompt = [
      `Mode: ${activeMode.label}. ${activeMode.instruction}`,
      memoryContext ? `Project memory:\n${memoryContext}` : null,
      `User question:\n${trimmedQuestion}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: `[${activeMode.label}] ${trimmedQuestion}`,
      state: "done",
      createdAt: Date.now(),
    };

    updateConversationForProject(targetProjectId, (previousConversation) => [
      ...previousConversation,
      userMessage,
    ]);

    setQuestion("");

    try {
      const { answer } = await askRepoAi.mutateAsync({
        projectId: targetProjectId,
        question: prompt,
      });

      const assistantMessageId = createMessageId();
      updateConversationForProject(targetProjectId, (previousConversation) => [
        ...previousConversation,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          state: "streaming",
          createdAt: Date.now(),
        },
      ]);

      await streamAssistantMessage(targetProjectId, assistantMessageId, normalizeAiText(answer));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to get AI answer: ${reason}`);

      updateConversationForProject(targetProjectId, (previousConversation) => [
        ...previousConversation,
        {
          id: createMessageId(),
          role: "assistant",
          content: "I could not generate an answer right now. Please try again.",
          state: "error",
          createdAt: Date.now(),
        },
      ]);
    }
  };

  const handleQuestionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <section className="relative flex h-full flex-col bg-gradient-to-b from-background to-muted/20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-16 h-24 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12),transparent_68%)]"
      />
      <header className="border-b bg-background/85 px-4 py-4 backdrop-blur-sm md:px-6">
        <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">Project Q&A</h1>
            <p className="text-sm text-muted-foreground">
              Chat with repository-aware AI using project-scoped commit context.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {CHAT_MODE_ORDER.map((modeKey) => {
                const mode = CHAT_MODE_CONFIG[modeKey];
                const Icon = mode.icon;
                const isActive = chatMode === modeKey;
                return (
                  <Button
                    key={modeKey}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setChatMode(modeKey)}
                    className="h-8"
                  >
                    <Icon className="size-3.5" />
                    {mode.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{activeMode.helper}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={projectId ? "default" : "secondary"}>
              {project?.name ?? "No project selected"}
            </Badge>
            <Badge variant="outline">{activeMode.label} mode</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={clearCurrentConversation}
              disabled={!projectId || activeMessages.length === 0}
            >
              <Trash2 className="size-4" />
              Clear
            </Button>
          </div>
        </div>
      </header>

      <div ref={chatViewportRef} className="relative flex-1 overflow-y-auto px-4 py-5 md:px-6">
        <div className="mx-auto flex w-full flex-col gap-4">
          {projectId && (
            <Card className="border-dashed">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-sm font-medium">
                    <ClipboardList className="size-4 text-primary" />
                    Project Memory
                  </div>
                  <Badge variant="secondary">{activeMemory.length}</Badge>
                </div>

                {activeMemory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Pin useful assistant answers to build reusable project context.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeMemory.slice(0, 3).map((memoryItem) => (
                      <div
                        key={memoryItem.id}
                        className="flex items-start justify-between gap-2 rounded-lg border bg-muted/20 p-3"
                      >
                        <button
                          type="button"
                          onClick={() => insertMemoryIntoQuestion(memoryItem)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-xs font-semibold">{memoryItem.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {memoryItem.content}
                          </p>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => removeMemoryItem(memoryItem.id)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!projectId && (
            <Card className="border-dashed">
              <CardContent className="space-y-3 p-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-5 text-primary" />
                </div>
                <p className="text-base font-medium">Select a project to start Q&A</p>
                <p className="text-sm text-muted-foreground">
                  Project context is required. Pick a project from the sidebar and ask questions
                  about commits, risks, architecture, and release readiness.
                </p>
              </CardContent>
            </Card>
          )}

          {projectId && activeMessages.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ModeIcon className="size-4 text-primary" />
                  Starter prompts for {project?.name} in {activeMode.label} mode
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {activeMode.quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setQuestion(prompt)}
                      className="rounded-xl border bg-muted/30 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeMessages.map((message) => {
            const isUser = message.role === "user";
            return (
              <article
                key={message.id}
                className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[min(88%,56rem)] rounded-2xl border px-4 py-3 shadow-sm",
                    isUser
                      ? "border-primary/30 bg-primary text-primary-foreground"
                      : "border-border bg-background shadow-[0_10px_30px_-24px_rgba(56,189,248,0.8)]",
                  )}
                >
                  <p
                    className={cn(
                      "mb-1 text-[11px] font-semibold uppercase tracking-wide",
                      isUser ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {isUser ? "You" : "Repo AI"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  {message.state === "streaming" && (
                    <div className="mt-2 inline-flex h-4 items-center rounded-sm bg-muted px-2 text-[10px] text-muted-foreground">
                      generating...
                    </div>
                  )}
                  {!isUser && message.state === "done" && (
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => pinAssistantMessage(message)}
                      >
                        <Pin className="size-3.5" />
                        Pin to Memory
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {askRepoAi.isPending && (
            <article className="flex w-full justify-start">
              <div className="rounded-2xl border bg-background px-4 py-3 shadow-sm">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Repo AI
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Thinking with project context...
                </div>
              </div>
            </article>
          )}
        </div>
      </div>

      <footer className="border-t bg-background/95 px-4 py-4 md:px-6">
        <div className="mx-auto w-full">
          <div className="relative rounded-2xl border bg-background p-3 shadow-sm transition-all duration-200 focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.14),0_16px_36px_-28px_rgba(59,130,246,0.45)]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-primary/35 to-transparent"
            />
            <Textarea
              placeholder={
                projectId
                  ? `Ask in ${activeMode.label} mode about commits, architecture, risk, or release readiness...`
                  : "Select a project from the sidebar to start asking questions..."
              }
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleQuestionKeyDown}
              rows={3}
              disabled={!projectId}
              className="min-h-[78px] resize-none border-0 px-1 shadow-none focus-visible:ring-0"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {projectId
                  ? `${activeMode.label} mode active. ${activeMemory.length} memory snippets available.`
                  : "Select a project to enable Q&A."}
              </p>

              <Button
                onClick={() => {
                  void handleSend();
                }}
                disabled={!canSend}
                className="min-w-24"
              >
                {askRepoAi.isPending || isStreamingMessage ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <SendHorizontal className="size-4" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </section>
  );
};

export default QaPage;
