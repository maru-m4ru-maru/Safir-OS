const assert = require("node:assert/strict");
const { openpty } = require("../web/qemu/xterm-pty.js");
const { install } = require("../web/keyboard-input.js");

class TestEvent {
  constructor(type, fields = {}) {
    this.type = type;
    this.defaultPrevented = false;
    this.propagationStopped = false;
    Object.assign(this, fields);
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopImmediatePropagation() {
    this.propagationStopped = true;
  }
}

class TestTextarea {
  constructor() {
    this.value = "";
    this.listeners = new Map();
    this.selectionStart = 0;
    this.selectionEnd = 0;
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(callback);
  }

  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }

  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  focus() {}

  dispatch(type, fields = {}) {
    const event = new TestEvent(type, fields);

    for (const callback of [...(this.listeners.get(type) || [])]) {
      callback(event);
    }

    return event;
  }
}

function createTerminal() {
  const textarea = new TestTextarea();
  const dataListeners = new Set();

  return {
    textarea,
    modes: { applicationCursorKeysMode: false },
    onData(callback) {
      dataListeners.add(callback);
      return {
        dispose() {
          dataListeners.delete(callback);
        }
      };
    },
    onBinary() {
      return { dispose() {} };
    },
    onResize() {
      return { dispose() {} };
    },
    hasSelection() {
      return false;
    },
    focus() {},
    input(data) {
      for (const callback of dataListeners) {
        callback(data);
      }
    },
    write() {}
  };
}

function readSlave(slave) {
  return Buffer.from(slave.read()).toString("utf8");
}

function typeText(textarea, value, inputType = "insertText") {
  textarea.value = value;
  return textarea.dispatch("input", {
    data: value,
    inputType,
    isComposing: false
  });
}

function key(textarea, key, fields = {}) {
  return textarea.dispatch("keydown", {
    key,
    keyCode: 0,
    isComposing: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    ...fields
  });
}

async function run() {
  const { master, slave } = openpty();
  const termios = slave.ioctl("TCGETS");
  termios.iflag |= 0x0100;
  termios.lflag &= ~(0x0002 | 0x0008);
  slave.ioctl("TCSETS", termios);

  const terminal = createTerminal();
  master.activate(terminal);

  const keyboard = install(terminal, { enabled: true });
  assert.ok(keyboard);

  for (const character of "help") {
    typeText(terminal.textarea, character);
    assert.equal(readSlave(slave), character);
    assert.equal(terminal.textarea.value, "");
  }

  const enter = key(terminal.textarea, "Enter");
  assert.equal(enter.defaultPrevented, true);
  assert.equal(enter.propagationStopped, true);
  assert.equal(readSlave(slave), "\n");

  const backspace = key(terminal.textarea, "Backspace");
  assert.equal(backspace.defaultPrevented, true);
  assert.equal(readSlave(slave), "\x7f");

  assert.equal(readSlave(slave), "");

  terminal.textarea.dispatch("compositionstart");
  terminal.textarea.value = "に";
  terminal.textarea.dispatch("input", {
    data: "に",
    inputType: "insertCompositionText",
    isComposing: true
  });
  assert.equal(readSlave(slave), "");

  terminal.textarea.dispatch("compositionupdate", { data: "日本" });
  terminal.textarea.dispatch("compositionend", { data: "日本" });

  terminal.textarea.value = "日本";
  terminal.textarea.dispatch("input", {
    data: "日本",
    inputType: "insertFromComposition",
    isComposing: false
  });
  assert.equal(readSlave(slave), "日本");
  assert.equal(terminal.textarea.value, "");

  terminal.textarea.dispatch("compositionstart");
  terminal.textarea.dispatch("compositionend", { data: "かな" });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(readSlave(slave), "かな");

  typeText(terminal.textarea, "echo 日本語");
  assert.equal(readSlave(slave), "echo 日本語");

  const paste = terminal.textarea.dispatch("paste", {
    clipboardData: {
      getData(type) {
        assert.equal(type, "text/plain");
        return "echo pasted";
      }
    }
  });
  assert.equal(paste.defaultPrevented, true);
  assert.equal(readSlave(slave), "echo pasted");

  key(terminal.textarea, "c", { ctrlKey: true });
  assert.equal(readSlave(slave), "\x03");

  key(terminal.textarea, "ArrowLeft");
  assert.equal(readSlave(slave), "\x1b[D");

  terminal.modes.applicationCursorKeysMode = true;
  key(terminal.textarea, "ArrowUp");
  assert.equal(readSlave(slave), "\x1bOA");

  key(terminal.textarea, "Process", { keyCode: 229 });
  typeText(terminal.textarea, "かな");
  assert.equal(readSlave(slave), "かな");

  keyboard.setEnabled(false);
  typeText(terminal.textarea, "ignored");
  assert.equal(readSlave(slave), "");

  keyboard.setEnabled(true);
  typeText(terminal.textarea, "ok");
  assert.equal(readSlave(slave), "ok");

  keyboard.dispose();
  master.dispose();

  process.stdout.write(
    "Independent keyboard input bridge, IME, paste and PTY tests passed.\n"
  );
}

run().catch(error => {
  process.stderr.write(String(error.stack || error) + "\n");
  process.exitCode = 1;
});
