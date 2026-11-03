const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(
  require.resolve("../web/coi-serviceworker.js"),
  "utf8"
);

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function createPage(options = {}) {
  const listeners = new Map();
  const storage = makeStorage(options.storage);
  const registration = options.registration || {
    scope: "https://example.test/Safir-OS/",
    active: {
      state: "activated",
      scriptURL: "https://example.test/Safir-OS/coi-serviceworker.js"
    },
    waiting: null,
    installing: null
  };
  const serviceWorker = {
    controller: options.controller || null,
    registerCalls: 0,
    register() {
      this.registerCalls += 1;
      return Promise.resolve(registration);
    },
    ready: Promise.resolve(registration),
    addEventListener(name, callback) {
      if (!listeners.has(name)) {
        listeners.set(name, new Set());
      }
      listeners.get(name).add(callback);
    },
    removeEventListener(name, callback) {
      if (listeners.has(name)) {
        listeners.get(name).delete(callback);
      }
    }
  };
  let reloads = 0;
  const window = {
    isSecureContext: true,
    crossOriginIsolated: Boolean(options.crossOriginIsolated),
    sessionStorage: storage,
    location: {
      reload() {
        reloads += 1;
      }
    }
  };
  const sandbox = {
    window,
    document: {
      currentScript: {
        src: "https://example.test/Safir-OS/coi-serviceworker.js"
      }
    },
    navigator: { serviceWorker },
    location: {
      href: options.pageUrl || "https://example.test/Safir-OS/"
    },
    SharedArrayBuffer: options.crossOriginIsolated
      ? SharedArrayBuffer
      : undefined,
    URL,
    Headers,
    Response,
    fetch: options.fetch || (async () => new Response("ok", {
      status: 200,
      headers: options.headers || {}
    })),
    setTimeout,
    clearTimeout,
    Promise
  };

  vm.runInNewContext(source, sandbox, {
    filename: "coi-serviceworker.js"
  });

  return {
    window,
    serviceWorker,
    registration,
    get reloads() {
      return reloads;
    },
    storage
  };
}

async function run() {
  {
    const page = createPage();
    await new Promise(resolve => setTimeout(resolve, 1100));
    assert.equal(page.reloads, 1);
    assert.equal(
      page.storage.getItem("safiros-coi-bootstrap-v4"),
      "1"
    );
  }

  {
    const page = createPage({
      storage: { "safiros-coi-bootstrap-v4": "1" }
    });

    await assert.rejects(
      page.window.COI_READY,
      error => {
        assert.match(error.message, /not controlled/);
        assert.match(error.message, /pageInScope=true/);
        assert.match(error.message, /active=activated/);
        assert.match(error.message, /reloadCount=1/);
        return true;
      }
    );

    assert.equal(page.reloads, 0);
  }

  {
    const page = createPage({
      pageUrl: "https://example.test/other-path/"
    });

    await assert.rejects(
      page.window.COI_READY,
      /scope does not include this page.*pageInScope=false/
    );

    assert.equal(page.reloads, 0);
  }

  {
    const page = createPage({ crossOriginIsolated: true });

    assert.equal(await page.window.COI_READY, true);
    assert.equal(page.serviceWorker.registerCalls, 0);
    assert.equal(
      page.storage.getItem("safiros-coi-bootstrap-v4"),
      null
    );
  }

  {
    const page = createPage({
      controller: {
        state: "activated",
        scriptURL: "https://example.test/Safir-OS/coi-serviceworker.js"
      },
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp"
      }
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(page.reloads, 1);
    assert.equal(
      page.storage.getItem("safiros-coi-bootstrap-v4"),
      "1"
    );
  }

  {
    const listeners = new Map();
    let skipped = false;
    let claimed = false;
    const workerScope = {
      addEventListener(name, callback) {
        listeners.set(name, callback);
      },
      skipWaiting() {
        skipped = true;
        return Promise.resolve();
      },
      clients: {
        claim() {
          claimed = true;
          return Promise.resolve();
        }
      }
    };

    vm.runInNewContext(source, {
      self: workerScope,
      Promise,
      URL,
      Headers,
      Response,
      fetch
    });

    let installWait;
    listeners.get("install")({
      waitUntil(value) {
        installWait = value;
      }
    });
    await installWait;

    let activateWait;
    listeners.get("activate")({
      waitUntil(value) {
        activateWait = value;
      }
    });
    await activateWait;

    assert.equal(skipped, true);
    assert.equal(claimed, true);
    assert.equal(typeof listeners.get("fetch"), "function");
  }

  process.stdout.write(
    "COI service-worker lifecycle regression tests passed.\n"
  );
}

run().catch(error => {
  process.stderr.write(String(error.stack || error) + "\n");
  process.exitCode = 1;
});
