import { Octokit } from "octokit";

import { aiSummariseCommit } from "./gemini";

const DEFAULT_GITHUB_URL = "https://github.com/docker/genai-stack";
const MAX_COMMITS = 15;

type CommitResponse = {
  commitHash: string;
  commitMessage: string;
  commitAuthorName: string;
  commitAuthorAvatar: string;
  commitDate: string;
};

type CommitSummaryResponse = CommitResponse & {
  summary: string;
};

type RepoRef = {
  owner: string;
  repo: string;
  normalizedRepoUrl: string;
};

let cachedDb: any;

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

function parseGithubRepo(githubUrl: string): RepoRef {
  const value = githubUrl.trim().replace(/\/+$/, "").replace(/\.git$/, "");

  if (!value) {
    throw new Error("Invalid github url");
  }

  if (value.startsWith("git@github.com:")) {
    const path = value.slice("git@github.com:".length).replace(/\.git$/, "");
    const [owner, repo] = path.split("/");
    if (!owner || !repo) {
      throw new Error("Invalid github url");
    }
    return {
      owner,
      repo,
      normalizedRepoUrl: `https://github.com/${owner}/${repo}`,
    };
  }

  if (value.startsWith("github.com/")) {
    return parseGithubRepo(`https://${value}`);
  }

  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    const [owner, repo] = value.split("/");
    if (!owner || !repo) {
      throw new Error("Invalid github url");
    }
    return {
      owner,
      repo,
      normalizedRepoUrl: `https://github.com/${owner}/${repo}`,
    };
  }

  const url = new URL(value);
  if (!/github\.com$/i.test(url.hostname)) {
    throw new Error("Only github.com repositories are supported");
  }

  const [owner, repo] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repo) {
    throw new Error("Invalid github url");
  }

  return {
    owner,
    repo,
    normalizedRepoUrl: `${url.origin}/${owner}/${repo}`,
  };
}

export const getCommitHashes = async (
  githubUrl: string,
  limit = MAX_COMMITS,
): Promise<CommitResponse[]> => {
  const { owner, repo } = parseGithubRepo(githubUrl);
  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
    per_page: limit,
  });

  return data.slice(0, limit).map((commit) => ({
    commitHash: commit.sha,
    commitMessage: commit.commit.message ?? "",
    commitAuthorName: commit.commit.author?.name ?? "",
    commitAuthorAvatar: commit.author?.avatar_url ?? "",
    commitDate: commit.commit.author?.date ?? "",
  }));
};

export const getCommitHarshes = getCommitHashes;

export const getCommitDiff = async (githubUrl: string, commitHash: string): Promise<string> => {
  const { owner, repo } = parseGithubRepo(githubUrl);
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
    owner,
    repo,
    ref: commitHash,
    headers: {
      accept: "application/vnd.github.v3.diff",
    },
  });

  const diff = typeof data === "string" ? data : String(data ?? "");
  if (!diff.trim().startsWith("diff --git")) {
    throw new Error(`Unable to fetch git diff for commit ${commitHash}`);
  }

  return diff;
};

export const summariseGithubCommit = async (
  githubUrl: string,
  commitHash: string,
): Promise<string> => {
  const diff = await getCommitDiff(githubUrl, commitHash);
  return aiSummariseCommit(diff, { repoUrl: githubUrl });
};

export const pollCommits = async (projectId: string): Promise<CommitSummaryResponse[]> => {
  const { project, githubUrl } = await fetchProjectGithubUrl(projectId);

  if (!project || !githubUrl) {
    return [];
  }

  const commitHashes = await getCommitHashes(githubUrl);
  const unprocessedCommits = await filterUnprocessedCommits(projectId, commitHashes);

  const commitsWithSummaries = await Promise.all(
    unprocessedCommits.map(async (commit) => {
      try {
        const summary = await summariseGithubCommit(githubUrl, commit.commitHash);
        return { ...commit, summary };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown error";
        return { ...commit, summary: `Summary unavailable: ${reason}` };
      }
    }),
  );

  return commitsWithSummaries;
};

async function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    const { db } = await import("@/server/db");
    cachedDb = db;
    return cachedDb;
  } catch {
    const { PrismaClient } = await import("../../generated/prisma/index.js");
    cachedDb = new PrismaClient();
    return cachedDb;
  }
}

async function fetchProjectGithubUrl(projectId: string) {
  const db = await getDb();
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { githubUrl: true },
  });

  return { project, githubUrl: project?.githubUrl };
}

async function filterUnprocessedCommits(projectId: string, commitHashes: CommitResponse[]) {
  const db = await getDb();
  const processedCommits = await db.commit.findMany({
    where: {
      projectId,
    },
    select: {
      commitHash: true,
    },
  });

  return commitHashes.filter(
    (commit) =>
      !processedCommits.some(
        (processedCommit: { commitHash: string }) =>
          processedCommit.commitHash === commit.commitHash,
      ),
  );
}

if (process.argv[1]?.endsWith("github.ts")) {
  const input = process.argv[2] ?? DEFAULT_GITHUB_URL;
  const isUrlInput = input.startsWith("http://") || input.startsWith("https://");

  const result = isUrlInput ? await getCommitHashes(input) : await pollCommits(input);
  console.log(JSON.stringify(result, null, 2));

  if (cachedDb?.$disconnect) {
    await cachedDb.$disconnect();
  }
}
