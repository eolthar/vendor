# Example
A project that starts through `boot.js` instead of its own entry point.

> [!NOTE]
> Set `boot.js` as the startup file on the server. The host has to run it
> instead of `main.js`, otherwise nothing is vendored and the project starts
> without its GitHub dependencies.

```
my-bot/
├── package.json
├── boot.js
└── main.js
```

## package.json
GitHub packages go into the `vendor` field. npm ignores that field, so a plain
`npm install` on the host still succeeds.

```json
{
    "name": "my-bot",
    "version": "1.0.0",
    "dependencies": {
        "@eolthar/vendor": "^1.0.0"
    },
    "vendor": {
        "@quoriel/db": "quoriel/db",
        "envise": "eolthar/envise#dev"
    }
}
```

## boot.js
This is the file the server startup command points at. Requiring the entry
point after `ensure` matters: the vendored packages do not exist until it
returns.

```js
const { ensure } = require("@eolthar/vendor");

// Every option has a default, ensure() takes no arguments just as well
ensure({ dir: "vendor", force: false });

// Handing over to the project once every package is in place
require("./main.js");
```

## main.js
```js
const frames = ["(o.o)", "(-.-)", "(o.o)", "(^.^)"];

let count = 0;

setInterval(() => {
    count++;
    const face = frames[count % frames.length];
    console.log(" /\\_/\\   " + face + "   " + count);
}, 1000);
```

## Result
```
[vendor] 1/2 "@quoriel/db" downloaded "quoriel/db#HEAD" (32 KB)
[vendor] 2/2 "envise" downloaded "eolthar/envise#dev" (756 B)
[vendor] Installing dependencies with npm!
 /\_/\   (-.-)   1
 /\_/\   (o.o)   2
 /\_/\   (^.^)   3
```