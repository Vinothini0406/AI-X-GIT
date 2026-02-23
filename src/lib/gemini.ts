import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_MODEL = "gemini-2.5-flash";
const COMMIT_HASH_REGEX = /^[0-9a-f]{7,40}$/i;

type SummariseCommitOptions = {
  repoUrl?: string;
};

type RepoCommitContext = {
  commitHash: string;
  commitMessage: string;
  commitDate: Date | string;
  summary: string;
};

type AskRepoQuestionInput = {
  projectName: string;
  githubUrl?: string | null;
  question: string;
  commits: RepoCommitContext[];
};

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: GEMINI_MODEL });
}

function looksLikeDiff(text: string): boolean {
  const value = text.trimStart();
  return (
    value.startsWith("diff --git ") ||
    value.includes("\n@@ ") ||
    value.includes("\n+++ ") ||
    value.includes("\n--- ")
  );
}

function normalizeRepoUrl(repoUrl: string): string {
  const value = repoUrl.trim().replace(/\/+$/, "").replace(/\.git$/, "");

  if (value.startsWith("git@github.com:")) {
    return `https://github.com/${value.slice("git@github.com:".length).replace(/\.git$/, "")}`;
  }
  if (value.startsWith("github.com/")) {
    return `https://${value}`;
  }
  if (/^[^/]+\/[^/]+$/.test(value)) {
    return `https://github.com/${value}`;
  }
  if (value.startsWith("https://github.com/") || value.startsWith("http://github.com/")) {
    return value;
  }

  throw new Error(`Unsupported repo URL format: ${repoUrl}`);
}

function toDiffUrl(input: string, options: SummariseCommitOptions): string {
  const value = input.trim();

  if (value.startsWith("http://") || value.startsWith("https://")) {
    const url = new URL(value);

    if (!/github\.com$/i.test(url.hostname)) {
      throw new Error("Only github.com commit URLs are supported");
    }

    if (url.pathname.endsWith(".diff")) {
      return `${url.origin}${url.pathname}`;
    }

    if (/\/commit\/[0-9a-f]{7,40}$/i.test(url.pathname)) {
      return `${url.origin}${url.pathname}.diff`;
    }

    throw new Error(`Unsupported GitHub URL format: ${value}`);
  }

  if (COMMIT_HASH_REGEX.test(value)) {
    const repoUrl = options.repoUrl ?? process.env.GITHUB_REPO_URL;
    if (!repoUrl) {
      throw new Error(
        "Commit hash input requires repoUrl option or GITHUB_REPO_URL environment variable",
      );
    }

    const normalizedRepoUrl = normalizeRepoUrl(repoUrl);
    return `${normalizedRepoUrl}/commit/${value}.diff`;
  }

  throw new Error("Input must be raw diff text, a commit URL, a .diff URL, or a commit hash");
}

async function resolveDiff(input: string, options: SummariseCommitOptions): Promise<string> {
  if (looksLikeDiff(input)) {
    return input;
  }

  const diffUrl = toDiffUrl(input, options);
  const response = await fetch(diffUrl, {
    headers: {
      Accept: "text/plain",
      "User-Agent": "ai-x-git",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch diff (${response.status} ${response.statusText}) from ${diffUrl}`);
  }

  const diff = await response.text();
  if (!looksLikeDiff(diff)) {
    throw new Error("Fetched content is not a git diff");
  }

  return diff;
}

export async function summariseCommit(
  input: string,
  options: SummariseCommitOptions = {},
): Promise<string> {
  const diff = await resolveDiff(input, options);
  const model = getGeminiModel();

  const response = await model.generateContent([
    "You are an expert programmer summarizing a git diff.",
    "Return concise bullet points focused on behavior changes and important refactors.",
    "Mention notable risks, migrations, test changes, and API changes when present.",
    "",
    `Please summarize this git diff:\n\n${diff}`,
  ]);

  const text = response.response.text().trim();
  if (!text) {
    throw new Error("Gemini returned an empty summary");
  }

  return text;
}

export const aiSummariseCommit = summariseCommit;
export const summarizeCommit = summariseCommit;

export async function askRepoQuestion(input: AskRepoQuestionInput): Promise<string> {
  const model = getGeminiModel();

  const commitsContext = input.commits
    .slice(0, 20)
    .map((commit, index) => {
      const commitDate =
        typeof commit.commitDate === "string"
          ? commit.commitDate
          : commit.commitDate.toISOString();
      return [
        `Commit ${index + 1}`,
        `Hash: ${commit.commitHash}`,
        `Date: ${commitDate}`,
        `Message: ${commit.commitMessage}`,
        `Summary: ${commit.summary}`,
      ].join("\n");
    })
    .join("\n\n");

  const response = await model.generateContent([
    "You are a senior engineering assistant for a GitHub repository.",
    "Answer based on repository context and commit summaries.",
    "If context is insufficient, explicitly say what is missing.",
    "",
    `Project: ${input.projectName}`,
    `Repository URL: ${input.githubUrl ?? "not provided"}`,
    "",
    "Recent commit context:",
    commitsContext || "No commits available yet.",
    "",
    `Question: ${input.question}`,
  ]);

  const text = response.response.text().trim();
  if (!text) {
    throw new Error("Gemini returned an empty answer");
  }

  return text;
}

if (process.argv[1]?.endsWith("gemini.ts")) {
  const input = process.argv[2];
  const repoUrl = process.argv[3] ?? process.env.GITHUB_REPO_URL;

  if (!input) {
    console.error("Usage: bun src/lib/gemini.ts <commit-url|commit-hash|diff-url> [repo-url]");
    process.exit(1);
  }

  console.log(await summariseCommit(input, { repoUrl }));
}
