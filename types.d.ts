/** Options accepted by `ensure`. All of them are optional. */
export interface VendorOptions {
    /**
     * Directory the packages are unpacked into, resolved against the project
     * root. Has to stay inside the project, otherwise the vendored packages
     * lose access to the root `node_modules`. Defaults to `vendor`.
     */
    dir?: string;
    /** Key in `package.json` holding the name-to-spec map. Defaults to `vendor`. */
    field?: string;
    /**
     * Where the upward lookup for `package.json` starts. Defaults to the
     * directory of the file that called `ensure`.
     */
    cwd?: string;
    /** Removes every vendored directory and downloads it again. */
    force?: boolean;
    /** Throws instead of reaching the network when a directory is missing. */
    offline?: boolean;
    /** Credential for private repositories. Defaults to `process.env.GITHUB_TOKEN`. */
    token?: string;
}

/** A vendored package. */
export interface VendorEntry {
    /** Git spec the package was resolved from. */
    spec: string;
    /** Absolute path to the unpacked directory. */
    path: string;
}

/** Vendored packages keyed by package name. */
export type VendorResult = Record<string, VendorEntry>;

/**
 * Downloads the GitHub dependencies declared in `package.json`, unpacks them
 * into the vendor directory, points `dependencies` at them through `file:`
 * references and runs `npm install`.
 *
 * Blocks until every package is in place, so the entry point of the project
 * can be required on the next line. A package whose directory already exists
 * is left alone; removing the directory is what triggers a fresh download.
 *
 * Throws when `package.json` cannot be found, when `dir` points outside the
 * project, when a spec pins a version range, when a download fails, and when
 * `npm install` exits non-zero.
 *
 * @returns Every vendored package, including the ones lifted out of the
 * dependencies of other vendored packages. Empty when nothing is declared.
 */
export declare function ensure(options?: VendorOptions): VendorResult;