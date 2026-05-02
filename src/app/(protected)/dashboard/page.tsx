"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  GitCommitHorizontal,
  Github,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  SendHorizontal,
  Sparkles,
  Trash2,
  UserCircle2,
  Users,
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
import { Skeleton } from "@/components/ui/skeleton";
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

const getCommitUrl = (
  githubUrl: string | null | undefined,
  commitHash: string,
) => {
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

const getRepositoryLabel = (githubUrl: string | null | undefined) => {
  if (!githubUrl) {
    return "No repository connected";
  }

  try {
    const { hostname, pathname } = new URL(githubUrl);
    return `${hostname}${pathname.replace(/\/+$/, "")}`;
  } catch {
    return githubUrl;
  }
};

const parseDate = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date)
    : "Not synced";

const formatDateTime = (value: Date | string) => {
  const parsed = parseDate(value);

  if (!parsed) {
    return String(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
};

const getRelativeAge = (date: Date | null) => {
  if (!date) {
    return "No sync yet";
  }

  const daysOld = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)),
  );

  if (daysOld === 0) return "Today";
  if (daysOld === 1) return "Yesterday";
  return `${daysOld} days ago`;
};

const normalizeAiText = (value: string) =>
  value
    .replace(/\r/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "");

const formatSummaryLines = (summary: string) =>
  normalizeAiText(summary)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s*/, ""));

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
  const syncAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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
      await Promise.all([
        commitsQuery.refetch(),
        projectDetailsQuery.refetch(),
      ]);
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
  const repositoryLabel = getRepositoryLabel(project?.githubUrl);
  const latestCommitDate = useMemo(() => {
    const latestCommit = commits[0] ?? projectDetailsQuery.data?.Commit[0];
    return parseDate(latestCommit?.commitDate);
  }, [commits, projectDetailsQuery.data?.Commit]);

  const setupSignals = [
    { label: "Repository", complete: Boolean(project?.githubUrl) },
    { label: "Summaries", complete: totalCommitCount > 0 },
    { label: "Q&A history", complete: totalQuestionCount > 0 },
    { label: "Team", complete: totalCollaboratorCount > 1 },
  ] as const;

  const completedSetupSignals = setupSignals.filter(
    (signal) => signal.complete,
  ).length;
  const readinessPercent = Math.round(
    (completedSetupSignals / setupSignals.length) * 100,
  );
  const isDetailsLoading = Boolean(projectId) && projectDetailsQuery.isLoading;
  const isCommitLoading = Boolean(projectId) && commitsQuery.isLoading;
  const loadedCommitContext = commits.length;
  const latestCommitAge = getRelativeAge(latestCommitDate);

  const repositoryInsights = useMemo(() => {
    const now = Date.now();
    const datedCommits = commits.flatMap((commit) => {
      const date = parseDate(commit.commitDate);
      if (!date) {
        return [];
      }

      return [
        {
          author: commit.commitAuthorName || "Unknown author",
          summaryReady:
            Boolean(commit.summary) &&
            !commit.summary.startsWith("Summary unavailable:"),
          date,
        },
      ];
    });

    const recentCommitCount = datedCommits.filter(
      (commit) => now - commit.date.getTime() <= 1000 * 60 * 60 * 24 * 7,
    ).length;

    const authorCounts = new Map<string, number>();
    for (const commit of datedCommits) {
      authorCounts.set(
        commit.author,
        (authorCounts.get(commit.author) ?? 0) + 1,
      );
    }

    const topAuthor =
      [...authorCounts.entries()].sort(
        (left, right) => right[1] - left[1],
      )[0]?.[0] ?? "No commits loaded";

    const summaryReadyCount = datedCommits.filter(
      (commit) => commit.summaryReady,
    ).length;
    const summaryCoverage =
      commits.length > 0
        ? Math.round((summaryReadyCount / commits.length) * 100)
        : 0;

    const dayFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
    });
    const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const commitsByDay = new Map<string, number>();

    for (const commit of datedCommits) {
      const key = dayKeyFormatter.format(commit.date);
      commitsByDay.set(key, (commitsByDay.get(key) ?? 0) + 1);
    }

    const activityBuckets = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const key = dayKeyFormatter.format(date);
      return {
        key,
        label: dayFormatter.format(date),
        count: commitsByDay.get(key) ?? 0,
      };
    });

    const maxBucketCount = Math.max(
      1,
      ...activityBuckets.map((bucket) => bucket.count),
    );

    const suggestedActions = [
      projectId && !project?.githubUrl
        ? "Connect a GitHub URL for this project."
        : null,
      projectId && commits.length === 0
        ? "Sync commit summaries to unlock repository insights."
        : null,
      projectId && commits.length > 0 && summaryCoverage < 80
        ? "Refresh summaries so AI has fuller context."
        : null,
      latestCommitDate &&
      now - latestCommitDate.getTime() > 1000 * 60 * 60 * 24 * 10
        ? "Refresh repository context; latest synced commit is stale."
        : null,
      projectId && commits.length > 0 && recentCommitCount > 0
        ? "Ask AI for release risk based on this week’s commits."
        : null,
    ].filter((action): action is string => Boolean(action));

    return {
      recentCommitCount,
      activeAuthorCount: authorCounts.size,
      topAuthor,
      summaryCoverage,
      activityBuckets,
      maxBucketCount,
      suggestedActions:
        suggestedActions.length > 0
          ? suggestedActions.slice(0, 3)
          : [
              "Repository context looks current. Keep syncing after meaningful changes.",
            ],
    };
  }, [commits, latestCommitDate, project?.githubUrl, projectId]);

  const attentionItems = [
    !projectId
      ? "Select a project from the sidebar to load repository data."
      : null,
    projectId && !project?.githubUrl
      ? "This project has no GitHub URL. Create or edit a project with a repository link."
      : null,
    projectId && project?.githubUrl && totalCommitCount === 0
      ? "No commit summaries are stored yet. Sync the repository to build AI context."
      : null,
    latestCommitDate &&
    Date.now() - latestCommitDate.getTime() > 1000 * 60 * 60 * 24 * 10
      ? "Last synced commit is older than 10 days. Refresh repository context."
      : null,
  ].filter((item): item is string => Boolean(item));

  const metrics = [
    {
      label: "Commit summaries",
      value: totalCommitCount,
      helper: `${loadedCommitContext} loaded in view`,
      icon: GitCommitHorizontal,
    },
    {
      label: "Saved Q&A",
      value: totalQuestionCount,
      helper: "Project knowledge base",
      icon: MessageSquareText,
    },
    {
      label: "Collaborators",
      value: totalCollaboratorCount,
      helper:
        totalCollaboratorCount === 1
          ? "1 member has access"
          : "Members with access",
      icon: Users,
    },
    {
      label: "Last sync",
      value: latestCommitAge,
      helper: formatDate(latestCommitDate),
      icon: Clock3,
      isText: true,
    },
  ] as const;

  useEffect(() => {
    setMessages([]);
    setQuestion("");
  }, [projectId]);

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

    try {
      await syncCommits.mutateAsync({ projectId });
    } catch {
      setIsSyncButtonAnimating(false);
    }
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
          content: normalizeAiText(answer).trim(),
        },
      ]);
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "assistant",
          content:
            "I could not generate an answer right now. Please try again.",
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

  const clearChat = () => {
    setMessages([]);
  };

  const canSendQuestion =
    Boolean(projectId && question.trim()) && !askRepoAi.isPending;

  const renderTypingBubble = () => (
    <div className="flex w-full justify-start">
      <div className="bg-muted max-w-[85%] rounded-lg border px-4 py-3">
        <div className="text-foreground flex items-center gap-2 text-xs font-medium">
          <Sparkles className="size-3.5" />
          AI is thinking
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="bg-foreground/50 size-1.5 rounded-full" />
          <span className="bg-foreground/50 size-1.5 rounded-full" />
          <span className="bg-foreground/50 size-1.5 rounded-full" />
        </div>
      </div>
    </div>
  );

  const renderMessageBubble = (message: ChatMessage) => {
    const isUser = message.role === "user";

    return (
      <div
        key={message.id}
        className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
      >
        <div
          className={cn(
            "max-w-[88%] rounded-lg border px-4 py-3 sm:max-w-[78%]",
            isUser ? "bg-foreground text-background" : "bg-background",
          )}
        >
          <p
            className={cn(
              "mb-1 text-[11px] font-semibold tracking-wide uppercase",
              isUser ? "text-background/75" : "text-muted-foreground",
            )}
          >
            {isUser ? "You" : "Repo AI"}
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  };

  const renderEmptyChat = () => (
    <div className="bg-muted/30 rounded-lg border border-dashed px-4 py-8 text-center">
      <div className="bg-background mx-auto mb-3 flex size-9 items-center justify-center rounded-md border">
        <Bot className="size-4" />
      </div>
      <p className="text-sm font-medium">Ask about the selected repository</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-5">
        Use the current project, synced commits, and repository metadata as
        context.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-muted-foreground inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium">
            <Github className="size-3.5" />
            Selected repository
          </div>
          <h1 className="mt-3 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {project?.name ?? "Select a project"}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl truncate text-sm">
            {projectId
              ? repositoryLabel
              : "Choose a repository from the sidebar to view live context."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {project?.githubUrl && (
            <Button asChild variant="outline" className="h-10 rounded-md">
              <Link href={project.githubUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Open repo
              </Link>
            </Button>
          )}
          <Button
            onClick={() => {
              void handleSyncCommits();
            }}
            disabled={!canSync || syncCommits.isPending}
            className={cn(
              "h-10 rounded-md transition-transform",
              isSyncButtonAnimating && "scale-[1.02]",
            )}
          >
            {syncCommits.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Syncing
              </>
            ) : (
              <>
                <RefreshCcw className="size-4" />
                Sync summaries
              </>
            )}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const MetricIcon = metric.icon;

          return (
            <div key={metric.label} className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm font-medium">
                  {metric.label}
                </p>
                <MetricIcon className="text-muted-foreground size-4" />
              </div>
              <div className="mt-3">
                {isDetailsLoading ||
                (metric.label === "Last sync" && isCommitLoading) ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p
                    className={cn(
                      "truncate font-semibold tracking-tight",
                      "isText" in metric && metric.isText
                        ? "text-2xl"
                        : "text-3xl",
                    )}
                  >
                    {metric.value}
                  </p>
                )}
                <p className="text-muted-foreground mt-1 truncate text-xs">
                  {metric.helper}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {attentionItems.length > 0 && (
        <section className="bg-muted/30 rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="size-4" />
            Needs attention
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {attentionItems.map((item) => (
              <div
                key={item}
                className="bg-background rounded-md border px-3 py-2 text-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <Card className="overflow-hidden rounded-lg py-0 shadow-none">
          <CardHeader className="border-b px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4" />
                  Repository chat
                </CardTitle>
                <CardDescription>
                  Answers update against the currently selected project context.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                disabled={messages.length === 0}
                className="h-8 rounded-md"
              >
                <Trash2 className="size-4" />
                Clear
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="bg-muted/25 text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-xs sm:px-5">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="bg-foreground size-2 shrink-0 rounded-full" />
                <span className="truncate">
                  {project?.name
                    ? `Context loaded for ${project.name}`
                    : "No project context loaded"}
                </span>
              </span>
              <Badge variant="outline" className="rounded-sm">
                {loadedCommitContext} commits in context
              </Badge>
            </div>

            <div
              ref={chatContainerRef}
              className="max-h-[420px] space-y-3 overflow-y-auto p-4 sm:max-h-[520px] sm:p-5"
            >
              {messages.length === 0
                ? renderEmptyChat()
                : messages.map((message) => renderMessageBubble(message))}
              {askRepoAi.isPending && renderTypingBubble()}
            </div>

            <div className="bg-background border-t p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Textarea
                  placeholder="Ask about recent changes, architecture, risks, or release readiness..."
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={handleQuestionKeyDown}
                  rows={3}
                  className="min-h-[76px] resize-none rounded-md sm:min-h-[52px]"
                />
                <Button
                  onClick={() => {
                    void handleAskAi();
                  }}
                  disabled={!canSendQuestion}
                  className="h-10 rounded-md sm:h-[52px] sm:px-5"
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
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-lg shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Github className="size-4" />
                Repository status
              </CardTitle>
              <CardDescription>
                Connection, freshness, and readiness at a glance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4 border-b pb-3">
                  <dt className="text-muted-foreground">Repository</dt>
                  <dd className="min-w-0 truncate text-right font-medium">
                    {repositoryLabel}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b pb-3">
                  <dt className="text-muted-foreground">Latest commit</dt>
                  <dd className="text-right font-medium">
                    {formatDate(latestCommitDate)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b pb-3">
                  <dt className="text-muted-foreground">Meetings</dt>
                  <dd className="font-medium">{totalMeetingCount}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-muted-foreground">Readiness</dt>
                  <dd className="font-medium">
                    {completedSetupSignals}/{setupSignals.length}
                  </dd>
                </div>
              </dl>

              <div>
                <Progress value={readinessPercent} className="h-2" />
                <div className="mt-3 grid gap-2">
                  {setupSignals.map((signal) => (
                    <div
                      key={signal.label}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {signal.label}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium">
                        {signal.complete && <Check className="size-3.5" />}
                        {signal.complete ? "Ready" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4" />
                Smart insights
              </CardTitle>
              <CardDescription>
                Lightweight analytics from the selected repository context.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                <div className="rounded-md border px-3 py-2">
                  <p className="text-muted-foreground text-xs">7-day commits</p>
                  <p className="mt-1 text-lg font-semibold">
                    {repositoryInsights.recentCommitCount}
                  </p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-muted-foreground text-xs">Authors</p>
                  <p className="mt-1 text-lg font-semibold">
                    {repositoryInsights.activeAuthorCount}
                  </p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-muted-foreground text-xs">AI coverage</p>
                  <p className="mt-1 text-lg font-semibold">
                    {repositoryInsights.summaryCoverage}%
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <BarChart3 className="size-4" />
                    Weekly activity
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    Top author: {repositoryInsights.topAuthor}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {repositoryInsights.activityBuckets.map((bucket) => (
                    <div key={bucket.key} className="space-y-2">
                      <div className="bg-muted/20 flex h-20 items-end rounded-md border px-1.5 py-1.5">
                        <div
                          className="bg-foreground w-full rounded-sm transition-all"
                          style={{
                            height: `${Math.max(
                              bucket.count === 0
                                ? 8
                                : (bucket.count /
                                    repositoryInsights.maxBucketCount) *
                                    100,
                              8,
                            )}%`,
                            opacity: bucket.count === 0 ? 0.18 : 1,
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground text-[11px]">
                          {bucket.label}
                        </p>
                        <p className="text-xs font-medium">{bucket.count}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Suggested next steps</p>
                {repositoryInsights.suggestedActions.map((action) => (
                  <div
                    key={action}
                    className="bg-muted/20 rounded-md border px-3 py-2 text-sm leading-5"
                  >
                    {action}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden rounded-lg py-0 shadow-none">
        <CardHeader className="border-b px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Commit summaries</CardTitle>
              <CardDescription>
                Latest synced commits for the selected repository.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                void commitsQuery.refetch();
              }}
              disabled={!projectId || commitsQuery.isFetching}
              className="h-9 rounded-md"
            >
              {commitsQuery.isFetching ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Refreshing
                </>
              ) : (
                <>
                  <RefreshCcw className="size-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!projectId && (
            <p className="text-muted-foreground px-4 py-6 text-sm sm:px-5">
              Select a project to view commits.
            </p>
          )}

          {projectId && commitsQuery.isLoading && (
            <div className="space-y-4 p-4 sm:p-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`commit-loading-${index}`}
                  className="space-y-3 border-b pb-4"
                >
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          )}

          {projectId && !commitsQuery.isLoading && commits.length === 0 && (
            <p className="text-muted-foreground px-4 py-6 text-sm sm:px-5">
              No commits found yet. Sync summaries to pull recent repository
              commits.
            </p>
          )}

          {commits.length > 0 && (
            <div className="divide-y">
              {commits.map((commit, index) => {
                const commitUrl = getCommitUrl(
                  project?.githubUrl,
                  commit.commitHash,
                );
                const summaryUnavailable = commit.summary.startsWith(
                  "Summary unavailable:",
                );
                const summaryLines = formatSummaryLines(commit.summary);

                return (
                  <article
                    key={commit.id}
                    className={cn(
                      "grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.35fr)]",
                      index === 0 && "bg-muted/25",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="bg-background mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border">
                          <GitCommitHorizontal className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm leading-5 font-semibold">
                            {commit.commitMessage}
                          </p>
                          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="size-3.5" />
                              {formatDateTime(commit.commitDate)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
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
                      </div>

                      <div className="bg-background mt-4 rounded-md border p-4">
                        <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
                          AI summary
                        </p>
                        {summaryUnavailable ? (
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            {commit.summary}
                          </p>
                        ) : summaryLines.length > 0 ? (
                          <ul className="space-y-2">
                            {summaryLines.map((line, lineIndex) => (
                              <li
                                key={`${commit.id}-${lineIndex}`}
                                className="flex items-start gap-2"
                              >
                                <span className="bg-foreground/60 mt-2 h-px w-3 shrink-0" />
                                <span className="text-sm leading-relaxed">
                                  {line}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            No summary available.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                      {index === 0 && (
                        <Badge variant="outline" className="rounded-sm">
                          Latest
                        </Badge>
                      )}
                      {commitUrl ? (
                        <Badge
                          asChild
                          variant="outline"
                          className="rounded-sm font-mono"
                        >
                          <Link
                            href={commitUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {commit.commitHash.slice(0, 8)}
                            <ExternalLink className="size-3" />
                          </Link>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="rounded-sm font-mono"
                        >
                          {commit.commitHash.slice(0, 8)}
                        </Badge>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
