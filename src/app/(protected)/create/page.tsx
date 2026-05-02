"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useLocalStorage } from "usehooks-ts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useRefetch from "@/hooks/use-refetch";
import { api } from "@/trpc/react";

import { cn } from "../../../lib/utils";
import { GithubImportButton } from "./github-import-button";

interface FormInput {
  repoUrl: string;
  projectname: string;
}

const CreatePage = () => {
  const { register, handleSubmit, reset } = useForm<FormInput>();
  const createProject = api.project.createProject.useMutation();
  const router = useRouter();
  const refetch = useRefetch();
  const [, setProjectId] = useLocalStorage<string | null>(
    "dionysus-projectId",
    null,
  );

  function onSubmit(data: FormInput) {
    createProject.mutate(
      {
        repoUrl: data.repoUrl,
        projectname: data.projectname,
      },
      {
        onSuccess: () => {
          toast.success("Project created Successfully");
          void refetch();
          reset();
        },
        onError: () => {
          toast.error("Failed to create project");
        },
      },
    );
  }

  const handleCreateProjectSubmit = (event: FormEvent<HTMLFormElement>) => {
    void handleSubmit(onSubmit)(event);
  };

  const handleImported = (projectId: string) => {
    setProjectId(projectId);
    router.push("/dashboard");
  };

  return (
    <div
      className={cn(
        "flex",
        "items-center",
        "gap-12",
        "h-full",
        "justify-center",
      )}
    >
      <Image
        src="/create.png"
        alt=""
        width={224}
        height={224}
        className={cn("h-56", "w-auto")}
      />

      <div className="w-[380px]">
        <h1 className={cn("font-semibold", "text-2xl")}>
          Link your GitHub Repository
        </h1>

        <p className={cn("text-sm", "text-muted-foreground", "mb-6")}>
          Enter your project details to connect with Dionysus.
        </p>

        <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
          {/* Project Name */}
          <div className="space-y-1">
            <label className={cn("text-sm", "font-medium")}>Project Name</label>
            <Input
              {...register("projectname", { required: true })}
              placeholder="My Awesome Project"
            />
          </div>

          {/* GitHub URL */}
          <div className="space-y-1">
            <label className={cn("text-sm", "font-medium")}>GitHub URL</label>
            <Input
              {...register("repoUrl", { required: true })}
              placeholder="https://github.com/user/repo"
            />
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            For private repositories, add <code>GITHUB_TOKEN</code> to your
            server <code>.env</code> file and restart the dev server.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              className="w-full flex-1"
              disabled={createProject.isPending}
            >
              Create Project
            </Button>
            <GithubImportButton
              className="flex-1"
              onImported={handleImported}
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePage;
