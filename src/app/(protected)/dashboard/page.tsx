"use client";

import Link from "next/link";
import React from "react";
import { ExternalLink, Github } from "lucide-react";

import useProject from "@/hooks/use-project";
import { cn } from "@/lib/utils";

const DashboardPage = () => {
  const { project } = useProject();

  return (
    <div>
      {project?.id}
      <div className={cn("flex", "items-center", "justify-between", "flex-wrap", "gap-y-4")}>

        {/* Github link */}
        <div className={cn("m-3", "w-fit", "rounded-md", "bg-black", "px-4", "py-3")}>
          <div className={cn('flex', 'items-center')}>

            <Github className={cn("size-5", "text-white")} />
            <div className="ml-2">
              <p className={cn("text-sm", "font-medium", "text-white")}>
                This project is linked to{" "}
                {project?.githubUrl ? (
                  <Link
                    href={project.githubUrl}
                    className={cn("inline-flex", "items-center", "text-white/80", "hover:underline")}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {project.githubUrl}
                    <ExternalLink className={cn("ml-1", "size-4")} />
                  </Link>
                ) : (
                  <span className={cn("text-white/80")}>No repository linked</span>
                )}
              </p>
            </div>
          </div>
        </div >


        <div className="h-4"></div>


        <div className={cn('flex', 'items-center', 'gap-4')}>
          Team Member
          Invite Button
          Archive Button
        </div>
      </div>


      <div className="mt-4">
        <div className={cn('grid', 'gird-cols-1', 'gap-4', 'sm:grid-cols-5')}>
          AskQuestionCard
          MeetIngCard
        </div>
      </div>


      <div className="mt-8">
        Commit-log
      </div>
    </div >
  );
};

export default DashboardPage;
