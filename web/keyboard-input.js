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

    if (event.ctrlKey && !event.altKey && !event.shiftKey) {
      const key = String(event.key || "").toLowerCase();

      if (key === "v") {
        return null;
      }

      if (key === "c") {
        if (
          typeof terminal.hasSelection === "function" &&
          terminal.hasSelection()
        ) {
          return PASSTHROUGH;
        }

        return "\x03";
      }

      if (key === "d") {
        return "\x04";
      }

      if (key === "z") {
        return "\x1a";
      }

      if (key === " " || key === "@") {
        return "\x00";
      }

      return PASSTHROUGH;
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

    if (
      !textarea ||
      typeof textarea.addEventListener !== "function" ||
      typeof terminal.input !== "function"
    ) {
      return null;
    }

    let enabled = Boolean(options.enabled);
    let composing = false;
    let suppressedComposition = "";
    let suppressionTimer = 0;

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

    const clearCompositionSuppression = () => {
      suppressedComposition = "";

      if (suppressionTimer) {
        clearTimeout(suppressionTimer);
        suppressionTimer = 0;
      }
    };

    const onKeyDown = event => {
      if (composing || event.isComposing || event.keyCode === 229) {
        stop(event);
        return;
      }

      const sequence = keySequence(event, terminal);

      if (sequence === PASSTHROUGH) {
        return;
      }

      stop(event);

      if (sequence !== null) {
        event.preventDefault();
        send(sequence);
      }
    };

    const onKeyUp = event => {
      stop(event);
    };

    const onKeyPress = event => {
      stop(event);
    };

    const onCompositionStart = event => {
      stop(event);
      clearCompositionSuppression();
      composing = true;
    };

    const onCompositionUpdate = event => {
      stop(event);
    };

    const onCompositionEnd = event => {
      stop(event);
      composing = false;

      const committed = typeof event.data === "string"
        ? event.data
        : "";

      if (committed) {
        send(committed);
        suppressedComposition = committed;
        suppressionTimer = setTimeout(() => {
          suppressedComposition = "";
          suppressionTimer = 0;
        }, 100);
        clearTextarea();
      } else {
        clearTextarea();
      }
    };

    const onInput = event => {
      stop(event);

      if (composing || event.isComposing) {
        return;
      }

      const value = textarea.value;

      if (
        suppressedComposition &&
        (
          String(event.inputType || "").toLowerCase().includes("composition") ||
          value === suppressedComposition
        )
      ) {
        clearCompositionSuppression();
        clearTextarea();
        return;
      }

      clearCompositionSuppression();
      clearTextarea();
      send(value);
    };

    const onPaste = event => {
      stop(event);

      const clipboard = event.clipboardData;
      if (!clipboard || typeof clipboard.getData !== "function") {
        return;
      }

      const text = clipboard.getData("text/plain");

      if (text) {
        event.preventDefault();
        send(text);
      }
    };

    textarea.addEventListener("keydown", onKeyDown, true);
    textarea.addEventListener("keyup", onKeyUp, true);
    textarea.addEventListener("keypress", onKeyPress, true);
    textarea.addEventListener("compositionstart", onCompositionStart, true);
    textarea.addEventListener("compositionupdate", onCompositionUpdate, true);
    textarea.addEventListener("compositionend", onCompositionEnd, true);
    textarea.addEventListener("input", onInput, true);
    textarea.addEventListener("paste", onPaste, true);

    clearTextarea();

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
          clearCompositionSuppression();
          clearTextarea();
        }
      },

      get enabled() {
        return enabled;
      },

      dispose() {
        textarea.removeEventListener("keydown", onKeyDown, true);
        textarea.removeEventListener("keyup", onKeyUp, true);
        textarea.removeEventListener("keypress", onKeyPress, true);
        textarea.removeEventListener("compositionstart", onCompositionStart, true);
        textarea.removeEventListener("compositionupdate", onCompositionUpdate, true);
        textarea.removeEventListener("compositionend", onCompositionEnd, true);
        textarea.removeEventListener("input", onInput, true);
        textarea.removeEventListener("paste", onPaste, true);
        clearCompositionSuppression();
      }
    };
  }

  return {
    install,
    keySequence
  };
});
