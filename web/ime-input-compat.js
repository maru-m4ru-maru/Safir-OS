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
      typeof terminal.onKey !== "function" ||
      typeof terminal.attachCustomKeyEventHandler !== "function"
    ) {
      return null;
    }

    if (terminal.options && terminal.options.screenReaderMode) {
      return null;
    }

    let composing = false;
    let compositionCommitPending = false;
    let compositionCommitTimer = 0;
    let dataVersion = 0;
    let lastTextareaValue = textarea.value;
    let beforeInputValue = null;

    const pendingKeys = [];
    const pending229 = [];

    const removePending = (items, item) => {
      const index = items.indexOf(item);

      if (index !== -1) {
        items.splice(index, 1);
      }
    };

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

    const onKey = terminal.onKey(({key, domEvent}) => {
      if (
        !domEvent ||
        (domEvent.type !== "keydown" && domEvent.type !== "keypress") ||
        typeof key !== "string" ||
        Array.from(key).length !== 1
      ) {
        return;
      }

      const pending = {key};
      pendingKeys.push(pending);

      setTimeout(() => {
        removePending(pendingKeys, pending);
      }, 120);
    });

    const onCompositionStart = () => {
      composing = true;
      clearCompositionCommit();
      beforeInputValue = null;
      lastTextareaValue = textarea.value;
    };

    const onCompositionEnd = () => {
      composing = false;
      compositionCommitPending = true;

      if (compositionCommitTimer) {
        clearTimeout(compositionCommitTimer);
      }

      compositionCommitTimer = setTimeout(clearCompositionCommit, 120);
    };

    const onBeforeInput = event => {
      if (event.target === textarea) {
        beforeInputValue = textarea.value;
      }
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
        lastTextareaValue = textarea.value;
        beforeInputValue = null;
        return;
      }

      if (
        (inputType !== "inserttext" && inputType !== "insertreplacementtext") ||
        typeof event.data !== "string" ||
        event.data.length === 0
      ) {
        lastTextareaValue = textarea.value;
        beforeInputValue = null;
        return;
      }

      const matchingKey = pendingKeys.find(
        pending => pending.key === event.data
      );

      if (matchingKey) {
        removePending(pendingKeys, matchingKey);
        lastTextareaValue = textarea.value;
        beforeInputValue = null;
        return;
      }

      const versionBeforeInput = dataVersion;
      const inputData = event.data;
      const pending229Entry = pending229.shift();
      const previousValue = pending229Entry
        ? pending229Entry.value
        : beforeInputValue !== null
          ? beforeInputValue
          : lastTextareaValue;

      beforeInputValue = null;

      Promise.resolve().then(() => {
        const xtermHandledInput = dataVersion !== versionBeforeInput;

        if (!xtermHandledInput) {
          terminal.input(inputData, true);
        }

        if (!xtermHandledInput || pending229Entry) {
          textarea.value = previousValue;

          if (typeof textarea.setSelectionRange === "function") {
            try {
              textarea.setSelectionRange(
                previousValue.length,
                previousValue.length
              );
            } catch {}
          }

          lastTextareaValue = previousValue;
        } else {
          lastTextareaValue = textarea.value;
        }
      });
    };

    const customKeyEventHandler = event => {
      if (
        event.type === "keydown" &&
        event.keyCode === 229 &&
        !composing &&
        !compositionCommitPending
      ) {
        const pending = {
          key:event.key,
          value:textarea.value
        };

        pending229.push(pending);

        setTimeout(() => {
          removePending(pending229, pending);
        }, 120);
      }

      return true;
    };

    terminal.attachCustomKeyEventHandler(customKeyEventHandler);

    eventRoot.addEventListener("compositionstart", onCompositionStart, true);
    eventRoot.addEventListener("compositionend", onCompositionEnd, true);
    eventRoot.addEventListener("beforeinput", onBeforeInput, true);
    eventRoot.addEventListener("input", onInput, true);

    return {
      dispose() {
        eventRoot.removeEventListener("compositionstart", onCompositionStart, true);
        eventRoot.removeEventListener("compositionend", onCompositionEnd, true);
        eventRoot.removeEventListener("beforeinput", onBeforeInput, true);
        eventRoot.removeEventListener("input", onInput, true);

        clearCompositionCommit();
        pendingKeys.length = 0;
        pending229.length = 0;

        onData.dispose();
        onKey.dispose();
        terminal.attachCustomKeyEventHandler(() => true);
      }
    };
  }

  return {install};
});
