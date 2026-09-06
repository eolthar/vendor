"use strict";

const { existsSync, readFileSync, writeFileSync } = require("fs");
const { basename, join } = require("path");
const { isGitSpec } = require("./spec");

function lift(packageDir, map) {
    const manifest = join(packageDir, "package.json");
    if (!existsSync(manifest)) return { added: [], conflicts: [] };
    let pkg;
    try {
        pkg = JSON.parse(readFileSync(manifest, "utf8"));
    } catch (error) {
        return { added: [], conflicts: [] };
    }
    const deps = pkg.dependencies || {};
    const added = [];
    const conflicts = [];
    let changed = false;
    for (const name in deps) {
        const spec = deps[name];
        if (!isGitSpec(spec)) continue;
        if (!(name in map)) {
            map[name] = spec;
            added.push({ name, spec });
        } else if (map[name] !== spec) {
            conflicts.push({ name, wanted: spec, using: map[name], by: pkg.name || basename(packageDir) });
        }
        delete deps[name];
        changed = true;
    }
    if (changed) writeFileSync(manifest, JSON.stringify(pkg, null, 2) + "\n");
    return { added, conflicts };
}

module.exports = { lift };