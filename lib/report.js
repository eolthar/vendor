"use strict";

const TAG = "\u001b[1m\u001b[38;5;244m";
const TEXT = "\u001b[1m\u001b[37m";
const NAME = "\u001b[1m\u001b[32m";
const FROM = "\u001b[1m\u001b[36m";
const META = "\u001b[1m\u001b[38;5;250m";
const OFF = "\u001b[0m";

function size(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return Math.round(bytes / 1024) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
}

class Reporter {
    constructor(stream) {
        this.stream = stream;
        this.color = Boolean(stream.isTTY) && !process.env.NO_COLOR;
    }

    write(text) {
        this.stream.write((this.color ? text : text.replace(/\u001b\[[\d;]+m/g, "")) + "\n");
    }

    downloaded(name, source, bytes, index, total) {
        this.write(TAG + "[vendor]" + OFF + " " + META + index + "/" + total + OFF + " " + NAME + '"' + name + '"' + OFF + " " + TEXT + "downloaded" + OFF + " " + FROM + '"' + source + '"' + OFF + " " + META + "(" + size(bytes) + ")" + OFF);
    }

    note(text) {
        this.write(TAG + "[vendor]" + OFF + " " + TEXT + text + OFF);
    }
}

module.exports = { Reporter };