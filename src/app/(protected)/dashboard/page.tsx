"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Circle,
  ExternalLink,
  GitCommitHorizontal,
  Github,
  Loader2,
  RefreshCcw,
  SendHorizontal,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import useProject from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

const getCommitUrl = (githubUrl: string | null | undefined, commitHash: string) => {
  if (!githubUrl) {
    return null;
  }

  try {
    const normalized = githubUrl.replace(/\.git$/, "").replace(/\/+$/, "");
    return `${normalized}/commit/${commitHash}`;
  } catch {
    return null;
  }
};

const normalizeAiText = (value: string) =>
  value
    .replace(/\r/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ");

const formatSummaryLines = (summary: string) =>
  normalizeAiText(summary)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, ""));

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const createMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const DashboardPage = () => {
  const { project, projectId } = useProject();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSyncButtonAnimating, setIsSyncButtonAnimating] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const syncAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitsQuery = api.project.getCommits.useQuery(
    { projectId: projectId ?? null },
    { enabled: !!projectId },
  );
  const projectDetailsQuery = api.project.getProjectDetails.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );

  const syncCommits = api.project.syncCommits.useMutation({
    onSuccess: async ({ inserted }) => {
      toast.success(
        inserted > 0
          ? `Synced ${inserted} commit${inserted > 1 ? "s" : ""}`
          : "No new commits to sync",
      );
      await commitsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to sync commits");
    },
  });

  const askRepoAi = api.project.askRepoAi.useMutation({
    onError: (error) => {
      toast.error(error.message || "Failed to ask repository AI");
    },
  });

  const commits = useMemo(() => commitsQuery.data ?? [], [commitsQuery.data]);
  const canSync = Boolean(projectId && project?.githubUrl);

  const projectCounts = projectDetailsQuery.data?._count;
  const totalCommitCount = projectCounts?.Commit ?? 0;
  const totalQuestionCount = projectCounts?.Question ?? 0;
  const totalMeetingCount = projectCounts?.Meeting ?? 0;
  const totalCollaboratorCount = projectCounts?.User ?? 0;

  const latestCommitDate = useMemo(() => {
    if (!commits[0]) {
      return null;
    }

    const parsed = new Date(commits[0].commitDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [commits]);

  const healthScore = useMemo(() => {
    if (!projectId) {
      return 0;
    }

    const commitScore = Math.min(40, Math.round((totalCommitCount / 30) * 40));
    const qaScore = Math.min(30, Math.round((totalQuestionCount / 20) * 30));
    const collaborationScore = Math.min(15, Math.round((totalCollaboratorCount / 5) * 15));
    const meetingScore = Math.min(10, Math.round((totalMeetingCount / 5) * 10));

    const freshnessScore = (() => {
      if (!latestCommitDate) {
        return 0;
      }

      const daysOld = Math.floor((Date.now() - latestCommitDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOld <= 3) return 5;
      if (daysOld <= 10) return 3;
      return 1;
    })();

    return Math.max(
      0,
      Math.min(100, commitScore + qaScore + collaborationScore + meetingScore + freshnessScore),
    );
  }, [
    latestCommitDate,
    projectId,
    totalCollaboratorCount,
    totalCommitCount,
    totalMeetingCount,
    totalQuestionCount,
  ]);

  const checklistItems = [
    {
      id: "repo",
      title: "Connect repository",
      done: Boolean(project?.githubUrl),
      hint: "Link a GitHub URL during project setup.",
    },
    {
      id: "sync",
      title: "Sync commit summaries",
      done: totalCommitCount > 0,
      hint: "Use Sync & Summarize to pull latest commits.",
    },
    {
      id: "qa",
      title: "Ask first AI question",
      done: totalQuestionCount > 0,
      hint: "Use the repo chat panel to create initial context.",
    },
    {
      id: "team",
      title: "Add at least one collaborator",
      done: totalCollaboratorCount > 1,
      hint: "Invite a teammate so project context is shared.",
    },
  ] as const;

  const completedChecklistCount = checklistItems.filter((item) => item.done).length;
  const checklistPercent = Math.round((completedChecklistCount / checklistItems.length) * 100);
  const activityAlerts = [
    !project?.githubUrl ? "Repository URL is missing for this project." : null,
    totalCommitCount === 0 ? "No commit summaries yet. Sync to improve AI answers." : null,
    latestCommitDate &&
    Date.now() - latestCommitDate.getTime() > 1000 * 60 * 60 * 24 * 10
      ? "Last synced commit is older than 10 days. Refresh repository context."
      : null,
    totalQuestionCount === 0 ? "No AI Q&A history yet. Ask one question to seed project memory." : null,
  ].filter((alert): alert is string => Boolean(alert));

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "auto",
    });
  }, [messages, askRepoAi.isPending]);

  useEffect(() => {
    return () => {
      if (syncAnimationTimeoutRef.current) {
        clearTimeout(syncAnimationTimeoutRef.current);
      }
    };
  }, []);

  const handleSyncCommits = async () => {
    if (!projectId) {
      toast.error("Select a project first");
      return;
    }

    setIsSyncButtonAnimating(true);
    if (syncAnimationTimeoutRef.current) {
      clearTimeout(syncAnimationTimeoutRef.current);
    }
    syncAnimationTimeoutRef.current = setTimeout(() => {
      setIsSyncButtonAnimating(false);
    }, 650);

    await syncCommits.mutateAsync({ projectId });
  };

  const handleAskAi = async () => {
    if (!projectId) {
      toast.error("Select a project first");
      return;
    }

    const userQuestion = question.trim();
    if (!userQuestion) {
      toast.error("Please enter a question for AI");
      return;
    }

    setMessages((previous) => [
      ...previous,
      {
        id: createMessageId(),
        role: "user",
        content: userQuestion,
      },
    ]);
    setQuestion("");

    try {
      const { answer } = await askRepoAi.mutateAsync({
        projectId,
        question: userQuestion,
      });

      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "assistant",
          content: normalizeAiText(answer),
        },
      ]);
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "assistant",
          content: "I could not generate an answer right now. Please try again.",
        },
      ]);
    }
  };

  const handleQuestionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleAskAi();
    }
  };

  const isChatEmpty = messages.length === 0;

  const renderTypingBubble = () => (
      <div className="flex w-full justify-start">
        <div className="max-w-[85%] rounded-2xl border bg-background px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            AI is thinking
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-muted-foreground/70" />
            <span className="size-1.5 rounded-full bg-muted-foreground/70" />
            <span className="size-1.5 rounded-full bg-muted-foreground/70" />
          </div>
        </div>
      </div>
  );

  const renderMessageBubble = (message: ChatMessage) => {
    const isUser = message.role === "user";

    return (
      <div
        key={message.id}
        className={cn(
          "flex w-full",
          isUser ? "justify-end" : "justify-start",
        )}
      >
        <div
          className={cn(
            "max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm sm:max-w-[78%]",
            isUser
              ? "border-primary/40 bg-primary text-primary-foreground"
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
        </div>
      </div>
    );
  };

  const renderEmptyChat = () => (
    <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-center">
      <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="size-4 text-primary" />
      </div>
      <p className="text-sm font-medium">Start a repo conversation</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Ask about architecture, risks, recent changes, or commit impact.
      </p>
    </div>
  );

  const clearChat = () => {
    setMessages([]);
  };

  const canSendQuestion = Boolean(projectId && question.trim()) && !askRepoAi.isPending;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-5 text-primary" />
                Project Health
              </CardTitle>
              <Badge variant="outline">{healthScore}/100</Badge>
            </div>
            <CardDescription>
              Health score combines commit flow, Q&A activity, collaboration, and freshness.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={healthScore} className="h-2.5" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Commits</p>
                <p className="mt-1 text-lg font-semibold">{totalCommitCount}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">AI Questions</p>
                <p className="mt-1 text-lg font-semibold">{totalQuestionCount}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Collaborators</p>
                <p className="mt-1 text-lg font-semibold">{totalCollaboratorCount}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Last Synced Commit
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {latestCommitDate ? latestCommitDate.toLocaleDateString() : "Not synced yet"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activation Checklist</CardTitle>
            <CardDescription>
              Complete these to improve answer quality and team adoption.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Completion</span>
              <span>
                {completedChecklistCount}/{checklistItems.length}
              </span>
            </div>
            <Progress value={checklistPercent} className="h-2.5" />
            <div className="space-y-2">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-lg border p-3",
                    item.done ? "border-emerald-300/70 bg-emerald-50/50" : "bg-muted/15",
                  )}
                >
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {item.done ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                    {item.title}
                  </p>
                  {!item.done && <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {activityAlerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-700" />
              Attention Needed
            </CardTitle>
            <CardDescription>These issues may reduce AI response quality.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {activityAlerts.map((alert) => (
              <div key={alert} className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-sm">
                {alert}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 via-background to-background pt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5" />
                  Ask AI About This Repo
                </CardTitle>
                <CardDescription>
                  Chat with repository-aware AI using commit summaries and project context.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                disabled={messages.length === 0}
                className="transition-colors hover:bg-black hover:text-white"
              >
                Clear Chat
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-b bg-muted/10 px-4 py-2 text-xs text-muted-foreground">
              {project?.name ? (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="size-3.5 text-primary" />
                  Context loaded for project: <strong className="font-medium">{project.name}</strong>
                </span>
              ) : (
                <span>Select a project to enable repo chat context.</span>
              )}
            </div>

            <div
              ref={chatContainerRef}
              className="max-h-[380px] space-y-3 overflow-y-auto p-4 sm:max-h-[460px]"
            >
              {isChatEmpty ? renderEmptyChat() : messages.map((message) => renderMessageBubble(message))}
              {askRepoAi.isPending && renderTypingBubble()}
            </div>

            <div className="border-t bg-background/90 p-3 backdrop-blur-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Textarea
                  placeholder="Ask about architecture, latest changes, risks, or release readiness..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleQuestionKeyDown}
                  rows={3}
                  className="min-h-[72px] resize-none sm:min-h-[52px]"
                />
                <Button
                  onClick={() => {
                    void handleAskAi();
                  }}
                  disabled={!canSendQuestion}
                  className="sm:h-[52px] sm:px-5"
                >
                  {askRepoAi.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Thinking
                    </>
                  ) : (
                    <>
                      <SendHorizontal className="size-4" />
                      Send
                    </>
                  )}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Press Enter to send. Use Shift + Enter for a new line.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="space-y-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Github className="size-5" />
                Repository Connection
              </CardTitle>
              <CardDescription>
                Sync commit summaries and keep AI context up to date.
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                void handleSyncCommits();
              }}
              disabled={!canSync || syncCommits.isPending}
              className={cn(
                "group relative h-11 w-full overflow-hidden text-sm font-semibold transition-all duration-300 ease-out",
                isSyncButtonAnimating && "scale-[1.02] ring-2 ring-primary/35 shadow-lg shadow-primary/20",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none absolute inset-0 bg-primary/10 opacity-0 transition-opacity duration-300",
                  isSyncButtonAnimating && "animate-pulse opacity-100",
                )}
              />
              <span className="relative z-10 inline-flex items-center gap-2">
                {syncCommits.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Syncing
                  </>
                ) : (
                  <>
                    <RefreshCcw
                      className={cn("size-4 transition-transform duration-300", isSyncButtonAnimating && "rotate-180")}
                    />
                    Sync & Summarize
                  </>
                )}
              </span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 border-t bg-muted/10 pt-5">
            <p className={cn("text-sm", "font-medium")}>
              {project?.githubUrl ? (
                <>
                  Connected to{" "}
                  <Link
                    href={project.githubUrl}
                    className={cn(
                      "inline-flex",
                      "items-center",
                      "gap-1",
                      "text-primary",
                      "hover:underline",
                    )}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {project.githubUrl}
                    <ExternalLink className="size-4" />
                  </Link>
                </>
              ) : (
                <span className="text-muted-foreground">
                  No repository linked. Create a project with a GitHub URL first.
                </span>
              )}
            </p>
            <div className="rounded-lg border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
              Use sync before asking AI to include the latest commit summaries.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Commit Summaries</CardTitle>
            <CardDescription>
              Latest repository commits with AI-generated summaries.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void commitsQuery.refetch();
            }}
            disabled={commitsQuery.isFetching}
          >
            {commitsQuery.isFetching ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Refreshing
              </>
            ) : (
              "Refresh"
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {!projectId && (
            <p className="text-sm text-muted-foreground">Select a project to view commits.</p>
          )}

          {projectId && commitsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading commit summaries...</p>
          )}

          {projectId && !commitsQuery.isLoading && commits.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No commits found yet. Click &quot;Sync &amp; Summarize&quot; to pull commits from
              GitHub.
            </p>
          )}

          <div className="space-y-4">
            {commits.map((commit, index) => {
              const date = new Date(commit.commitDate);
              const formattedDate = Number.isNaN(date.getTime())
                ? String(commit.commitDate)
                : date.toLocaleString();
              const commitUrl = getCommitUrl(project?.githubUrl, commit.commitHash);
              const summaryUnavailable = commit.summary.startsWith("Summary unavailable:");
              const summaryLines = formatSummaryLines(commit.summary);

              return (
                <article
                  key={commit.id}
                  className={cn(
                    "rounded-xl border bg-muted/10 p-5 shadow-xs",
                    index === 0 && "border-primary/30 bg-primary/5",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <GitCommitHorizontal className="size-4 text-primary" />
                        <p className="line-clamp-2 text-sm font-semibold leading-5">
                          {commit.commitMessage}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3.5" />
                          {formattedDate}
                        </span>

                        <span className="inline-flex items-center gap-1">
                          {commit.commitAuthorAvatar ? (
                            <Avatar size="sm" className="size-5">
                              <AvatarImage
                                src={commit.commitAuthorAvatar}
                                alt={commit.commitAuthorName}
                              />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(commit.commitAuthorName)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <UserCircle2 className="size-4" />
                          )}
                          {commit.commitAuthorName || "Unknown author"}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {commitUrl ? (
                        <Link href={commitUrl} target="_blank" rel="noreferrer">
                          <Badge variant="outline" className="font-mono">
                            {commit.commitHash.slice(0, 8)}
                            <ExternalLink className="size-3" />
                          </Badge>
                        </Link>
                      ) : (
                        <Badge variant="outline" className="font-mono">
                          {commit.commitHash.slice(0, 8)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border bg-background/80 p-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      AI Summary
                    </p>

                    {summaryUnavailable ? (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {commit.summary}
                      </p>
                    ) : (
                      <>
                        {summaryLines.length > 0 ? (
                          <ul className="space-y-2">
                            {summaryLines.map((line, lineIndex) => (
                              <li
                                key={`${commit.id}-${lineIndex}`}
                                className="flex items-start gap-2"
                              >
                                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" />
                                <span className="text-sm leading-relaxed">{line}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            No summary available.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
