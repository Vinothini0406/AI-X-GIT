import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { Octokit } from "octokit";

export interface GithubImportRepository {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  updatedAt: string | null;
  pushedAt: string | null;
}

interface GithubApiError extends Error {
  status?: number;
  response?: {
    data?: {
      message?: string;
    };
  };
}

interface GithubRepositoryLike {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch?: string | null;
  language?: string | null;
  private?: boolean;
  fork?: boolean;
  archived?: boolean;
  updated_at?: string | null;
  pushed_at?: string | null;
  owner: {
    login: string;
  };
}

function getGithubApiMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as GithubApiError).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown GitHub API error";
}

function getGithubStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  const status = (error as GithubApiError).status;
  return typeof status === "number" ? status : undefined;
}

function formatGithubTokenError(error: unknown) {
  const status = getGithubStatus(error);
  const message = getGithubApiMessage(error);

  if (status === 401 || status === 403) {
    return "GitHub authorization is missing or expired. Sign in with GitHub again to refresh repository access.";
  }

  return message;
}

function parseGithubFullName(fullName: string) {
  const [owner, repo, extra] = fullName.trim().split("/");

  if (!owner || !repo || extra) {
    throw new Error("Invalid GitHub repository selection.");
  }

  return { owner, repo };
}

async function getGithubUserAccessToken(userId: string) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const hasGithubAccount = user.externalAccounts.some(
    (account) => account.provider === "github",
  );

  if (!hasGithubAccount) {
    return null;
  }

  try {
    const response = await client.users.getUserOauthAccessToken(
      userId,
      "github",
    );

    return response.data.find((token) => token.token)?.token ?? null;
  } catch (error) {
    console.warn("[github-import] Failed to read Clerk GitHub token.", error);
    return null;
  }
}

function createGithubClient(token: string) {
  return new Octokit({ auth: token });
}

function mapRepository(
  repository: GithubRepositoryLike,
): GithubImportRepository {
  return {
    defaultBranch: repository.default_branch ?? "main",
    description: repository.description,
    fullName: repository.full_name,
    htmlUrl: repository.html_url,
    id: repository.id,
    isArchived: repository.archived ?? false,
    isFork: repository.fork ?? false,
    isPrivate: repository.private ?? false,
    language: repository.language ?? null,
    name: repository.name,
    owner: repository.owner.login,
    pushedAt: repository.pushed_at ?? null,
    updatedAt: repository.updated_at ?? null,
  };
}

export async function hasGithubRepositoryAccess(userId: string) {
  return Boolean(await getGithubUserAccessToken(userId));
}

export async function listGithubRepositoriesForUser(
  userId: string,
): Promise<GithubImportRepository[]> {
  const token = await getGithubUserAccessToken(userId);

  if (!token) {
    throw new Error(
      "Sign in with GitHub to import repositories from your account.",
    );
  }

  try {
    const github = createGithubClient(token);
    const { data } = await github.rest.repos.listForAuthenticatedUser({
      affiliation: "owner,collaborator,organization_member",
      direction: "desc",
      per_page: 100,
      sort: "updated",
      visibility: "all",
    });

    return data.map(mapRepository);
  } catch (error) {
    throw new Error(formatGithubTokenError(error));
  }
}

export async function getGithubRepositoryForUser(
  userId: string,
  fullName: string,
): Promise<GithubImportRepository> {
  const token = await getGithubUserAccessToken(userId);

  if (!token) {
    throw new Error(
      "Sign in with GitHub to import repositories from your account.",
    );
  }

  const { owner, repo } = parseGithubFullName(fullName);

  try {
    const github = createGithubClient(token);
    const { data } = await github.rest.repos.get({ owner, repo });

    return mapRepository(data);
  } catch (error) {
    throw new Error(formatGithubTokenError(error));
  }
}
