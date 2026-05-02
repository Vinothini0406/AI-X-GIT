"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  AlertCircle,
  Bot,
  Bug,
  Check,
  ClipboardList,
  Loader2,
  MessageSquareText,
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
import { Textarea } from "@/components/ui/textarea";
import useProject from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type MessageRole = "user" | "assistant";
type MessageState = "done" | "streaming" | "error";
type ChatMode = "ask" | "analyze" | "debug" | "plan";
type FeedbackTone = "info" | "loading" | "success" | "error";

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

interface FeedbackState {
  tone: FeedbackTone;
  title: string;
  description: string;
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
    helper: "Concise answers grounded in repository context.",
    instruction:
      "Answer directly using repository context and highlight uncertainty.",
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
    helper: "Structured analysis with impact and tradeoffs.",
    instruction:
      "Provide a structured analysis with key risks, impact, and recommended actions.",
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
    helper: "Root-cause guidance for likely failures.",
    instruction:
      "Focus on bug diagnosis, likely root causes, and concrete verification steps.",
    quickPrompts: [
      "Where could a null or undefined bug occur?",
      "What changed that can break auth flow?",
      "Suggest a debugging checklist for recent backend changes.",
      "Which recent commit is most likely to introduce regressions?",
    ],
    icon: Bug,
  },
  plan: {
    label: "Plan",
    helper: "Practical next steps for execution.",
    instruction:
      "Return a practical implementation plan with priority order and effort notes.",
    quickPrompts: [
      "Plan next sprint tasks based on recent changes.",
      "What should we ship this week to reduce risk?",
      "Break down release-readiness actions.",
      "Prioritize the highest-impact technical debt fixes.",
    ],
    icon: Wrench,
  },
};

const feedbackToneClass: Record<FeedbackTone, string> = {
  info: "border-border bg-muted/25",
  loading: "border-border bg-muted/35",
  success: "border-border bg-background",
  error: "border-destructive/30 bg-destructive/5 text-destructive",
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

const formatMessageTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));

const QaPage = () => {
  const { project, projectId } = useProject();
  const [question, setQuestion] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [chatMode, setChatMode] = useLocalStorage<ChatMode>(
    CHAT_MODE_STORAGE_KEY,
    "ask",
  );
  const [conversationByProject, setConversationByProject] =
    useLocalStorage<ProjectConversationStore>(HISTORY_STORAGE_KEY, {});
  const [memoryByProject, setMemoryByProject] =
    useLocalStorage<ProjectMemoryStore>(MEMORY_STORAGE_KEY, {});
  const chatViewportRef = useRef<HTMLDivElement | null>(null);
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const askRepoAi = api.project.askRepoAi.useMutation();

  const safeChatMode = CHAT_MODE_ORDER.includes(chatMode) ? chatMode : "ask";
  const activeMode = CHAT_MODE_CONFIG[safeChatMode];
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

  const isStreamingMessage = activeMessages.some(
    (message) => message.state === "streaming",
  );
  const canSend =
    Boolean(projectId && question.trim()) &&
    !askRepoAi.isPending &&
    !isStreamingMessage;
  const answerCount = activeMessages.filter(
    (message) => message.role === "assistant",
  ).length;

  const statusLabel = !projectId
    ? "Select repository"
    : askRepoAi.isPending || isStreamingMessage
      ? "Answering"
      : "Ready";

  const updateConversationForProject = useCallback(
    (
      targetProjectId: string,
      updater: (previous: ChatMessage[]) => ChatMessage[],
    ) => {
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
    (
      targetProjectId: string,
      updater: (previous: MemoryItem[]) => MemoryItem[],
    ) => {
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
        const chunkSize =
          safeText.length > 1000 ? 18 : safeText.length > 350 ? 11 : 7;

        streamIntervalRef.current = setInterval(() => {
          cursor = Math.min(safeText.length, cursor + chunkSize);

          updateConversationForProject(
            targetProjectId,
            (previousConversation) =>
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
    setFeedback(
      projectId
        ? {
            tone: "info",
            title: "Repository context loaded",
            description: `${project?.name ?? "Selected repository"} is ready for Q&A.`,
          }
        : null,
    );
  }, [project?.name, projectId]);

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
    setFeedback({
      tone: "success",
      title: "Conversation cleared",
      description: "The current repository Q&A thread is now empty.",
    });
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
      alreadyPinned = previousMemory.some(
        (item) => item.content === cleanContent,
      );
      if (alreadyPinned) {
        return previousMemory;
      }

      const title = truncateText(
        cleanContent.split("\n").find(Boolean) ?? "Pinned insight",
        80,
      );
      const nextItem: MemoryItem = {
        id: createMessageId(),
        title,
        content: cleanContent,
        createdAt: Date.now(),
      };
      return [nextItem, ...previousMemory].slice(0, MAX_MEMORY_ITEMS);
    });

    if (alreadyPinned) {
      setFeedback({
        tone: "info",
        title: "Already saved",
        description: "This answer is already in repository memory.",
      });
      return;
    }

    setFeedback({
      tone: "success",
      title: "Answer saved",
      description: "The answer was added to repository memory.",
    });
    toast.success("Pinned answer to project memory");
  };

  const removeMemoryItem = (memoryId: string) => {
    if (!projectId) {
      return;
    }

    updateMemoryForProject(projectId, (previousMemory) =>
      previousMemory.filter((item) => item.id !== memoryId),
    );
    setFeedback({
      tone: "success",
      title: "Saved answer removed",
      description: "Repository memory was updated.",
    });
  };

  const insertMemoryIntoQuestion = (memoryItem: MemoryItem) => {
    const memorySnippet = `Use this saved context: ${truncateText(memoryItem.content, 320)}`;
    setQuestion((previousQuestion) => {
      if (!previousQuestion.trim()) {
        return memorySnippet;
      }

      return `${previousQuestion.trim()}\n\n${memorySnippet}`;
    });
    questionInputRef.current?.focus();
  };

  const selectPrompt = (prompt: string) => {
    setQuestion(prompt);
    requestAnimationFrame(() => questionInputRef.current?.focus());
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
    setFeedback({
      tone: "loading",
      title: "Question sent",
      description: "Generating an answer from the selected repository context.",
    });

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

      await streamAssistantMessage(
        targetProjectId,
        assistantMessageId,
        normalizeAiText(answer),
      );
      setFeedback({
        tone: "success",
        title: "Answer ready",
        description:
          "The latest response is now available in the conversation.",
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to get AI answer: ${reason}`);

      updateConversationForProject(targetProjectId, (previousConversation) => [
        ...previousConversation,
        {
          id: createMessageId(),
          role: "assistant",
          content:
            "I could not generate an answer right now. Please try again.",
          state: "error",
          createdAt: Date.now(),
        },
      ]);
      setFeedback({
        tone: "error",
        title: "Answer failed",
        description: reason,
      });
    }
  };

  const handleQuestionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex min-h-[calc(100svh-6.5rem)] flex-col gap-6">
      <section className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-muted-foreground inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium">
            <MessageSquareText className="size-3.5" />
            Repository Q&A
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Ask clear questions, get focused answers
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            The conversation follows the repository selected in the sidebar and
            keeps separate history for each project.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={projectId ? "outline" : "secondary"}
            className="rounded-sm"
          >
            {project?.name ?? "No repository selected"}
          </Badge>
          <Badge variant="outline" className="rounded-sm">
            {statusLabel}
          </Badge>
        </div>
      </section>

      <div className="grid flex-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <section className="bg-background rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Mode</p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {activeMode.helper}
                </p>
              </div>
              <ModeIcon className="text-muted-foreground size-4" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {CHAT_MODE_ORDER.map((modeKey) => {
                const mode = CHAT_MODE_CONFIG[modeKey];
                const Icon = mode.icon;
                const isActive = safeChatMode === modeKey;

                return (
                  <Button
                    key={modeKey}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setChatMode(modeKey)}
                    className="h-9 justify-start rounded-md"
                  >
                    <Icon className="size-3.5" />
                    {mode.label}
                  </Button>
                );
              })}
            </div>
          </section>

          <section className="bg-background rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Saved answers</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {activeMemory.length}/{MAX_MEMORY_ITEMS} pinned
                </p>
              </div>
              <ClipboardList className="text-muted-foreground size-4" />
            </div>

            <div className="mt-4 space-y-2">
              {!projectId && (
                <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
                  Select a repository to view saved answers.
                </p>
              )}

              {projectId && activeMemory.length === 0 && (
                <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
                  Pin useful answers from the conversation.
                </p>
              )}

              {activeMemory.slice(0, 5).map((memoryItem) => (
                <div key={memoryItem.id} className="rounded-md border p-3">
                  <button
                    type="button"
                    onClick={() => insertMemoryIntoQuestion(memoryItem)}
                    className="block w-full text-left"
                  >
                    <p className="truncate text-sm font-medium">
                      {memoryItem.title}
                    </p>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
                      {memoryItem.content}
                    </p>
                  </button>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-[11px]">
                      {formatMessageTime(memoryItem.createdAt)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => removeMemoryItem(memoryItem.id)}
                    >
                      <X className="size-3.5" />
                      <span className="sr-only">Remove saved answer</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="bg-background flex min-h-[620px] flex-col overflow-hidden rounded-lg border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <div>
              <p className="text-sm font-semibold">Conversation</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {answerCount} answers for{" "}
                {project?.name ?? "the selected repository"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearCurrentConversation}
              disabled={!projectId || activeMessages.length === 0}
              className="rounded-md"
            >
              <Trash2 className="size-4" />
              Clear
            </Button>
          </div>

          <div
            ref={chatViewportRef}
            className="flex-1 overflow-y-auto p-4 sm:p-5"
          >
            <div className="space-y-4">
              {!projectId && (
                <div className="rounded-lg border border-dashed px-4 py-10 text-center">
                  <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-md border">
                    <Bot className="size-4" />
                  </div>
                  <p className="text-sm font-medium">
                    Select a repository to start
                  </p>
                  <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-6">
                    Q&A uses the selected repository context, commit summaries,
                    and saved answers.
                  </p>
                </div>
              )}

              {projectId && activeMessages.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ModeIcon className="size-4" />
                    Starter questions for {activeMode.label}
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {activeMode.quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => selectPrompt(prompt)}
                        className="bg-background hover:bg-muted rounded-md border px-3 py-2 text-left text-sm leading-5 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeMessages.map((message) => {
                const isUser = message.role === "user";
                const isError = message.state === "error";

                return (
                  <article
                    key={message.id}
                    className={cn(
                      "flex w-full",
                      isUser ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[min(92%,58rem)] rounded-lg border px-4 py-3",
                        isUser && "bg-foreground text-background",
                        !isUser && !isError && "bg-background",
                        isError && "border-destructive/30 bg-destructive/5",
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <p
                          className={cn(
                            "text-[11px] font-semibold tracking-wide uppercase",
                            isUser
                              ? "text-background/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {isUser ? "Question" : "Answer"}
                        </p>
                        <span
                          className={cn(
                            "text-[11px]",
                            isUser
                              ? "text-background/60"
                              : "text-muted-foreground",
                          )}
                        >
                          {formatMessageTime(message.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm leading-7 whitespace-pre-wrap">
                        {message.content}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {message.state === "streaming" && (
                          <Badge variant="outline" className="rounded-sm">
                            <Loader2 className="size-3 animate-spin" />
                            Writing
                          </Badge>
                        )}
                        {isError && (
                          <Badge variant="outline" className="rounded-sm">
                            <AlertCircle className="size-3" />
                            Error
                          </Badge>
                        )}
                        {!isUser && message.state === "done" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-md px-2 text-xs"
                            onClick={() => pinAssistantMessage(message)}
                          >
                            <Pin className="size-3.5" />
                            Save answer
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}

              {askRepoAi.isPending && (
                <article className="flex w-full justify-start">
                  <div className="bg-muted/25 rounded-lg border px-4 py-3">
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2 className="size-4 animate-spin" />
                      Generating answer
                    </div>
                  </div>
                </article>
              )}
            </div>
          </div>

          <div className="bg-background border-t p-3 sm:p-4">
            {feedback && (
              <div
                className={cn(
                  "mb-3 rounded-md border px-3 py-2 text-sm",
                  feedbackToneClass[feedback.tone],
                )}
              >
                <div className="flex items-start gap-2">
                  {feedback.tone === "loading" ? (
                    <Loader2 className="mt-0.5 size-4 animate-spin" />
                  ) : feedback.tone === "error" ? (
                    <AlertCircle className="mt-0.5 size-4" />
                  ) : (
                    <Check className="mt-0.5 size-4" />
                  )}
                  <div>
                    <p className="font-medium">{feedback.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                      {feedback.description}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-background focus-within:border-foreground rounded-lg border p-3">
              <Textarea
                ref={questionInputRef}
                placeholder={
                  projectId
                    ? `Ask in ${activeMode.label} mode...`
                    : "Select a repository before asking a question..."
                }
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleQuestionKeyDown}
                rows={3}
                disabled={!projectId}
                className="min-h-[86px] resize-none border-0 px-1 shadow-none focus-visible:ring-0"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="rounded-sm">
                    {activeMode.label}
                  </Badge>
                  <span>{activeMemory.length} saved answers available</span>
                </div>

                <Button
                  onClick={() => {
                    void handleSend();
                  }}
                  disabled={!canSend}
                  className="h-10 min-w-28 rounded-md"
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
        </section>
      </div>
    </div>
  );
};

export default QaPage;
