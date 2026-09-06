"use strict";

const { existsSync, readFileSync, rmSync, writeFileSync } = require("fs");
const { tmpdir } = require("os");
const { dirname, join, resolve, sep } = require("path");
const { spawnSync } = require("child_process");
const { parseSpec, isGitSpec, flatten } = require("./lib/spec");
const { lift } = require("./lib/manifest");
const { Reporter } = require("./lib/report");

const WORKER = require.resolve("./lib/fetch.js");

function callerDir() {
    const original = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = new Error().stack;
    Error.prepareStackTrace = original;
    for (const frame of stack) {
        const file = frame.getFileName();
        if (file && !file.startsWith("node:") && dirname(file) !== __dirname) {
            return dirname(file);
        }
    }
    return process.cwd();
}

function findRoot(start) {
    let dir = resolve(start);
    for (;;) {
        if (existsSync(join(dir, "package.json"))) return dir;
        const parent = dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

function isEmpty(target) {
    for (const key in target) return false;
    return true;
}

function names(target) {
    const list = [];
    for (const key in target) list.push(key);
    return list;
}

const report = new Reporter(process.stdout);

function warn(conflicts) {
    for (const item of conflicts) {
        report.note(item.name + ": " + item.by + " asks for " + item.wanted + ", using " + item.using);
    }
}

function runWorker(payload) {
    const out = join(tmpdir(), "vendor-" + process.pid + "-" + Date.now() + ".json");
    const result = spawnSync(process.execPath, [WORKER, out], {
        input: JSON.stringify(payload),
        stdio: ["pipe", "inherit", "inherit"],
        maxBuffer: Infinity
    });
    if (result.status !== 0) throw new Error("[vendor] download failed");
    const data = JSON.parse(readFileSync(out, "utf8"));
    rmSync(out, { force: true });
    return data;
}

function npmInstall(root) {
    report.note("Installing dependencies with npm!");
    const result = spawnSync("npm", ["install"], {
        cwd: root,
        stdio: "inherit",
        shell: process.platform === "win32"
    });
    if (result.status !== 0) throw new Error("[vendor] npm install failed");
}

function ensure(options = {}) {
    const root = findRoot(options.cwd || callerDir());
    if (!root) throw new Error("[vendor] package.json not found");
    const field = options.field || "vendor";
    const dirName = options.dir || "vendor";
    const force = options.force === true;
    const offline = options.offline === true;
    const token = "token" in options ? options.token : process.env.GITHUB_TOKEN;
    const vendorDir = resolve(root, dirName);
    if (vendorDir === root || !vendorDir.startsWith(root + sep)) {
        throw new Error("[vendor] dir must be inside the project: " + dirName);
    }
    const manifest = join(root, "package.json");
    const pkg = JSON.parse(readFileSync(manifest, "utf8"));
    const map = Object.assign({}, pkg[field]);
    const deps = pkg.dependencies || {};
    let changed = false;
    for (const name in deps) {
        if (!isGitSpec(deps[name])) continue;
        if (!map[name]) map[name] = deps[name];
        delete deps[name];
        changed = true;
    }
    if (isEmpty(map)) return {};
    const tasks = [];
    const seen = new Set();
    for (const name of names(map)) {
        const target = join(vendorDir, flatten(name));
        if (force) rmSync(target, { recursive: true, force: true });
        if (!existsSync(target)) {
            if (!seen.has(name)) tasks.push({ name, spec: map[name] });
            seen.add(name);
            continue;
        }
        const result = lift(target, map);
        warn(result.conflicts);
        for (const nested of result.added) {
            if (!existsSync(join(vendorDir, flatten(nested.name)))) tasks.push(nested);
            seen.add(nested.name);
            changed = true;
        }
    }
    if (tasks.length) {
        let ranges = "";
        for (const task of tasks) {
            const parsed = parseSpec(task.spec);
            if (parsed && parsed.range) ranges += (ranges ? ", " : "") + task.name + " (" + task.spec + ")";
        }
        if (ranges) {
            throw new Error("[vendor] version ranges need git, use a branch, tag or commit: " + ranges);
        }
        if (offline) {
            let list = "";
            for (const task of tasks) list += (list ? ", " : "") + task.name;
            throw new Error("[vendor] missing in offline mode: " + list);
        }
        const { added, conflicts, failed } = runWorker({ vendorDir, token, tasks, map });
        warn(conflicts);
        if (failed.length) {
            let list = "";
            for (const item of failed) list += (list ? ", " : "") + item.name + " (" + item.reason + ")";
            throw new Error("[vendor] download failed: " + list);
        }
        Object.assign(map, added);
        changed = true;
    }
    const prefix = "file:" + dirName.split(sep).join("/") + "/";
    for (const name in map) {
        const link = prefix + flatten(name);
        if (deps[name] !== link) {
            deps[name] = link;
            changed = true;
        }
    }
    const result = {};
    for (const name in map) {
        result[name] = { spec: map[name], path: join(vendorDir, flatten(name)) };
    }
    if (!changed) return result;
    pkg.dependencies = deps;
    pkg[field] = map;
    writeFileSync(manifest, JSON.stringify(pkg, null, 2) + "\n");
    npmInstall(root);
    return result;
}

module.exports = { ensure };