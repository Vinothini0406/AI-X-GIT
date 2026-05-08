"use client";

import { useUser } from "@clerk/nextjs";
import {
  Github,
  GitPullRequestArrow,
  Globe2,
  LockKeyhole,
  Search,
} from "lucide-react";
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
  const { isLoaded: isUserLoaded, user } = useUser();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [importingFullName, setImportingFullName] = useState<string | null>(
    null,
  );
  const hasGithubAuth =
    user?.externalAccounts.some((account) => {
      const provider = String(account.provider);
      return provider === "github" || account.providerSlug() === "github";
    }) ?? false;
  const repositories = api.project.getGithubRepositories.useQuery(undefined, {
    enabled: open && hasGithubAuth,
    retry: false,
    staleTime: 30_000,
  });
  const importRepository = api.project.importGithubRepository.useMutation();

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

  if (!isUserLoaded || !hasGithubAuth) {
    return null;
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setSearch("");
      setImportingFullName(null);
    }
  }

  function handleImport(repository: GithubRepository) {
    if (importRepository.isPending) return;

    setImportingFullName(repository.fullName);
    importRepository.mutate(
      {
        fullName: repository.fullName,
      },
      {
        onSuccess: (result) => {
          toast.success(
            result.imported
              ? "Repository imported from GitHub"
              : "Repository already linked",
          );
          void refetch();
          handleOpenChange(false);
          onImported?.(result.project.id);
        },
        onError: (error) => {
          toast.error(error.message || "Failed to import repository");
        },
        onSettled: () => {
          setImportingFullName(null);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("w-full", className)}
        >
          <Github className="size-4" />
          Import Project
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <Github className="size-5" />
            Import Project
          </DialogTitle>
          <DialogDescription>
            Choose one of your GitHub repositories to link it with Dionysus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-6">
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
            importingFullName={importingFullName}
            isImporting={importRepository.isPending}
            isLoading={repositories.isLoading || repositories.isFetching}
            repositories={filteredRepositories}
            totalCount={repositories.data?.length ?? 0}
            onImport={handleImport}
          />
        </div>

        <DialogFooter className="bg-muted/30 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              handleOpenChange(false);
            }}
            disabled={importRepository.isPending}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepositoryList({
  errorMessage,
  importingFullName,
  isImporting,
  isLoading,
  repositories,
  totalCount,
  onImport,
}: {
  errorMessage?: string;
  importingFullName: string | null;
  isImporting: boolean;
  isLoading: boolean;
  repositories: GithubRepository[];
  totalCount: number;
  onImport: (repository: GithubRepository) => void;
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
    <ScrollArea className="h-[420px] pr-3">
      <div className="space-y-3">
        {repositories.map((repository) => {
          const isCurrentImport = importingFullName === repository.fullName;

          return (
            <div
              key={repository.id}
              className={cn(
                "group bg-background rounded-md border p-4 shadow-xs transition-all duration-200",
                "hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-md",
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {repository.fullName}
                    </span>
                    {repository.isPrivate ? (
                      <Badge variant="outline" className="gap-1 rounded-sm">
                        <LockKeyhole className="size-3" />
                        Private
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 rounded-sm">
                        <Globe2 className="size-3" />
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
                <Button
                  type="button"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={isImporting}
                  onClick={() => {
                    onImport(repository);
                  }}
                >
                  {isCurrentImport ? (
                    <Spinner className="size-4" />
                  ) : (
                    <GitPullRequestArrow className="size-4" />
                  )}
                  Import
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
