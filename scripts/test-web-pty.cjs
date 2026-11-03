const assert = require("node:assert/strict");
const { openpty } = require("../web/qemu/xterm-pty.js");

const { master, slave } = openpty();

const termios = slave.ioctl("TCGETS");
termios.iflag |= 0x0100;
termios.lflag &= ~(0x0002 | 0x0008);
slave.ioctl("TCSETS", termios);

let sendData;
let terminalOutput = "";

master.activate({
  write(data, callback) {
    terminalOutput += Buffer.from(data).toString("utf8");
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
  assert.equal(slave.readable, true);
  assert.equal(
    Buffer.from(slave.read()).toString("ascii"),
    character
  );
}

assert.equal(terminalOutput, "");

sendData("\x7f");
assert.equal(slave.readable, true);
assert.equal(
  Buffer.from(slave.read()).toString("hex"),
  "7f"
);

sendData("\r");
assert.equal(slave.readable, true);
assert.equal(
  Buffer.from(slave.read()).toString("ascii"),
  "\n"
);

sendData("about");
assert.equal(slave.readable, true);
assert.equal(
  Buffer.from(slave.read()).toString("ascii"),
  "about"
);

sendData("\x7f");
assert.equal(slave.readable, true);
assert.equal(
  Buffer.from(slave.read()).toString("hex"),
  "7f"
);

master.dispose();

process.stdout.write("Browser PTY raw input forwarding passed.\n");
