(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SafirOSKeyboardInput = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  "use strict";

  const PASSTHROUGH = Symbol("passthrough");

  function keySequence(event, terminal) {
    if (event.key === "Dead" || event.key === "AltGraph") {
      return null;
    }

    if (event.metaKey) {
      return PASSTHROUGH;
    }

    if (
      event.altKey &&
      event.ctrlKey &&
      typeof event.getModifierState === "function" &&
      event.getModifierState("AltGraph")
    ) {
      return null;
    }

    if (event.altKey && !event.ctrlKey) {
      return PASSTHROUGH;
    }

    if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey) {
      return PASSTHROUGH;
    }

    if (event.ctrlKey && !event.altKey && !event.metaKey) {
      const key = String(event.key || "").toLowerCase();

      if (key === "c") {
        if (
          typeof terminal.hasSelection === "function" &&
          terminal.hasSelection()
        ) {
          return PASSTHROUGH;
        }

        return "\x03";
      }

      if (key === "v") {
        return null;
      }

      if (key === "backspace") {
        return "\x17";
      }

      if (key === "arrowleft") {
        return "\x1b[1;5D";
      }

      if (key === "arrowright") {
        return "\x1b[1;5C";
      }

      if (key === "home") {
        return "\x1b[1;5H";
      }

      if (key === "end") {
        return "\x1b[1;5F";
      }

      if (/^[a-z]$/.test(key)) {
        return String.fromCharCode(key.charCodeAt(0) - 96);
      }

      if (key === " " || key === "@") {
        return "\x00";
      }

      return null;
    }

    const applicationCursorKeys = Boolean(
      terminal.modes && terminal.modes.applicationCursorKeysMode
    );

    switch (event.key) {
      case "Enter":
        return "\r";
      case "Backspace":
        return "\x7f";
      case "Tab":
        return event.shiftKey ? "\x1b[Z" : "\t";
      case "Escape":
        return "\x1b";
      case "ArrowUp":
        return applicationCursorKeys ? "\x1bOA" : "\x1b[A";
      case "ArrowDown":
        return applicationCursorKeys ? "\x1bOB" : "\x1b[B";
      case "ArrowRight":
        return applicationCursorKeys ? "\x1bOC" : "\x1b[C";
      case "ArrowLeft":
        return applicationCursorKeys ? "\x1bOD" : "\x1b[D";
      case "Home":
        return "\x1b[H";
      case "End":
        return "\x1b[F";
      case "Insert":
        return "\x1b[2~";
      case "Delete":
        return "\x1b[3~";
      case "PageUp":
        return "\x1b[5~";
      case "PageDown":
        return "\x1b[6~";
      case "F1":
        return "\x1bOP";
      case "F2":
        return "\x1bOQ";
      case "F3":
        return "\x1bOR";
      case "F4":
        return "\x1bOS";
      case "F5":
        return "\x1b[15~";
      case "F6":
        return "\x1b[17~";
      case "F7":
        return "\x1b[18~";
      case "F8":
        return "\x1b[19~";
      case "F9":
        return "\x1b[20~";
      case "F10":
        return "\x1b[21~";
      case "F11":
        return "\x1b[23~";
      case "F12":
        return "\x1b[24~";
      default:
        return null;
    }
  }

  function install(terminal, options = {}) {
    const textarea = terminal && terminal.textarea;
    const eventRoot = terminal && terminal.element;

    if (
      !textarea ||
      typeof textarea.addEventListener !== "function" ||
      !eventRoot ||
      typeof eventRoot.addEventListener !== "function" ||
      typeof terminal.input !== "function"
    ) {
      return null;
    }

    let enabled = Boolean(options.enabled);
    let composing = false;
    let compositionCommitPending = false;
    let compositionCommitData = "";
    let compositionCommitTimer = 0;
    const passThroughKeys = new Set();

    const keyIdentity = event => event.code || event.key || String(event.keyCode);

    let positionFrame = null;

    const updateTextareaPosition = () => {
      positionFrame = null;

      if (!textarea.style || !terminal.element || !terminal.buffer) {
        return;
      }

      const screen = terminal.element.querySelector(".xterm-screen");
      const cursor = terminal.buffer.active;

      if (!screen || !cursor) {
        return;
      }

      const screenRect = screen.getBoundingClientRect();
      const terminalRect = terminal.element.getBoundingClientRect();
      const cols = Math.max(1, terminal.cols || 80);
      const rows = Math.max(1, terminal.rows || 24);
      const cellWidth = screenRect.width / cols;
      const cellHeight = screenRect.height / rows;
      const column = Math.max(0, Math.min(cursor.cursorX, cols - 1));
      const row = Math.max(0, Math.min(cursor.cursorY, rows - 1));

      textarea.style.left =
        (screenRect.left - terminalRect.left + column * cellWidth) + "px";
      textarea.style.top =
        (screenRect.top - terminalRect.top + row * cellHeight) + "px";
      textarea.style.width = Math.max(1, cellWidth) + "px";
      textarea.style.height = Math.max(1, cellHeight) + "px";
      textarea.style.lineHeight = Math.max(1, cellHeight) + "px";
    };

    const scheduleTextareaPosition = () => {
      if (positionFrame !== null) {
        return;
      }

      if (typeof requestAnimationFrame !== "function") {
        updateTextareaPosition();
        return;
      }

      positionFrame = requestAnimationFrame(updateTextareaPosition);
    };

    const cancelTextareaPosition = () => {
      if (
        positionFrame !== null &&
        typeof cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(positionFrame);
      }

      positionFrame = null;
    };

    const send = data => {
      if (enabled && data) {
        terminal.input(data, true);
      }
    };

    const stop = event => {
      event.stopImmediatePropagation();
    };

    const clearTextarea = () => {
      textarea.value = "";

      if (typeof textarea.setSelectionRange === "function") {
        try {
          textarea.setSelectionRange(0, 0);
        } catch {}
      }
    };

    const clearCompositionCommit = () => {
      compositionCommitPending = false;
      compositionCommitData = "";

      if (compositionCommitTimer) {
        clearTimeout(compositionCommitTimer);
        compositionCommitTimer = 0;
      }
    };

    const onKeyDown = event => {
      if (event.target !== textarea) {
        return;
      }

      const identity = keyIdentity(event);

      if (composing || event.isComposing || event.keyCode === 229) {
        if (!composing && event.keyCode === 229) {
          clearCompositionCommit();
        }

        passThroughKeys.add(identity);
        return;
      }

      clearCompositionCommit();

      const sequence = keySequence(event, terminal);

      if (sequence === PASSTHROUGH) {
        passThroughKeys.add(identity);
        return;
      }

      if (event.key === "Dead" || event.key === "AltGraph") {
        passThroughKeys.add(identity);
        return;
      }

      stop(event);

      if (sequence !== null) {
        event.preventDefault();
        clearTextarea();
        send(sequence);
      }
    };

    const onKeyUp = event => {
      if (event.target !== textarea) {
        return;
      }

      passThroughKeys.delete(keyIdentity(event));

      if (!composing && compositionCommitPending) {
        clearCompositionCommit();
      }
    };

    const onKeyPress = event => {
      if (event.target !== textarea) {
        return;
      }

      if (
        composing ||
        event.isComposing ||
        event.keyCode === 229 ||
        passThroughKeys.has(keyIdentity(event))
      ) {
        return;
      }

      stop(event);
    };

    const onCompositionStart = event => {
      if (event.target !== textarea) {
        return;
      }

      composing = true;
      clearCompositionCommit();
      scheduleTextareaPosition();
    };

    const onCompositionUpdate = event => {
      if (event.target === textarea) {
        scheduleTextareaPosition();
      }
    };

    const onCompositionEnd = event => {
      if (event.target !== textarea) {
        return;
      }

      composing = false;

      const committed = typeof event.data === "string" ? event.data : "";

      if (committed) {
        compositionCommitPending = true;
        compositionCommitData = committed;

        if (compositionCommitTimer) {
          clearTimeout(compositionCommitTimer);
        }

        compositionCommitTimer = setTimeout(clearCompositionCommit, 250);
      } else {
        clearCompositionCommit();
      }

      scheduleTextareaPosition();
    };

    const onInput = event => {
      if (event.target !== textarea) {
        return;
      }

      const inputType = String(event.inputType || "").toLowerCase();

      if (
        composing ||
        event.isComposing ||
        inputType.includes("composition")
      ) {
        return;
      }

      if (compositionCommitPending) {
        const value = textarea.value;
        const data = typeof event.data === "string" && event.data.length > 0
          ? event.data
          : value;

        if (
          inputType === "insertfromcomposition" ||
          data === compositionCommitData ||
          value === compositionCommitData
        ) {
          clearCompositionCommit();
          return;
        }

        clearCompositionCommit();
      }

      stop(event);

      if (inputType.startsWith("delete")) {
        clearTextarea();
        return;
      }

      const value = textarea.value;
      const data = typeof event.data === "string" && event.data.length > 0
        ? event.data
        : value;

      clearTextarea();
      send(data);
    };

    const onPaste = event => {
      if (event.target !== textarea) {
        return;
      }

      stop(event);

      const clipboard = event.clipboardData;
      if (!clipboard || typeof clipboard.getData !== "function") {
        return;
      }

      const text = clipboard.getData("text/plain");

      if (text) {
        event.preventDefault();
        clearTextarea();
        send(text);
      }
    };

    const disposables = [];

    if (typeof terminal.onCursorMove === "function") {
      disposables.push(terminal.onCursorMove(scheduleTextareaPosition));
    }

    if (typeof terminal.onResize === "function") {
      disposables.push(terminal.onResize(scheduleTextareaPosition));
    }


    eventRoot.addEventListener("keydown", onKeyDown, true);
    eventRoot.addEventListener("keyup", onKeyUp, true);
    eventRoot.addEventListener("keypress", onKeyPress, true);
    eventRoot.addEventListener("compositionstart", onCompositionStart, true);
    eventRoot.addEventListener("compositionupdate", onCompositionUpdate, true);
    eventRoot.addEventListener("compositionend", onCompositionEnd, true);
    eventRoot.addEventListener("input", onInput, true);
    eventRoot.addEventListener("paste", onPaste, true);

    clearTextarea();
    scheduleTextareaPosition();

    return {
      focus() {
        if (typeof terminal.focus === "function") {
          terminal.focus();
        } else if (typeof textarea.focus === "function") {
          textarea.focus();
        }
      },

      setEnabled(value) {
        enabled = Boolean(value);

        if (!enabled) {
          composing = false;
          clearCompositionCommit();
          passThroughKeys.clear();
          cancelTextareaPosition();
          clearTextarea();
        }
      },

      get enabled() {
        return enabled;
      },

      dispose() {
        eventRoot.removeEventListener("keydown", onKeyDown, true);
        eventRoot.removeEventListener("keyup", onKeyUp, true);
        eventRoot.removeEventListener("keypress", onKeyPress, true);
        eventRoot.removeEventListener("compositionstart", onCompositionStart, true);
        eventRoot.removeEventListener("compositionupdate", onCompositionUpdate, true);
        eventRoot.removeEventListener("compositionend", onCompositionEnd, true);
        eventRoot.removeEventListener("input", onInput, true);
        eventRoot.removeEventListener("paste", onPaste, true);

        clearCompositionCommit();
        passThroughKeys.clear();
        cancelTextareaPosition();

        for (const disposable of disposables) {
          disposable.dispose();
        }
      }
    };
  }

  return {
    install,
    keySequence
  };
});
