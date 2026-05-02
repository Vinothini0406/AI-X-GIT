import { UserButton } from "@clerk/nextjs";
import React from "react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { AppSidebar } from "./app-sidebar";

interface Props {
  children: React.ReactNode;
}

const SidebarLayout = ({ children }: Props) => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="bg-background min-h-svh w-full">
        <header className="bg-background/95 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur-sm sm:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Workspace</p>
            <p className="text-muted-foreground truncate text-xs">
              Repository intelligence dashboard
            </p>
          </div>
          <div className="ml-auto flex items-center">
            <UserButton />
          </div>
        </header>

        <div className="h-[calc(100svh-3.5rem)] overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6">
            {children}
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default SidebarLayout;
