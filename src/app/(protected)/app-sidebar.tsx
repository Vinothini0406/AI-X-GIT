"use client";

import { useUser } from "@clerk/nextjs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import useProject from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { Bot, CreditCard, LayoutDashboard, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { GithubImportButton } from "./create/github-import-button";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Q&A", url: "/qa", icon: Bot },
  { title: "Billing", url: "/billing", icon: CreditCard },
];

const getProjectMeta = (githubUrl?: string | null) => {
  if (!githubUrl) return "Private repository";

  try {
    const { hostname, pathname } = new URL(githubUrl);
    return `${hostname}${pathname}`;
  } catch {
    return githubUrl;
  }
};

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { projects, isLoading, error, project, projectId, setProjectId } =
    useProject();
  const { open } = useSidebar();
  const utils = api.useUtils();
  const deleteProject = api.project.deleteProject.useMutation({
    onSuccess: async (deletedProject) => {
      toast.success(`Deleted ${deletedProject.name}`);
      setProjectId(null);
      await Promise.all([
        utils.project.getProjects.invalidate(),
        utils.project.getProjectDetails.invalidate(),
        utils.project.getCommits.invalidate(),
      ]);
      router.push("/dashboard");
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || "Failed to delete project");
    },
  });
  const hasGithubAuth =
    user?.externalAccounts.some((account) => {
      const provider = String(account.provider);
      return provider === "github" || account.providerSlug() === "github";
    }) ?? false;

  const handleImported = (importedProjectId: string) => {
    setProjectId(importedProjectId);
    router.push("/dashboard");
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b px-3 py-3">
        <Link href="/dashboard" className="flex h-10 items-center gap-2">
          <div className="bg-foreground text-background flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold">
            D
          </div>
          {open && (
            <div className="min-w-0">
              <h1 className="truncate text-sm leading-5 font-semibold">
                Dionysus
              </h1>
              <p className="text-muted-foreground truncate text-xs">
                Repository AI
              </p>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-4 px-1 py-2">
        <SidebarGroup className="px-2">
          <SidebarGroupLabel className="h-7 px-2 text-[11px] font-semibold tracking-wide uppercase">
            Navigate
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className={cn(
                      "h-9 rounded-md",
                      pathname === item.url &&
                        "bg-foreground text-background hover:bg-foreground hover:text-background",
                    )}
                  >
                    <Link href={item.url} className="transition-colors">
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-2">
          <SidebarGroupLabel className="flex h-7 items-center justify-between px-2 text-[11px] font-semibold tracking-wide uppercase">
            <span>Your Projects</span>
            {open && (
              <Badge
                variant="outline"
                className="h-5 rounded-sm px-1.5 text-[10px]"
              >
                {projects.length}
              </Badge>
            )}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {isLoading && (
                <>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <SidebarMenuItem
                      key={`project-skeleton-${idx}`}
                      className="py-0.5"
                    >
                      <div className="flex items-center gap-2 rounded-md border p-2">
                        <Skeleton className="size-8 rounded-md" />
                        {open && (
                          <div className="w-full space-y-1">
                            <Skeleton className="h-3 w-2/3" />
                            <Skeleton className="h-2.5 w-1/2" />
                          </div>
                        )}
                      </div>
                    </SidebarMenuItem>
                  ))}
                </>
              )}

              {error && (
                <SidebarMenuItem className="text-destructive py-1 text-xs">
                  Failed to load projects
                </SidebarMenuItem>
              )}

              {!isLoading && !error && projects.length === 0 && (
                <SidebarMenuItem className="py-0.5">
                  <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                    No projects yet. Create one to get started.
                  </div>
                </SidebarMenuItem>
              )}

              {projects.map((project) => {
                const isActive = project.id === projectId;
                return (
                  <SidebarMenuItem key={project.id} className="py-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setProjectId(project.id);
                      }}
                      className={cn(
                        "w-full rounded-md border border-transparent px-2.5 py-2 text-left transition-colors",
                        "hover:border-border hover:bg-muted",
                        {
                          "border-border bg-muted": isActive,
                        },
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                            {
                              "border-foreground bg-foreground text-background":
                                isActive,
                              "border-border bg-background text-muted-foreground":
                                !isActive,
                            },
                          )}
                        >
                          {project.name.slice(0, 1).toUpperCase()}
                        </div>

                        {open && (
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {project.name}
                            </div>
                            <div className="text-muted-foreground truncate text-xs">
                              {getProjectMeta(project.githubUrl)}
                            </div>
                          </div>
                        )}

                        {open && isActive && (
                          <Badge
                            className="h-5 shrink-0 rounded-sm px-1.5 text-[10px]"
                            variant="outline"
                          >
                            Selected
                          </Badge>
                        )}
                      </div>
                    </button>
                  </SidebarMenuItem>
                );
              })}

              {open && (
                <SidebarMenuItem className="pt-1">
                  <div className="grid grid-cols-1 gap-2">
                    <SidebarMenuButton asChild>
                      <Link
                        href="/create"
                        className="bg-background hover:bg-muted h-9 min-w-0 justify-center rounded-md border px-2 text-sm font-medium"
                      >
                        <Plus className="size-4" />
                        <span>Create Project</span>
                      </Link>
                    </SidebarMenuButton>
                    {hasGithubAuth ? (
                      <GithubImportButton
                        className="h-9 min-w-0 px-2 text-sm"
                        onImported={handleImported}
                      />
                    ) : null}
                    {project ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="destructive"
                            className="h-9 w-full px-2 text-sm"
                            disabled={deleteProject.isPending}
                          >
                            <Trash2 className="size-4" />
                            Delete Project
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete project?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete{" "}
                              <span className="text-foreground font-medium">
                                {project.name}
                              </span>{" "}
                              and its commits, meetings, issues, and questions
                              from Prisma. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel
                              disabled={deleteProject.isPending}
                            >
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              disabled={deleteProject.isPending}
                              onClick={() => {
                                deleteProject.mutate({
                                  projectId: project.id,
                                });
                              }}
                            >
                              Delete Project
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
