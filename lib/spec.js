"use strict";

const PATTERNS = [
    /^github:([^/\s#]+)\/([^\s#]+?)(?:\.git)?(?:#(.+))?$/,
    /^(?:git\+)?(?:https?|ssh):\/\/(?:[^@/]+@)?(?:www\.)?github\.com[:/]([^/\s#]+)\/([^/\s#]+?)(?:\.git)?(?:#(.+))?$/,
    /^git:\/\/github\.com\/([^/\s#]+)\/([^/\s#]+?)(?:\.git)?(?:#(.+))?$/,
    /^(?![@./])([\w-]+)\/([\w.-]+?)(?:\.git)?(?:#(.+))?$/
];

function parseSpec(spec) {
    if (typeof spec !== "string") return null;
    const value = spec.trim();
    for (const pattern of PATTERNS) {
        const match = value.match(pattern);
        if (!match) continue;
        const ref = match[3] || "";
        const range = ref.startsWith("semver:") ? ref.slice(7) : "";
        return { owner: match[1], repo: match[2], ref: range ? "" : ref || "HEAD", range };
    }
    return null;
}

function isGitSpec(spec) {
    return parseSpec(spec) !== null;
}

function flatten(name) {
    return name.replace(/^@/, "").replace(/\//g, "-");
}

module.exports = { parseSpec, isGitSpec, flatten };