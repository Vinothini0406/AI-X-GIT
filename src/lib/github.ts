import { Octokit } from "octokit";

export const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

const defaultGithubUrl = "https://github.com/docker/genai-stack";

type Response = {
    commitHash: string;
    commitMessage: string;
    commitAuthorName: string;
    commitAuthorAvatar: string;
    commitDate: string;
}

export const getCommitHarshes = async (githubUrl: string): Promise<Response[]> => {

    const [owner, repo] = githubUrl.split('/').slice(-2)

    if (!owner || !repo) throw new Error("Invalid github url")

    const { data } = await octokit.rest.repos.listCommits({
        owner,
        repo
    });

    const sortdedCommits = data.sort(
        (a, b) =>
            new Date(b.commit.author?.date ?? 0).getTime() -
            new Date(a.commit.author?.date ?? 0).getTime(),
    );

    return sortdedCommits.slice(0, 15).map((commit) => ({
        commitHash: commit.sha as string,
        commitMessage: commit.commit.message ?? "",
        commitAuthorName: commit.commit.author?.name ?? "",
        commitAuthorAvatar: commit.author?.avatar_url ?? "",
        commitDate: commit.commit.author?.date ?? "",
    }));
};

if (process.argv[1]?.endsWith("github.ts")) {
    // const inputGithubUrl = process.argv[2] ?? defaultGithubUrl;

    const inputGithubUrl = "https://github.com/Kalandhar01/E-Commerce-Clothes";
        console.log(await getCommitHarshes(inputGithubUrl));
}

export const pollCommits = async (projectId: string): Promise<Response[]> => {
    const { project, githubUrl } = await fetchProjectGithubUrl(projectId);

    if (!project || !githubUrl) {
        return [];
    }

    const commitHashes = await getCommitHarshes(githubUrl);
    const unprocessedCommits = await filterUnprocessCommits(projectId, commitHashes);

    return unprocessedCommits;
};

async function getDb() {
    const { db } = await import("@/server/db");
    return db;
}

async function fetchProjectGithubUrl(projectId: string) {
    const db = await getDb();
    const project = await db.project.findUnique({
        where: { id: projectId },
        select: { githubUrl: true },
    });

    return { project, githubUrl: project?.githubUrl };
}
async function filterUnprocessCommits(projectId: string, commitHashes: Response[]) {
    const db = await getDb();
    const processedCommits = await db.commit.findMany({
        where: {
            projectId,
        },
        select: {
            commitHash: true,
        },
    });

    const unprocessedCommits = commitHashes.filter(
        (commit) =>
            !processedCommits.some(
                (processedCommit) => processedCommit.commitHash === commit.commitHash,
            ),
    );

    return unprocessedCommits;
}
