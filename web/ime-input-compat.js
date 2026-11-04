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

    const getInsertedTextDelta = (before, after) => {
      const delta = getTextDelta(before, after);
      return delta === "\x7f" || /^\x7f+$/.test(delta) ? "" : delta;
    };

    const clearPending229 = pending => {
      if (!pending || pending !== pending229) {
        return;
      }

      if (pending.timer) {
        clearTimeout(pending.timer);
      }

      pending229 = null;
    };

    const onData = terminal.onData(data => {
      dataVersion++;

      if (pending229) {
        pending229.observedData += data;
      }

      if (data.includes("\r") || data.includes("\x03")) {
        lastTextareaValue = textarea.value;
        beforeInputValue = textarea.value;
      }
    });

    const finishInputEvent = (data, pending, versionBeforeInput) => {
      if (dataVersion === versionBeforeInput) {
        terminal.input(data, true);
      }

      if (pending && pending === pending229) {
        pending.value = textarea.value;
        pending.observedData = "";
        pending.inputHandled = true;
        schedulePending229Cleanup(pending);
      }

      lastTextareaValue = textarea.value;
      beforeInputValue = textarea.value;
    };

    const sendIfMissing = (data, pending) => {
      if (!data) {
        return;
      }

      const versionBeforeInput = dataVersion;
      const finish = () => finishInputEvent(data, pending, versionBeforeInput);

      if (compositionCommitPending) {
        setTimeout(() => setTimeout(finish, 0), 0);
      } else {
        Promise.resolve().then(finish);
      }
    };

    const schedulePending229Cleanup = pending => {
      if (!pending || pending !== pending229) {
        return;
      }

      if (pending.timer) {
        clearTimeout(pending.timer);
      }

      pending.timer = setTimeout(() => {
        flushPending229(pending, true);
      }, 35);
    };

    const flushPending229 = (pending, final = false) => {
      if (!pending || pending !== pending229) {
        return;
      }

      const data = getInsertedTextDelta(pending.value, textarea.value);

      if (data) {
        const alreadySent = pending.observedData.endsWith(data);

        if (!alreadySent) {
          terminal.input(data, true);
        }

        pending.value = textarea.value;
        pending.observedData = "";
        pending.inputHandled = true;
      }

      lastTextareaValue = textarea.value;
      beforeInputValue = textarea.value;

      if (final) {
        clearPending229(pending);
      } else {
        schedulePending229Cleanup(pending);
      }
    };

    const onCompositionStart = () => {
      if (pending229) {
        flushPending229(pending229, true);
      }

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

      if (
        composing ||
        event.isComposing ||
        inputType === "insertcompositiontext" ||
        inputType === "deletecompositiontext"
      ) {
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
      const valueDelta = pending
        ? getInsertedTextDelta(previousValue, currentValue)
        : getTextDelta(previousValue, currentValue);

      let data = "";

      if (inputType.startsWith("delete")) {
        data = valueDelta || "\x7f";
      } else if (valueDelta) {
        data = valueDelta;
      } else if (typeof event.data === "string" && event.data.length > 0) {
        data = event.data;
      }

      beforeInputValue = currentValue;
      lastTextareaValue = currentValue;

      if (!data) {
        return;
      }

      if (pending) {
        pending.value = currentValue;

        if (pending.observedData.endsWith(data)) {
          pending.observedData = "";
          pending.inputHandled = true;
          schedulePending229Cleanup(pending);
          return;
        }
      }

      sendIfMissing(data, pending);
    };

    const onBlur = () => {
      if (pending229) {
        flushPending229(pending229, true);
      }

      setTimeout(() => {
        lastTextareaValue = textarea.value;
        beforeInputValue = textarea.value;
      }, 0);
    };

    const customKeyEventHandler = event => {
      if (
        event.type === "keydown" &&
        event.keyCode !== 229 &&
        pending229
      ) {
        flushPending229(pending229, true);
      }

      if (
        event.type === "keyup" &&
        pending229 &&
        !pending229.inputHandled
      ) {
        const pending = pending229;
        setTimeout(() => flushPending229(pending), 0);
      }

      if (
        event.type === "keydown" &&
        event.keyCode === 229 &&
        !composing
      ) {
        if (pending229) {
          flushPending229(pending229, true);
        }

        const baseline = beforeInputValue !== null
          ? beforeInputValue
          : lastTextareaValue;

        pending229 = {
          value:baseline,
          observedData:"",
          inputHandled:false,
          timer:0
        };

        schedulePending229Cleanup(pending229);
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
    eventRoot.addEventListener("blur", onBlur, true);

    return {
      dispose() {
        eventRoot.removeEventListener("compositionstart", onCompositionStart, true);
        eventRoot.removeEventListener("compositionupdate", onCompositionUpdate, true);
        eventRoot.removeEventListener("compositionend", onCompositionEnd, true);
        eventRoot.removeEventListener("beforeinput", onBeforeInput, true);
        eventRoot.removeEventListener("input", onInput, true);
        eventRoot.removeEventListener("blur", onBlur, true);

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
