"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import useProject from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import {
  CalendarClock,
  FolderGit2,
  GitCommitHorizontal,
  Link as LinkIcon,
  MessageCircleQuestion,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);

const MetricCard = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardDescription>{label}</CardDescription>
      <CardTitle className="flex items-center gap-2 text-2xl">
        {value}
        <Icon className="size-4 text-muted-foreground" />
      </CardTitle>
    </CardHeader>
  </Card>
);

const DashboardLoading = () => (
  <div className="space-y-4 p-6">
    <Skeleton className="h-8 w-72" />
    <Skeleton className="h-4 w-40" />
    <div className="grid gap-3 md:grid-cols-3">
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
    <Skeleton className="h-48" />
  </div>
);

export default function DashBoardPage() {
  const { projectId, project, isLoading: projectsLoading } = useProject();
  const { data: projectDetails, isLoading, error } =
    api.project.getProjectDetails.useQuery(
      { projectId: projectId ?? "" },
      { enabled: Boolean(projectId) },
    );
  const documentation = projectDetails?.documentation?.trim();
  const mermaidGraph = projectDetails?.mermaidGraph?.trim();

  if (projectsLoading) {
    return <DashboardLoading />;
  }

  if (!projectId || !project) {
    return (
      <div className="p-6">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Select a project</CardTitle>
            <CardDescription>
              Choose a project from the sidebar to see full details here.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <DashboardLoading />;
  }

  if (error || !projectDetails) {
    return (
      <div className="p-6">
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">
              Unable to load project details
            </CardTitle>
            <CardDescription>
              Please reselect the project from sidebar and try again.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="overflow-hidden border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-2xl">{projectDetails.name}</CardTitle>
            <Badge variant="secondary">
              <FolderGit2 className="mr-1 size-3" />
              Active Project
            </Badge>
          </div>
          <CardDescription className="mt-1 flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              Created {formatDate(projectDetails.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              Updated {formatDate(projectDetails.updatedAt)}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Project ID
            </div>
            <p className="truncate text-sm font-medium">{projectDetails.id}</p>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Repository
            </div>
            {projectDetails.githubUrl ? (
              <Link
                href={projectDetails.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                <LinkIcon className="size-4" />
                {projectDetails.githubUrl}
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">Not connected</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Team Members"
          value={projectDetails._count.User}
          icon={Users}
        />
        <MetricCard
          label="Commits"
          value={projectDetails._count.Commit}
          icon={GitCommitHorizontal}
        />
        <MetricCard
          label="Meetings"
          value={projectDetails._count.Meeting}
          icon={Video}
        />
        <MetricCard
          label="Q&A"
          value={projectDetails._count.Question}
          icon={MessageCircleQuestion}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
            <CardDescription>
              Project knowledge and generated documentation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {documentation && documentation.length > 0
                ? documentation
                : "No documentation available yet."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mermaid Graph</CardTitle>
            <CardDescription>Architecture graph source for this project.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre
              className={cn(
                "max-h-64 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs leading-5",
              )}
            >
              {mermaidGraph && mermaidGraph.length > 0
                ? mermaidGraph
                : "No mermaid graph generated yet."}
            </pre>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Commits</CardTitle>
            <CardDescription>Latest commit activity in this project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {projectDetails.Commit.length === 0 && (
              <p className="text-sm text-muted-foreground">No commits available.</p>
            )}
            {projectDetails.Commit.map((commit) => (
              <div key={commit.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{commit.commitMessage}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {commit.commitHash.slice(0, 10)} • {formatDate(commit.commitDate)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Meetings</CardTitle>
            <CardDescription>
              Most recent meetings linked to this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {projectDetails.Meeting.length === 0 && (
              <p className="text-sm text-muted-foreground">No meetings available.</p>
            )}
            {projectDetails.Meeting.map((meeting) => (
              <div key={meeting.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{meeting.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(meeting.createdAt)}
                </p>
                {meeting.url && (
                  <Link
                    className="mt-2 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
                    href={meeting.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open meeting link
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
