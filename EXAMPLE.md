# Example
A project that starts through `boot.js` instead of its own entry point.

> [!NOTE]
> Set `boot.js` as the startup file on the server. The host has to run it
> instead of `main.js`, otherwise nothing is vendored and the project starts
> without its GitHub dependencies.

```
cat/
├── package.json
├── boot.js
└── main.js
```

## package.json
GitHub packages go into the `vendor` field. npm ignores that field, so a plain
`npm install` on the host still succeeds.

```json
{
    "name": "cat",
    "version": "1.0.0",
    "dependencies": {
        "@eolthar/vendor": "^1.0.0"
    },
    "vendor": {
        "@eolthar/events": "eolthar/events",
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
The project itself, which knows nothing about vendoring.

```js
// Faces the cat blinks through
const frames = ["(o.o)", "(-.-)", "(o.o)", "(^.^)"];
let count = 0;
// One tick a second
setInterval(() => {
    count++;
    // Walks the list and wraps back to the first face
    const face = frames[count % frames.length];
    // Backslashes are doubled because the string escapes them
    console.log(" /\\_/\\   " + face + "   " + count);
}, 1000);
```

## Result
A cold start. On the next one the packages are already in `vendor/`, so
nothing is downloaded and the cat shows up right away.

```
[vendor] 1/2 "@eolthar/events" downloaded "eolthar/events#HEAD" (4 KB)
[vendor] 2/2 "envise" downloaded "eolthar/envise#dev" (756 B)
[vendor] Installing dependencies with npm!
 /\_/\   (-.-)   1
 /\_/\   (o.o)   2
 /\_/\   (^.^)   3
```