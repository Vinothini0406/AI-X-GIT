import OpenAI, { APIError } from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const COMMIT_HASH_REGEX = /^[0-9a-f]{7,40}$/i;

interface SummariseCommitOptions {
  repoUrl?: string;
}

interface RepoCommitContext {
  commitHash: string;
  commitMessage: string;
  commitDate: Date | string;
  summary: string;
}

interface AskRepoQuestionInput {
  projectName: string;
  githubUrl?: string | null;
  question: string;
  commits: RepoCommitContext[];
}

interface AiClientConfig {
  client: OpenAI;
  model: string;
  providerName: string;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function isOpenRouterBaseUrl(baseUrl: string | undefined): boolean {
  return baseUrl?.includes("openrouter.ai") ?? false;
}

function getAiClientConfig(): AiClientConfig {
  const openRouterApiKey = readEnv("OPENROUTER_API_KEY");
  const configuredBaseURL = readEnv("AI_BASE_URL");
  const baseURL =
    configuredBaseURL ??
    (openRouterApiKey === undefined ? undefined : OPENROUTER_BASE_URL);
  const apiKey =
    readEnv("AI_API_KEY") ??
    (isOpenRouterBaseUrl(baseURL) ? openRouterApiKey : undefined) ??
    (configuredBaseURL === undefined ? readEnv("OPENAI_API_KEY") : undefined);
  if (!apiKey) {
    throw new Error(
      "Missing AI API key. Set OPENROUTER_API_KEY, AI_API_KEY, or OPENAI_API_KEY in .env.",
    );
  }

  const providerName = isOpenRouterBaseUrl(baseURL)
    ? "OpenRouter"
    : "OpenAI-compatible provider";
  const model =
    readEnv("AI_MODEL") ??
    readEnv("OPENAI_MODEL") ??
    (isOpenRouterBaseUrl(baseURL)
      ? DEFAULT_OPENROUTER_MODEL
      : DEFAULT_OPENAI_MODEL);

  return {
    client: new OpenAI({
      apiKey,
      baseURL,
    }),
    model,
    providerName,
  };
}

function toAiRequestError(error: unknown, providerName: string): Error {
  if (error instanceof APIError) {
    if (error.status === 402) {
      return new Error(
        `${providerName} needs available credits for this request. Free models can still fail when account limits are exhausted or the provider requires a non-negative balance.`,
      );
    }

    if (
      error.status === 429 &&
      (error.code === "insufficient_quota" ||
        /quota|billing|monthly spend/i.test(error.message))
    ) {
      return new Error(
        [
          `${providerName} quota exceeded. Add credits, raise the spend limit, or use an API key from a project with available quota.`,
          "ChatGPT subscriptions do not include API credits.",
          "After updating billing or the key, restart the dev server so .env is reloaded.",
        ].join(" "),
      );
    }

    if (error.status === 429) {
      return new Error(
        `${providerName} rate limit reached. Wait briefly, reduce concurrent requests, or increase the project's rate limits.`,
      );
    }

    if (error.status === 401) {
      return new Error(
        `${providerName} authentication failed. Check the AI API key in .env and restart the dev server.`,
      );
    }
  }

  return error instanceof Error
    ? error
    : new Error(`${providerName} request failed`);
}

async function generateText({
  instructions,
  input,
  maxTokens,
}: {
  instructions: string[];
  input: string;
  maxTokens: number;
}): Promise<string> {
  const { client, model, providerName } = getAiClientConfig();
  const completion = await client.chat.completions
    .create({
      model,
      messages: [
        {
          role: "system",
          content: instructions.join("\n"),
        },
        {
          role: "user",
          content: input,
        },
      ],
      max_tokens: maxTokens,
    })
    .catch((error: unknown) => {
      throw toAiRequestError(error, providerName);
    });

  const content = completion.choices.at(0)?.message.content;
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) {
    throw new Error(`${providerName} returned an empty response`);
  }

  return text;
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
  const value = repoUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");

  if (value.startsWith("git@github.com:")) {
    return `https://github.com/${value.slice("git@github.com:".length).replace(/\.git$/, "")}`;
  }
  if (value.startsWith("github.com/")) {
    return `https://${value}`;
  }
  if (/^[^/]+\/[^/]+$/.test(value)) {
    return `https://github.com/${value}`;
  }
  if (
    value.startsWith("https://github.com/") ||
    value.startsWith("http://github.com/")
  ) {
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

  throw new Error(
    "Input must be raw diff text, a commit URL, a .diff URL, or a commit hash",
  );
}

async function resolveDiff(
  input: string,
  options: SummariseCommitOptions,
): Promise<string> {
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
    throw new Error(
      `Failed to fetch diff (${response.status} ${response.statusText}) from ${diffUrl}`,
    );
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
  return generateText({
    instructions: [
      "You are an expert programmer summarizing a git diff.",
      "Return concise bullet points focused on behavior changes and important refactors.",
      "Mention notable risks, migrations, test changes, and API changes when present.",
      "Do not use markdown formatting symbols such as **, __, #, or backticks.",
    ],
    input: `Please summarize this git diff:\n\n${diff}`,
    maxTokens: 700,
  });
}

export const aiSummariseCommit = summariseCommit;
export const summarizeCommit = summariseCommit;

export async function askRepoQuestion(
  input: AskRepoQuestionInput,
): Promise<string> {
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

  return generateText({
    instructions: [
      "You are a senior engineering assistant for a GitHub repository.",
      "Answer based on repository context and commit summaries.",
      "If context is insufficient, explicitly say what is missing.",
      "Return plain text only. Do not use markdown symbols like **, __, #, -, *, or backticks.",
    ],
    input: [
      `Project: ${input.projectName}`,
      `Repository URL: ${input.githubUrl ?? "not provided"}`,
      "",
      "Recent commit context:",
      commitsContext.length > 0 ? commitsContext : "No commits available yet.",
      "",
      `Question: ${input.question}`,
    ].join("\n"),
    maxTokens: 1200,
  });
}

if (process.argv[1]?.endsWith("openai.ts")) {
  const input = process.argv[2];
  const repoUrl = process.argv[3] ?? process.env.GITHUB_REPO_URL;

  if (!input) {
    console.error(
      "Usage: bun src/lib/openai.ts <commit-url|commit-hash|diff-url> [repo-url]",
    );
    process.exit(1);
  }

  console.log(await summariseCommit(input, { repoUrl }));
}
