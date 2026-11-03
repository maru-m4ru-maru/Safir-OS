const assert = require("node:assert/strict");
const { openpty } = require("../web/qemu/xterm-pty.js");

const { master, slave } = openpty();

const termios = slave.ioctl("TCGETS");
termios.iflag |= 0x0100;
termios.iflag &= ~(0x0020 | 0x0400 | 0x0800);
termios.lflag &= ~(0x0001 | 0x0002 | 0x0008 | 0x8000);
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

for (const sequence of [
  "\x1b[A",
  "\x1b[B",
  "\x1b[C",
  "\x1b[D",
  "\x1b[H",
  "\x1b[F",
  "\x1b[3~",
  "\x1b[1;5D",
  "\x1bOA",
  "\x1bOB",
  "\x1bOC",
  "\x1bOD",
  "\x03",
  "\x04",
  "\x01",
  "\x05",
  "\x0b",
  "\x15",
  "\x17",
  "\t"
]) {
  sendData(sequence);
  assert.equal(slave.readable, true);
  assert.deepEqual(
    Buffer.from(slave.read()),
    Buffer.from(sequence)
  );
}

sendData("日本語");
assert.equal(slave.readable, true);
assert.deepEqual(
  Buffer.from(slave.read()),
  Buffer.from("日本語")
);

slave.write(Buffer.from("SafirOS output"));
assert.equal(terminalOutput, "SafirOS output");

master.dispose();

process.stdout.write("Browser PTY raw input forwarding passed.\n");
