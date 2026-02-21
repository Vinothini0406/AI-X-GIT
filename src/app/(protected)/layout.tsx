import { SidebarProvider } from '@/components/ui/sidebar'
import { UserButton } from '@clerk/nextjs'
import React from 'react'
// import { AppSidebar } from './app-sidebar'
import { cn } from "../../lib/utils";
import { AppSidebar } from './app-sidebar';
type Props = {
    children: React.ReactNode
}

const SidebarLayout = ({ children }: Props) => {
    return (

        <SidebarProvider>
            <AppSidebar />
            <main className={cn('w-full', 'm-2')}>
                <div className={cn('flex', 'items-center', 'gap-2', 'border-sidebar-border', 'bg-sidebar', 'border', 'shadow', 'rounded-md', 'p-3', 'px-4')}>
                    <div className="ml-auto"></div>
                    <UserButton />
                </div>

                <div className="h-4"></div>

                <div className={cn('border-sidebar-border', 'bg-sidebar', 'border', 'shadow', 'rounded-md', 'overflow-y-scroll', 'h-[calc(100vh-120px)]')}>
                    {children}
                </div>
            </main >
        </SidebarProvider >
    )
}

export default SidebarLayout