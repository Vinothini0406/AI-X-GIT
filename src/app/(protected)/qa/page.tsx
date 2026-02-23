"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Bot, Loader2, SendHorizontal, Sparkles, Trash2 } from "lucide-react";
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

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  state: MessageState;
  createdAt: number;
}

type ProjectConversationStore = Record<string, ChatMessage[]>;

const HISTORY_STORAGE_KEY = "dionysus-qa-history-v1";

const QUICK_PROMPTS = [
  "What changed in the latest commits?",
  "Any risky changes before release?",
  "Summarize backend related updates.",
  "What should we test first?",
];

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

const QaPage = () => {
  const { project, projectId } = useProject();
  const [question, setQuestion] = useState("");
  const [conversationByProject, setConversationByProject] =
    useLocalStorage<ProjectConversationStore>(HISTORY_STORAGE_KEY, {});
  const chatViewportRef = useRef<HTMLDivElement | null>(null);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const askRepoAi = api.project.askRepoAi.useMutation();

  const activeMessages = useMemo(() => {
    if (!projectId) {
      return [];
    }

    return conversationByProject[projectId] ?? [];
  }, [conversationByProject, projectId]);

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

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmedQuestion,
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
        question: trimmedQuestion,
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
    <section className="flex h-full flex-col bg-gradient-to-b from-background to-muted/20">
      <header className="border-b bg-background/85 px-4 py-4 backdrop-blur-sm md:px-6">
        <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Project Q&A</h1>
            <p className="text-sm text-muted-foreground">
              Chat with repository-aware AI using project-scoped commit context.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={projectId ? "default" : "secondary"}>
              {project?.name ?? "No project selected"}
            </Badge>
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

      <div ref={chatViewportRef} className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
        <div className="mx-auto flex w-full flex-col gap-4">
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
                  <Sparkles className="size-4 text-primary" />
                  Starter prompts for {project?.name}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {QUICK_PROMPTS.map((prompt) => (
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
                      : "border-border bg-background",
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
          <div className="rounded-2xl border bg-background p-3 shadow-sm">
            <Textarea
              placeholder={
                projectId
                  ? "Ask about commits, architecture, release risk, or recent changes..."
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
                  ? "Project-scoped mode: this chat only uses selected project data."
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
