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
    let beforeInputValue = textarea.value;
    let lastTextareaValue = textarea.value;
    let pending229 = null;

    const clearCompositionCommit = () => {
      compositionCommitPending = false;

      if (compositionCommitTimer) {
        clearTimeout(compositionCommitTimer);
        compositionCommitTimer = 0;
      }
    };

    const getTextDelta = (before, after) => {
      if (before === after) {
        return "";
      }

      let prefix = 0;
      const maxPrefix = Math.min(before.length, after.length);

      while (prefix < maxPrefix && before[prefix] === after[prefix]) {
        prefix++;
      }

      let suffix = 0;

      while (
        suffix < before.length - prefix &&
        suffix < after.length - prefix &&
        before[before.length - suffix - 1] === after[after.length - suffix - 1]
      ) {
        suffix++;
      }

      const inserted = after.slice(prefix, after.length - suffix);

      if (inserted.length > 0) {
        return inserted;
      }

      const removed = before.length - prefix - suffix;

      return removed > 0 ? "\x7f".repeat(removed) : "";
    };

    const onData = terminal.onData(() => {
      dataVersion++;
    });

    const sendIfMissing = (data, pending, delayCompositionFlush) => {
      if (!data) {
        return;
      }

      const versionBeforeInput = dataVersion;
      const finish = () => {
        if (dataVersion === versionBeforeInput) {
          terminal.input(data, true);
        }

        if (pending && pending === pending229) {
          pending.value = textarea.value;
          pending.inputHandled = true;
        }

        lastTextareaValue = textarea.value;
        beforeInputValue = textarea.value;
      };

      if (delayCompositionFlush) {
        setTimeout(() => setTimeout(finish, 0), 0);
      } else {
        Promise.resolve().then(finish);
      }
    };

    const flushPending229 = pending => {
      if (!pending || pending !== pending229 || pending.inputHandled) {
        return;
      }

      const data = getTextDelta(pending.value, textarea.value);

      if (data) {
        const versionBeforeInput = dataVersion;

        if (pending.emittedData.length === 0 && dataVersion === versionBeforeInput) {
          terminal.input(data, true);
        }
      }

      pending.inputHandled = true;
      pending.value = textarea.value;
      lastTextareaValue = textarea.value;
      beforeInputValue = textarea.value;

      if (pending.timer) {
        clearTimeout(pending.timer);
      }

      pending229 = null;
    };

    const schedulePending229Check = pending => {
      if (!pending || pending !== pending229 || pending.inputHandled) {
        return;
      }

      if (pending.timer) {
        clearTimeout(pending.timer);
      }

      pending.timer = setTimeout(() => {
        flushPending229(pending);
      }, 35);
    };

    const onCompositionStart = () => {
      composing = true;
      compositionPreview = "";
      clearCompositionCommit();
      beforeInputValue = textarea.value;
      lastTextareaValue = textarea.value;
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

      if (composing || event.isComposing || inputType === "insertcompositiontext" || inputType === "deletecompositiontext") {
        lastTextareaValue = textarea.value;
        beforeInputValue = textarea.value;
        return;
      }

      const pending = pending229;
      const previousValue = pending
        ? pending.value
        : beforeInputValue !== null
          ? beforeInputValue
          : lastTextareaValue;
      const currentValue = textarea.value;
      const valueDelta = getTextDelta(previousValue, currentValue);

      let data = "";

      if (inputType.startsWith("delete")) {
        data = valueDelta || "\x7f";
      } else if (pending && valueDelta) {
        data = valueDelta;
      } else if (typeof event.data === "string" && event.data.length > 0) {
        data = event.data;
      } else {
        data = valueDelta;
      }

      beforeInputValue = currentValue;
      lastTextareaValue = currentValue;

      if (!data) {
        return;
      }

      const delayCompositionFlush =
        compositionCommitPending && inputType.includes("composition");

      if (pending) {
        pending.value = currentValue;
        pending.inputHandled = false;
      }

      sendIfMissing(data, pending, delayCompositionFlush);
    };

    const customKeyEventHandler = event => {
      if (event.type === "keyup" && pending229) {
        setTimeout(() => {
          if (pending229 && !pending229.inputHandled) {
            const pending = pending229;
            const data = getTextDelta(pending.value, textarea.value);

            if (data) {
              const versionBeforeInput = dataVersion;

              if (
                pending.emittedData.length === 0 &&
                dataVersion === versionBeforeInput
              ) {
                terminal.input(data, true);
              }

              pending.inputHandled = true;
              pending.value = textarea.value;
              lastTextareaValue = textarea.value;
              beforeInputValue = textarea.value;
            }
          }
        }, 0);
      }

      if (
        event.type === "keydown" &&
        event.keyCode === 229 &&
        !composing
      ) {
        if (pending229) {
          schedulePending229Check(pending229);
        } else {
          pending229 = {
            value:textarea.value,
            emittedData:"",
            inputHandled:false,
            timer:0
          };
          schedulePending229Check(pending229);
        }

        return false;
      }

      return true;
    };

    terminal.attachCustomKeyEventHandler(customKeyEventHandler);

    eventRoot.addEventListener("compositionstart", onCompositionStart, true);
    eventRoot.addEventListener("compositionupdate", onCompositionUpdate, true);
    eventRoot.addEventListener("compositionend", onCompositionEnd, true);
    eventRoot.addEventListener("beforeinput", onBeforeInput, true);
    eventRoot.addEventListener("input", onInput, true);

    return {
      dispose() {
        eventRoot.removeEventListener("compositionstart", onCompositionStart, true);
        eventRoot.removeEventListener("compositionupdate", onCompositionUpdate, true);
        eventRoot.removeEventListener("compositionend", onCompositionEnd, true);
        eventRoot.removeEventListener("beforeinput", onBeforeInput, true);
        eventRoot.removeEventListener("input", onInput, true);

        clearCompositionCommit();

        if (pending229 && pending229.timer) {
          clearTimeout(pending229.timer);
        }

        pending229 = null;
        onData.dispose();
        terminal.attachCustomKeyEventHandler(() => true);
      }
    };
  }

  return {install};
});
