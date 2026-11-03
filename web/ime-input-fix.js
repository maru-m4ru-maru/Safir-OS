(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SafirOSImeFix = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  "use strict";

  function getTextDelta(previous, current) {
    let prefix = 0;

    while (
      prefix < previous.length &&
      prefix < current.length &&
      previous[prefix] === current[prefix]
    ) {
      prefix += 1;
    }

    let suffix = 0;

    while (
      suffix < previous.length - prefix &&
      suffix < current.length - prefix &&
      previous[previous.length - 1 - suffix] ===
        current[current.length - 1 - suffix]
    ) {
      suffix += 1;
    }

    return {
      removed: previous.slice(prefix, previous.length - suffix),
      inserted: current.slice(prefix, current.length - suffix)
    };
  }

  function install(terminal) {
    const core = terminal && (terminal._core || terminal);
    const helper = core && core._compositionHelper;

    if (
      !helper ||
      typeof helper._handleAnyTextareaChanges !== "function" ||
      !helper._textarea ||
      !helper._coreService ||
      typeof helper._coreService.triggerDataEvent !== "function"
    ) {
      return false;
    }

    helper._textareaChangeTimer = null;

    helper._handleAnyTextareaChanges = function () {
      if (this._textareaChangeTimer !== null) {
        return;
      }

      const previous = this._textarea.value;

      this._textareaChangeTimer = setTimeout(() => {
        this._textareaChangeTimer = null;

        if (this._isComposing) {
          return;
        }

        const current = this._textarea.value;
        const delta = getTextDelta(previous, current);
        const deleteCount = Array.from(delta.removed).length;

        this._dataAlreadySent = delta.inserted;

        if (deleteCount > 0) {
          this._coreService.triggerDataEvent(
            "\x7f".repeat(deleteCount),
            true
          );
        }

        if (delta.inserted.length > 0) {
          this._coreService.triggerDataEvent(delta.inserted, true);
        }
      }, 0);
    };

    return true;
  }

  return {
    getTextDelta,
    install
  };
});
