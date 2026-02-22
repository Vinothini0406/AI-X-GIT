"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { cn } from "../../../lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import useRefetch from "@/hooks/use-refetch";

type FormInput = {
    repoUrl: string;
    projectname: string;
    githubToken?: string;
};

const CreatePage = () => {
    const { register, handleSubmit, reset } = useForm<FormInput>();
    const createProject = api.project.createProject.useMutation()


    const refetch = useRefetch();

    function onSubmit(data: FormInput) {

        // window.alert(JSON.stringify(data, null, 2));
        createProject.mutate({
            repoUrl: data.repoUrl,
            projectname: data.projectname,
            githubToken: data.githubToken,
        }, {
            onSuccess: () => {
                toast.success("Project created Successfully");
                refetch()
                reset();
            },
            onError: () => {
                toast.error("Failed to create project");
            }
        });

    }

    return (
        <div className={cn("flex", "items-center", "gap-12", "h-full", "justify-center")}>
            <img src="/create.png" className={cn("h-56", "w-auto")} />

            <div className="w-[380px]">
                <h1 className={cn("font-semibold", "text-2xl")}>
                    Link your GitHub Repository
                </h1>

                <p className={cn("text-sm", "text-muted-foreground", "mb-6")}>
                    Enter your project details to connect with Dionysus.
                </p>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

                    {/* GitHub Token */}
                    <div className="space-y-1">
                        <label className={cn("text-sm", "font-medium")}>GitHub Token</label>
                        <Input
                            {...register("githubToken")}
                            placeholder="ghp_xxxxxxxxx"
                        />
                    </div>

                    {/* Submit */}
                    <Button type="submit" className="w-full" disabled={createProject.isPending
                    }>
                        Create Project
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default CreatePage;