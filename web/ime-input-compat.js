(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SafirOSInputCompatibility = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  "use strict";

  function install(terminal) {
    const textarea = terminal && terminal.textarea;
    const eventRoot = terminal && terminal.element;

    if (
      !textarea ||
      !eventRoot ||
      typeof terminal.input !== "function" ||
      typeof terminal.onData !== "function" ||
      typeof terminal.attachCustomKeyEventHandler !== "function"
    ) {
      return null;
    }

    if (terminal.options && terminal.options.screenReaderMode) {
      return null;
    }

    let composing = false;
    let compositionPreview = "";
    let compositionCommitPending = false;
    let compositionCommitTimer = 0;
    let dataVersion = 0;

    const clearCompositionCommit = () => {
      compositionCommitPending = false;

      if (compositionCommitTimer) {
        clearTimeout(compositionCommitTimer);
        compositionCommitTimer = 0;
      }
    };

    const onData = terminal.onData(() => {
      dataVersion++;
    });

    const onCompositionStart = () => {
      composing = true;
      compositionPreview = "";
      clearCompositionCommit();
    };

    const onCompositionUpdate = event => {
      if (typeof event.data === "string") {
        compositionPreview = event.data;
      }
    };

    const onCompositionEnd = event => {
      composing = false;

      const committed = typeof event.data === "string" && event.data.length > 0
        ? event.data
        : compositionPreview;

      if (!committed) {
        clearCompositionCommit();
        return;
      }

      compositionCommitPending = true;

      if (compositionCommitTimer) {
        clearTimeout(compositionCommitTimer);
      }

      compositionCommitTimer = setTimeout(() => {
        compositionCommitTimer = setTimeout(clearCompositionCommit, 0);
      }, 0);
    };

    const onInput = event => {
      if (event.target !== textarea) {
        return;
      }

      const inputType = String(event.inputType || "").toLowerCase();

      if (
        composing ||
        event.isComposing ||
        inputType.includes("composition") ||
        compositionCommitPending
      ) {
        return;
      }

      if (
        inputType !== "inserttext" &&
        inputType !== "insertreplacementtext"
      ) {
        return;
      }

      if (typeof event.data !== "string" || event.data.length === 0) {
        return;
      }

      const versionBeforeInput = dataVersion;
      const inputData = event.data;

      Promise.resolve().then(() => {
        if (dataVersion === versionBeforeInput) {
          terminal.input(inputData, true);
        }
      });
    };

    const customKeyEventHandler = event => {
      if (
        event.type === "keydown" &&
        event.keyCode === 229 &&
        !composing
      ) {
        return false;
      }

      return true;
    };

    terminal.attachCustomKeyEventHandler(customKeyEventHandler);

    eventRoot.addEventListener("compositionstart", onCompositionStart, true);
    eventRoot.addEventListener("compositionupdate", onCompositionUpdate, true);
    eventRoot.addEventListener("compositionend", onCompositionEnd, true);
    eventRoot.addEventListener("input", onInput, true);

    return {
      dispose() {
        eventRoot.removeEventListener("compositionstart", onCompositionStart, true);
        eventRoot.removeEventListener("compositionupdate", onCompositionUpdate, true);
        eventRoot.removeEventListener("compositionend", onCompositionEnd, true);
        eventRoot.removeEventListener("input", onInput, true);

        clearCompositionCommit();
        onData.dispose();
        terminal.attachCustomKeyEventHandler(() => true);
      }
    };
  }

  return {install};
});
