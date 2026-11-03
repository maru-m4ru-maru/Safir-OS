const assert = require("node:assert/strict");
const { getTextDelta, install } = require("../web/ime-input-fix.js");

function createTerminal(initialValue) {
  const events = [];
  const helper = {
    _textarea: { value: initialValue },
    _isComposing: false,
    _dataAlreadySent: "",
    _coreService: {
      triggerDataEvent(data, userInput) {
        events.push({ data, userInput });
      }
    },
    _handleAnyTextareaChanges() {}
  };

  return {
    terminal: { _compositionHelper: helper },
    helper,
    events
  };
}

async function flushTimers() {
  await new Promise(resolve => setTimeout(resolve, 5));
}

async function run() {
  assert.deepEqual(
    getTextDelta("HELP WORLD", "HELP WORLDあ"),
    { removed: "", inserted: "あ" }
  );

  assert.deepEqual(
    getTextDelta("abc", "aXc"),
    { removed: "b", inserted: "X" }
  );

  assert.deepEqual(
    getTextDelta("abcd", "ad"),
    { removed: "bc", inserted: "" }
  );

  assert.deepEqual(
    getTextDelta("help", "あ"),
    { removed: "help", inserted: "あ" }
  );

  {
    const { terminal, helper, events } = createTerminal("HELP WORLD");
    assert.equal(install(terminal), true);

    helper._handleAnyTextareaChanges();
    helper._textarea.value = "HELP WORLDあ";
    await flushTimers();

    assert.deepEqual(events, [
      { data: "あ", userInput: true }
    ]);
    assert.equal(helper._dataAlreadySent, "あ");
  }

  {
    const { terminal, helper, events } = createTerminal("abc");
    assert.equal(install(terminal), true);

    helper._handleAnyTextareaChanges();
    helper._textarea.value = "aXc";
    await flushTimers();

    assert.deepEqual(events, [
      { data: "\x7f", userInput: true },
      { data: "X", userInput: true }
    ]);
  }

  {
    const { terminal, helper, events } = createTerminal("help");
    assert.equal(install(terminal), true);

    helper._handleAnyTextareaChanges();
    helper._textarea.value = "あ";
    await flushTimers();

    assert.deepEqual(events, [
      { data: "\x7f\x7f\x7f\x7f", userInput: true },
      { data: "あ", userInput: true }
    ]);
  }

  {
    const { terminal, helper, events } = createTerminal("abc");
    assert.equal(install(terminal), true);

    helper._handleAnyTextareaChanges();
    helper._textarea.value = "あ";
    helper._isComposing = true;
    await flushTimers();

    assert.deepEqual(events, []);
  }

  process.stdout.write("xterm.js IME textarea-diff regression tests passed.\n");
}

run().catch(error => {
  process.stderr.write(String(error.stack || error) + "\n");
  process.exitCode = 1;
});
