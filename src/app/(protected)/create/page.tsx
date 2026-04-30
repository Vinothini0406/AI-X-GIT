"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useForm } from "react-hook-form";
import { cn } from "../../../lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import useRefetch from "@/hooks/use-refetch";

interface FormInput {
  repoUrl: string;
  projectname: string;
}

const CreatePage = () => {
  const { register, handleSubmit, reset } = useForm<FormInput>();
  const createProject = api.project.createProject.useMutation();

  const refetch = useRefetch();

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

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={createProject.isPending}
          >
            Create Project
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CreatePage;
