"use client";

import { api } from "@/trpc/react";
import { useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";

const useProject = () => {
    const { data: projects, isLoading, error } = api.project.getProjects.useQuery();

    const [projectId, setProjectId] = useLocalStorage<string | null>(
        "dionysus-projectId",
        null
    );

    useEffect(() => {
        if (isLoading) return;

        const allProjects = projects ?? [];
        if (allProjects.length === 0) {
            if (projectId !== null) {
                setProjectId(null);
            }
            return;
        }

        const selectedExists = allProjects.some((project) => project.id === projectId);
        if (!selectedExists) {
            const firstProject = allProjects[0];
            if (firstProject) {
                setProjectId(firstProject.id);
            }
        }
    }, [projects, isLoading, projectId, setProjectId]);

    const project = projects?.find((project) => project.id === projectId);

    return {
        projects: projects ?? [],
        isLoading,
        error,
        project,
        projectId,
        setProjectId,
    };
};

export default useProject;
