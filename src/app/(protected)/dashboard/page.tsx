"use client";

import useProject from "@/hooks/use-project";
import { cn } from "../../../lib/utils";

export default function DashBoardPage() {
  const { project } = useProject();

  return (
    <div className="p-6">
      <h1 className={cn('text-2xl', 'font-semibold')}>
        {project ? project.name : "Select a project"}
      </h1>
    </div>
  );
}