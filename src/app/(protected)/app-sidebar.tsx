"use client";

import { Button } from "@/components/ui/button";
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

import { cn } from "@/lib/utils";
import {
    Bot,
    CreditCard,
    LayoutDashboard,
    Plus,
    Presentation,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const items = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Q&A", url: "/qa", icon: Bot },
    { title: "Meetings", url: "/meetings", icon: Presentation },
    { title: "Billing", url: "/billing", icon: CreditCard },
];

const projects = [
    { id: "1", name: "Project 1" },
    { id: "2", name: "Project 2" },
    { id: "3", name: "Project 3" },
];

export function AppSidebar() {
    const pathname = usePathname();
    const [projectId, setProjectId] = useState<string | null>(null);

    const { open } = useSidebar();

    return (
        <Sidebar collapsible="icon" variant="floating">
            <SidebarHeader>
                <div className={cn("flex", "items-center", "gap-2")}>
                    <Image src="/logo1.png" alt="logo" width={40} height={40} />
                    {
                        open &&
                        <h1 className={cn("text-xl", "font-bold", "text-primary/80")}>
                            Dionysus
                        </h1>
                    }
                </div>
            </SidebarHeader>
            <SidebarContent>
                {/* -------- Application -------- */}
                <SidebarGroup>
                    <SidebarGroupLabel>Application</SidebarGroupLabel>

                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <Link
                                            href={item.url}
                                            className={cn({
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

                {/* -------- Projects -------- */}
                <SidebarGroup>
                    <SidebarGroupLabel>Your Projects</SidebarGroupLabel>

                    <SidebarGroupContent>
                        <SidebarMenu>
                            {projects.map((project) => (
                                <SidebarMenuItem key={project.id}>
                                    <SidebarMenuButton asChild>
                                        <div
                                            onClick={() => setProjectId(project.id)}
                                            className={cn('flex', 'items-center', 'gap-2', 'cursor-pointer')}
                                        >
                                            <div
                                                className={cn(
                                                    "rounded-sm border size-6 flex items-center justify-center text-sm bg-white text-primary",
                                                    {
                                                        "bg-primary text-white":
                                                            project.id === projectId,
                                                    }
                                                )}
                                            >
                                                {project.name[0]}
                                            </div>
                                            <span>{project.name}</span>
                                        </div>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}

                            { 
                                open &&
                            <SidebarMenuItem>
                                <Link href="/create">
                                    <Button variant="outline" className="w-fit">
                                        <Plus />
                                        Create Project
                                    </Button>
                                </Link>
                            </SidebarMenuItem>
                            }
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar >
    );
}