"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarDays,
  ExternalLink,
  GitCommitHorizontal,
  Github,
  Loader2,
  RefreshCcw,
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

const formatSummaryLines = (summary: string) =>
  summary
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, ""));

const DashboardPage = () => {
  const { project, projectId } = useProject();
  const [question, setQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");

  const commitsQuery = api.project.getCommits.useQuery(
    { projectId: projectId ?? null },
    { enabled: !!projectId },
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

  const commits = commitsQuery.data ?? [];
  const canSync = Boolean(projectId && project?.githubUrl);

  const handleSyncCommits = async () => {
    if (!projectId) {
      toast.error("Select a project first");
      return;
    }
    await syncCommits.mutateAsync({ projectId });
  };

  const handleAskAi = async () => {
    if (!projectId) {
      toast.error("Select a project first");
      return;
    }
    if (!question.trim()) {
      toast.error("Please enter a question for AI");
      return;
    }

    const { answer } = await askRepoAi.mutateAsync({
      projectId,
      question: question.trim(),
    });
    setAiAnswer(answer);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Github className="size-5" />
              Repository Connection
            </CardTitle>
            <CardDescription>
              Sync commit summaries and ask questions about this repository.
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              void handleSyncCommits();
            }}
            disabled={!canSync || syncCommits.isPending}
            className="shrink-0"
          >
            {syncCommits.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Syncing
              </>
            ) : (
              <>
                <RefreshCcw className="size-4" />
                Sync & Summarize
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            Ask AI About This Repo
          </CardTitle>
          <CardDescription>
            AI answers using your synced commit summaries and project context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Example: What changed recently in auth flow? Any risky changes?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={5}
          />
          <Button
            onClick={() => {
              void handleAskAi();
            }}
            disabled={!projectId || askRepoAi.isPending}
          >
            {askRepoAi.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Thinking
              </>
            ) : (
              "Ask AI"
            )}
          </Button>

          {aiAnswer && (
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{aiAnswer}</p>
            </div>
          )}
        </CardContent>
      </Card>

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
                    <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
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
