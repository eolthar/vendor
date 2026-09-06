# @eolthar/vendor
Installs GitHub dependencies without git by vendoring source tarballs.

Packages listed in the `vendor` field of `package.json` are streamed as
tarballs from codeload, unpacked into a local directory and linked through
`file:` references, so npm resolves them and their registry dependencies
without ever touching the git protocol. The `dependencies` block is rewritten
with those links and stays that way, while the `vendor` field is left alone.

Git specs found in `dependencies` are moved into the `vendor` field on the
first run. Git specs found inside a vendored package are lifted to the root
and handled the same way, which keeps the vendor directory flat: one
directory per package name, no nested `node_modules`. When two packages ask
for different refs of the same name, the first one wins and the other is
reported.

Anything after `#` is passed to codeload as a ref: a branch, a tag, a full or
short commit hash. Without it the default branch is used. A version range,
`#semver:^1.2.0`, is refused, since resolving one needs the git protocol.

A package is downloaded only when its directory is missing, so removing the
directory is the way to refresh it.

## Install
```
npm i @eolthar/vendor
```

## Example
A project that starts through `boot.js`: the manifest, the entry point and the
output of a real run. [See the full example](https://github.com/eolthar/vendor/blob/main/EXAMPLE.md).

## ensure(options)
| Option    | Default            | Description                                |
| --------- | ------------------ | ------------------------------------------ |
| `dir`     | `vendor`           | Directory the packages are unpacked into   |
| `field`   | `vendor`           | Key in `package.json` holding the map      |
| `cwd`     | caller directory   | Where the lookup for `package.json` starts |
| `force`   | `false`            | Remove and download everything again       |
| `offline` | `false`            | Throw instead of reaching the network      |
| `token`   | `env.GITHUB_TOKEN` | Credential for private repositories        |

Returns a map of `name` to `{ spec, path }`.

`dir` has to stay inside the project: Node resolves a linked package through
its real path, and a directory outside the project would cut the vendored
packages off from the root `node_modules`.

## Notes
Downloads are streamed, so memory stays flat regardless of repository size.

npm installs the `devDependencies` of a vendored package because a `file:`
directory is linked rather than packed. That is what allows a `prepare`
script to build sources that ship without `dist`.

## License
MIT