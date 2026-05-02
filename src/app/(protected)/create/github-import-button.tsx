"use client";

import { Github, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import useRefetch from "@/hooks/use-refetch";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

type GithubRepository =
  RouterOutputs["project"]["getGithubRepositories"][number];

interface GithubImportButtonProps {
  className?: string;
  onImported?: (projectId: string) => void;
}

const formatDate = (value: string | null) => {
  if (!value) return "No recent activity";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No recent activity";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

export function GithubImportButton({
  className,
  onImported,
}: GithubImportButtonProps) {
  const refetch = useRefetch();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedFullName, setSelectedFullName] = useState<string | null>(null);
  const githubStatus = api.project.getGithubImportStatus.useQuery(undefined, {
    staleTime: 60_000,
  });
  const repositories = api.project.getGithubRepositories.useQuery(undefined, {
    enabled: open && githubStatus.data?.hasGithubAuth === true,
    retry: false,
    staleTime: 30_000,
  });
  const importRepository = api.project.importGithubRepository.useMutation();

  const hasGithubAuth = githubStatus.data?.hasGithubAuth === true;
  const filteredRepositories = useMemo(() => {
    const query = search.trim().toLowerCase();
    const allRepositories = repositories.data ?? [];

    if (!query) {
      return allRepositories;
    }

    return allRepositories.filter((repository) => {
      const searchableText = [
        repository.fullName,
        repository.description,
        repository.language,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [repositories.data, search]);
  const selectedRepository = (repositories.data ?? []).find(
    (repository) => repository.fullName === selectedFullName,
  );

  if (githubStatus.isLoading || !hasGithubAuth) {
    return null;
  }

  function handleImport() {
    if (!selectedRepository || importRepository.isPending) return;

    importRepository.mutate(
      {
        fullName: selectedRepository.fullName,
      },
      {
        onSuccess: (result) => {
          toast.success(
            result.imported
              ? "Repository imported from GitHub"
              : "Repository already linked",
          );
          void refetch();
          setOpen(false);
          setSearch("");
          setSelectedFullName(null);
          onImported?.(result.project.id);
        },
        onError: (error) => {
          toast.error(error.message || "Failed to import repository");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("w-full", className)}
        >
          <Github className="size-4" />
          Import from GitHub
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from GitHub</DialogTitle>
          <DialogDescription>
            Select a repository from your GitHub account to link it with
            Dionysus.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search repositories"
            className="pl-9"
          />
        </div>

        <RepositoryList
          errorMessage={repositories.error?.message}
          isLoading={repositories.isLoading || repositories.isFetching}
          repositories={filteredRepositories}
          selectedFullName={selectedFullName}
          totalCount={repositories.data?.length ?? 0}
          onSelect={setSelectedFullName}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedRepository || importRepository.isPending}
            onClick={handleImport}
          >
            {importRepository.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <Github className="size-4" />
            )}
            Import repository
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepositoryList({
  errorMessage,
  isLoading,
  repositories,
  selectedFullName,
  totalCount,
  onSelect,
}: {
  errorMessage?: string;
  isLoading: boolean;
  repositories: GithubRepository[];
  selectedFullName: string | null;
  totalCount: number;
  onSelect: (fullName: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={`github-repo-loading-${index}`}
            className="rounded-md border p-3"
          >
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-3 h-3 w-4/5" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {errorMessage}
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center">
        <p className="text-sm font-medium">No repositories found</p>
        <p className="text-muted-foreground mt-1 text-sm">
          GitHub did not return any repositories for this account.
        </p>
      </div>
    );
  }

  if (repositories.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center">
        <p className="text-sm font-medium">No matching repositories</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Try a different repository name, language, or owner.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[360px] rounded-md border">
      <div className="divide-y">
        {repositories.map((repository) => {
          const isSelected = selectedFullName === repository.fullName;

          return (
            <button
              key={repository.id}
              type="button"
              onClick={() => {
                onSelect(repository.fullName);
              }}
              className={cn(
                "hover:bg-muted/70 w-full px-4 py-3 text-left transition-colors",
                isSelected && "bg-muted",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {repository.fullName}
                    </span>
                    {repository.isPrivate ? (
                      <Badge variant="outline" className="rounded-sm">
                        Private
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-sm">
                        Public
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                    {repository.description ?? "No description provided."}
                  </p>
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {repository.language ? (
                      <span>{repository.language}</span>
                    ) : null}
                    {repository.isFork ? <span>Fork</span> : null}
                    {repository.isArchived ? <span>Archived</span> : null}
                    <span>Updated {formatDate(repository.updatedAt)}</span>
                  </div>
                </div>
                <span
                  className={cn(
                    "mt-1 size-4 shrink-0 rounded-full border",
                    isSelected &&
                      "border-black bg-black shadow-[inset_0_0_0_4px_white]",
                  )}
                  aria-hidden="true"
                />
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
