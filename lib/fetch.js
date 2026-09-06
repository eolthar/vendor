"use strict";

const { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } = require("fs");
const { join } = require("path");
const { get } = require("https");
const { createGunzip } = require("zlib");
const { Writable, pipeline } = require("stream");
const { parseSpec, flatten } = require("./spec");
const { Extractor } = require("./tar");
const { Reporter } = require("./report");

const MAX_REDIRECTS = 5;

function open(url, token, redirects = 0) {
    return new Promise((resolve, reject) => {
        const headers = { "user-agent": "@eolthar/vendor", accept: "application/octet-stream" };
        if (token) headers.authorization = "Bearer " + token;
        const request = get(url, { headers }, (res) => {
            const status = res.statusCode;
            if (status >= 300 && status < 400 && res.headers.location) {
                res.resume();
                if (redirects >= MAX_REDIRECTS) return reject(new Error("too many redirects"));
                return resolve(open(new URL(res.headers.location, url).toString(), token, redirects + 1));
            }
            if (status !== 200) {
                res.resume();
                return reject(new Error("HTTP " + status));
            }
            resolve(res);
        });
        request.on("error", reject);
        request.setTimeout(60000, () => request.destroy(new Error("timeout")));
    });
}

function stream(res, dest, onBytes) {
    return new Promise((resolve, reject) => {
        const extractor = new Extractor(dest);
        let seen = 0;
        res.on("data", (chunk) => {
            seen += chunk.length;
            onBytes(seen);
        });
        const sink = new Writable({
            write(chunk, encoding, done) {
                try {
                    extractor.write(chunk);
                    done();
                } catch (error) {
                    done(error);
                }
            }
        });
        pipeline(res, createGunzip(), sink, (error) => {
            if (error) return reject(error);
            try {
                extractor.end();
                resolve();
            } catch (failure) {
                reject(failure);
            }
        });
    });
}

async function download(task, vendorDir, token) {
    const parsed = parseSpec(task.spec);
    if (!parsed) throw new Error('unsupported spec "' + task.spec + '"');
    if (parsed.range) throw new Error('version range "' + parsed.range + '" needs git, use a branch, tag or commit');
    const url = "https://codeload.github.com/" + parsed.owner + "/" + parsed.repo + "/tar.gz/" + parsed.ref;
    const target = join(vendorDir, flatten(task.name));
    const staging = target + ".tmp";
    rmSync(staging, { recursive: true, force: true });
    mkdirSync(staging, { recursive: true });
    let bytes = 0;
    try {
        await stream(await open(url, token), staging, (seen) => {
            bytes = seen;
        });
    } catch (error) {
        rmSync(staging, { recursive: true, force: true });
        throw error;
    }
    if (!existsSync(join(staging, "package.json"))) {
        rmSync(staging, { recursive: true, force: true });
        throw new Error("archive has no package.json in its root");
    }
    rmSync(target, { recursive: true, force: true });
    renameSync(staging, target);
    return { target, bytes, source: parsed.owner + "/" + parsed.repo + "#" + parsed.ref };
}

async function main() {
    const input = JSON.parse(readFileSync(0, "utf8"));
    const { lift } = require("./manifest");
    const map = input.map;
    const queue = input.tasks.slice();
    const added = {};
    const conflicts = [];
    const failed = [];
    mkdirSync(input.vendorDir, { recursive: true });
    const report = new Reporter(process.stdout);
    let index = 0;
    while (queue.length) {
        const task = queue.shift();
        let target;
        index++;
        try {
            const result = await download(task, input.vendorDir, input.token);
            target = result.target;
            report.downloaded(task.name, result.source, result.bytes, index, index + queue.length);
        } catch (error) {
            report.note(task.name + " failed: " + error.message);
            failed.push({ name: task.name, reason: error.message });
            continue;
        }
        const result = lift(target, map);
        conflicts.push(...result.conflicts);
        for (const nested of result.added) {
            added[nested.name] = nested.spec;
            queue.push(nested);
            report.note(nested.name + " lifted from " + task.name);
        }
    }
    writeFileSync(process.argv[2], JSON.stringify({ added, conflicts, failed }));
}

if (require.main === module) {
    main().catch((error) => {
        process.stderr.write("[vendor] " + error.stack + "\n");
        process.exit(1);
    });
}