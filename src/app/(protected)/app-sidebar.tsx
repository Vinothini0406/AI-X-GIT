"use client";

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
import {
  Bot,
  CreditCard,
  FolderGit2,
  LayoutDashboard,
  Plus,
  Presentation,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Q&A", url: "/qa", icon: Bot },
  { title: "Meetings", url: "/meetings", icon: Presentation },
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
  const { projects, isLoading, error, projectId, setProjectId } = useProject();
  const { open } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <div className={cn("flex", "items-center", "gap-2")}>
          <Image src="/logo1.png" alt="logo" width={40} height={40} />
          {open && (
            <h1 className={cn("text-xl", "font-bold", "text-primary/80")}>
              Dionysus
            </h1>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.url}
                      className={cn("transition-colors", {
                        "!bg-primary !text-white": pathname === item.url,
                      })}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>Your Projects</span>
            {open && <Badge variant="secondary">{projects.length}</Badge>}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading && (
                <>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <SidebarMenuItem key={`project-skeleton-${idx}`}>
                      <div className="flex items-center gap-2 rounded-lg border p-2">
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
                <SidebarMenuItem className="text-xs text-destructive">
                  Failed to load projects
                </SidebarMenuItem>
              )}

              {!isLoading && !error && projects.length === 0 && (
                <SidebarMenuItem>
                  <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    No projects yet. Create one to get started.
                  </div>
                </SidebarMenuItem>
              )}

              {projects.map((project) => {
                const isActive = project.id === projectId;
                return (
                  <SidebarMenuItem key={project.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectId(project.id);
                        if (pathname !== "/dashboard") {
                          router.push("/dashboard");
                        }
                      }}
                      className={cn(
                        "w-full rounded-xl border p-2 text-left transition-all duration-150",
                        "hover:border-primary/30 hover:bg-primary/5",
                        {
                          "border-primary/40 bg-primary/10 shadow-sm": isActive,
                          "border-border/60": !isActive,
                        },
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                            {
                              "border-primary bg-primary text-primary-foreground":
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
                            <div className="truncate text-xs text-muted-foreground">
                              {getProjectMeta(project.githubUrl)}
                            </div>
                          </div>
                        )}

                        {open && isActive && (
                          <Badge className="shrink-0" variant="default">
                            Active
                          </Badge>
                        )}
                        {!open && <FolderGit2 className="size-4" />}
                      </div>
                    </button>
                  </SidebarMenuItem>
                );
              })}

              {open && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/create">
                      <Button className="w-full justify-start" variant="outline">
                        <Plus className="mr-2 size-4" />
                        Create Project
                      </Button>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
