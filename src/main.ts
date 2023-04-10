import { execFileSync } from "child_process";
import { getInput, setFailed } from "@actions/core";
import { ECRClient, GetAuthorizationTokenCommand } from "@aws-sdk/client-ecr";

const IMAGE_TAG_SPLIT_REGEX = /\s+(?=([^"]*"[^"]*")*[^"]*$)/g;

async function main() {
    try {
        const repositoryUrl = getInput("repository-url");
        const imageTag = getInput("image-tag");
        const prefix = getInput("prefix");

        const { user, password } = await getEcrCredentials();
        execFileSync("docker", ["login", "--username", user, "--password-stdin", repositoryUrl], { input: password });

        const tags = imageTag.split(IMAGE_TAG_SPLIT_REGEX).filter(Boolean);
        const uniqueTags = Array.from(new Set(tags));

        uniqueTags.forEach((tag: string) => {
            const remoteTag = encodeURIComponent([prefix, tag].filter(Boolean).join("-"));
            const remoteImageName = `${repositoryUrl}:${remoteTag}`;
            execFileSync("docker", ["tag", tag, remoteImageName], { stdio: "inherit" });
            execFileSync("docker", ["push", remoteImageName], { stdio: "inherit" });
        })

        execFileSync("docker", ["logout", repositoryUrl]);
    } catch (err) {
        if (err instanceof Error) setFailed(err);
    }
}

async function getEcrCredentials() {
    const ecr = new ECRClient({});
    const getAuthorizationTokenCommand = new GetAuthorizationTokenCommand({});
    const response = await ecr.send(getAuthorizationTokenCommand)
    const token = response.authorizationData?.[0].authorizationToken;

    if (token === undefined) {
        throw Error("Failed to retrieve ECR authorization token.");
    }

    const [user, password] = Buffer.from(token, "base64").toString("utf8").split(":");
    return { user, password };
}

main();
