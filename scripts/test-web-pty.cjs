const assert = require("node:assert/strict");
const { openpty } = require("../web/qemu/xterm-pty.js");

const { master, slave } = openpty();

const termios = slave.ioctl("TCGETS");
termios.iflag |= 0x0100;
termios.lflag |= 0x0002 | 0x0008;
slave.ioctl("TCSETS", termios);

let sendData;
let echoed = "";

master.activate({
  write(data, callback) {
    echoed += Buffer.from(data).toString("utf8");
    if (callback) callback();
  },
  onData(callback) {
    sendData = callback;
    return { dispose() {} };
  },
  onBinary() {
    return { dispose() {} };
  },
  onResize() {
    return { dispose() {} };
  }
});

assert.equal(typeof sendData, "function");

for (const character of "help") {
  sendData(character);
}

assert.equal(slave.readable, false);
assert.equal(echoed, "help");

sendData("\r");

assert.equal(slave.readable, true);
assert.equal(
  Buffer.from(slave.read()).toString("ascii"),
  "help\n"
);
assert.equal(slave.readable, false);
assert.equal(echoed, "help\r\n");

for (const character of "about") {
  sendData(character);
}
sendData("\r");

assert.equal(
  Buffer.from(slave.read()).toString("ascii"),
  "about\n"
);

master.dispose();

process.stdout.write("Browser PTY canonical input and terminal echo passed.\n");
