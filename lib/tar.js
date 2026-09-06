"use strict";

const { closeSync, copyFileSync, mkdirSync, openSync, rmSync, symlinkSync, writeSync } = require("fs");
const { dirname, join, resolve, sep } = require("path");

const BLOCK = 512;
const EMPTY = Buffer.alloc(0);

function str(block, offset, length) {
    let end = offset;
    const limit = offset + length;
    while (end < limit && block[end] !== 0) end++;
    return block.toString("utf8", offset, end);
}

function octal(block, offset, length) {
    const raw = str(block, offset, length).replace(/[^0-7]/g, "");
    return raw ? parseInt(raw, 8) : 0;
}

function strip(name) {
    const index = name.indexOf("/");
    return index === -1 ? "" : name.slice(index + 1);
}

function parsePax(body) {
    const records = {};
    const text = body.toString("utf8");
    let offset = 0;
    while (offset < text.length) {
        const space = text.indexOf(" ", offset);
        if (space === -1) break;
        const length = parseInt(text.slice(offset, space), 10);
        if (!length) break;
        const line = text.slice(space + 1, offset + length - 1);
        const eq = line.indexOf("=");
        if (eq !== -1) records[line.slice(0, eq)] = line.slice(eq + 1);
        offset += length;
    }
    return records;
}

class Extractor {
    constructor(dest) {
        this.dest = resolve(dest);
        this.rest = EMPTY;
        this.entry = null;
        this.fd = null;
        this.meta = EMPTY;
        this.override = {};
        this.links = [];
    }

    write(chunk) {
        this.rest = this.rest.length ? Buffer.concat([this.rest, chunk]) : chunk;
        for (;;) {
            if (this.entry) {
                const take = Math.min(this.entry.left, this.rest.length);
                if (take) {
                    const slice = this.rest.subarray(0, take);
                    if (this.fd !== null) writeSync(this.fd, slice);
                    else if (this.entry.keep) this.meta = Buffer.concat([this.meta, slice]);
                    this.entry.left -= take;
                    this.rest = this.rest.subarray(take);
                }
                if (this.entry.left) return;
                const skip = Math.min(this.entry.pad, this.rest.length);
                this.entry.pad -= skip;
                this.rest = this.rest.subarray(skip);
                if (this.entry.pad) return;
                this.finish();
                continue;
            }
            if (this.rest.length < BLOCK) return;
            const header = this.rest.subarray(0, BLOCK);
            this.rest = this.rest.subarray(BLOCK);
            if (header[0] === 0) return;
            this.begin(header);
        }
    }

    begin(header) {
        const type = String.fromCharCode(header[156]);
        const size = octal(header, 124, 12);
        const prefix = str(header, 345, 155);
        const raw = prefix ? prefix + "/" + str(header, 0, 100) : str(header, 0, 100);
        this.entry = {
            type,
            name: this.override.path || raw,
            link: this.override.linkpath || str(header, 157, 100),
            mode: octal(header, 100, 8) & 0o777,
            left: size,
            pad: (BLOCK - (size % BLOCK)) % BLOCK,
            keep: type === "x" || type === "g" || type === "L" || type === "K",
            target: null
        };
        if (this.entry.keep) {
            this.meta = EMPTY;
            return;
        }
        this.override = {};
        const name = strip(this.entry.name);
        if (!name || name.split("/").includes("..")) return;
        const target = join(this.dest, name);
        if (!target.startsWith(this.dest + sep)) return;
        this.entry.target = target;
        if (type === "5") {
            mkdirSync(target, { recursive: true });
            return;
        }
        if (type === "1" || type === "2") return;
        if (type !== "0" && type !== "\0" && type !== "") return;
        mkdirSync(dirname(target), { recursive: true });
        this.fd = openSync(target, "w", this.entry.mode || 0o644);
    }

    finish() {
        const entry = this.entry;
        this.entry = null;
        if (this.fd !== null) {
            closeSync(this.fd);
            this.fd = null;
            return;
        }
        if (entry.keep) {
            const text = this.meta.toString("utf8").replace(/\0+$/, "");
            if (entry.type === "L") this.override.path = text;
            else if (entry.type === "K") this.override.linkpath = text;
            else if (entry.type === "x") Object.assign(this.override, parsePax(this.meta));
            this.meta = EMPTY;
            return;
        }
        if ((entry.type === "1" || entry.type === "2") && entry.target && entry.link) {
            this.links.push(entry);
        }
    }

    end() {
        for (const entry of this.links) {
            const source = entry.type === "2" ? resolve(dirname(entry.target), entry.link) : join(this.dest, strip(entry.link));
            if (source !== this.dest && !source.startsWith(this.dest + sep)) continue;
            try {
                mkdirSync(dirname(entry.target), { recursive: true });
                rmSync(entry.target, { force: true });
                if (entry.type === "2") symlinkSync(entry.link, entry.target);
                else copyFileSync(source, entry.target);
            } catch (error) {
                if (error.code !== "ENOENT") throw error;
            }
        }
        this.links = [];
    }
}

module.exports = { Extractor };