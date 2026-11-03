(function () {
  if (typeof window === "undefined") {
    self.addEventListener("install", event => {
      event.waitUntil(self.skipWaiting());
    });

    self.addEventListener("activate", event => {
      event.waitUntil(self.clients.claim());
    });

    self.addEventListener("fetch", event => {
      const request = event.request;

      if (
        request.cache === "only-if-cached" &&
        request.mode !== "same-origin"
      ) {
        return;
      }

      event.respondWith(
        fetch(request).then(response => {
          if (response.status === 0) {
            return response;
          }

          const headers = new Headers(response.headers);
          headers.set("Cross-Origin-Opener-Policy", "same-origin");
          headers.set("Cross-Origin-Embedder-Policy", "require-corp");
          headers.set("Cross-Origin-Resource-Policy", "cross-origin");

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
          });
        })
      );
    });

    return;
  }

  const scriptUrl = document.currentScript.src;
  const scope = new URL("./", scriptUrl).pathname;
  const reloadKey = "safiros-coi-bootstrap-v4";
  const controllerWaitMs = 1000;

  function workerState(worker) {
    if (!worker) {
      return "none";
    }

    return worker.state + " @ " + worker.scriptURL;
  }

  function diagnostics(registration) {
    const registrationScope = registration
      ? registration.scope
      : "unavailable";
    const pageUrl = new URL(location.href);
    const scopeUrl = new URL(registrationScope, location.href);
    const pageInScope = pageUrl.origin === scopeUrl.origin &&
      pageUrl.pathname.startsWith(scopeUrl.pathname);

    return [
      "page=" + location.href,
      "expectedScope=" + scope,
      "registrationScope=" + registrationScope,
      "pageInScope=" + pageInScope,
      "secureContext=" + window.isSecureContext,
      "controller=" + workerState(navigator.serviceWorker.controller),
      "active=" + workerState(registration && registration.active),
      "waiting=" + workerState(registration && registration.waiting),
      "installing=" + workerState(registration && registration.installing),
      "reloadCount=" + String(window.sessionStorage.getItem(reloadKey) || "0")
    ].join("; ");
  }

  function withTimeout(promise, timeoutMs, message) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);

      Promise.resolve(promise).then(
        value => {
          clearTimeout(timeout);
          resolve(value);
        },
        error => {
          clearTimeout(timeout);
          reject(error);
        }
      );
    });
  }

  function waitForController(timeoutMs) {
    if (navigator.serviceWorker.controller) {
      return Promise.resolve(navigator.serviceWorker.controller);
    }

    return new Promise(resolve => {
      let finished = false;

      const finish = controller => {
        if (finished) {
          return;
        }

        finished = true;
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          checkController
        );
        resolve(controller || null);
      };

      const checkController = () => {
        const controller = navigator.serviceWorker.controller;
        if (controller) {
          finish(controller);
        }
      };

      const timeout = setTimeout(() => finish(null), timeoutMs);

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        checkController
      );
      checkController();
    });
  }

  function reloadForServiceWorker(reason, registration) {
    const reloadCount = Math.max(
      0,
      Number(window.sessionStorage.getItem(reloadKey) || "0") || 0
    );

    if (reloadCount >= 1) {
      throw new Error(
        reason + " Bootstrap diagnostics: " + diagnostics(registration)
      );
    }

    window.sessionStorage.setItem(reloadKey, String(reloadCount + 1));
    window.location.reload();
    return new Promise(() => {});
  }

  async function inspectIsolationHeaders() {
    const response = await fetch(location.href, {
      cache: "no-store",
      credentials: "same-origin"
    });

    return {
      status: response.status,
      coop: response.headers.get("Cross-Origin-Opener-Policy"),
      coep: response.headers.get("Cross-Origin-Embedder-Policy"),
      corp: response.headers.get("Cross-Origin-Resource-Policy")
    };
  }

  window.COI_READY = (async () => {
    if (
      window.crossOriginIsolated &&
      typeof SharedArrayBuffer !== "undefined"
    ) {
      window.sessionStorage.removeItem(reloadKey);
      return true;
    }

    if (!window.isSecureContext) {
      throw new Error("COI requires HTTPS or localhost");
    }

    if (!navigator.serviceWorker) {
      throw new Error("This browser does not support service workers");
    }

    const registration = await navigator.serviceWorker.register(
      scriptUrl,
      {
        scope,
        updateViaCache: "none"
      }
    );

    const readyRegistration = await withTimeout(
      navigator.serviceWorker.ready,
      20000,
      "Timed out waiting for the COI service worker. " +
      "Bootstrap diagnostics: " + diagnostics(registration)
    );

    const activeRegistration = readyRegistration || registration;
    const registrationScope = new URL(activeRegistration.scope);
    const pageUrl = new URL(location.href);

    if (
      pageUrl.origin !== registrationScope.origin ||
      !pageUrl.pathname.startsWith(registrationScope.pathname)
    ) {
      throw new Error(
        "The COI service worker scope does not include this page. " +
        "Bootstrap diagnostics: " + diagnostics(activeRegistration)
      );
    }

    const controller = await waitForController(controllerWaitMs);

    if (!controller) {
      return reloadForServiceWorker(
        "The COI service worker is active but this page is not controlled.",
        activeRegistration
      );
    }

    if (
      window.crossOriginIsolated &&
      typeof SharedArrayBuffer !== "undefined"
    ) {
      window.sessionStorage.removeItem(reloadKey);
      return true;
    }

    const headers = await inspectIsolationHeaders();

    if (
      headers.coop !== "same-origin" ||
      headers.coep !== "require-corp"
    ) {
      return reloadForServiceWorker(
        "The COI service worker controls this page, but the required " +
        "response headers are missing. HTTP=" + headers.status +
        ", COOP=" + String(headers.coop) +
        ", COEP=" + String(headers.coep) +
        ", CORP=" + String(headers.corp),
        activeRegistration
      );
    }

    return reloadForServiceWorker(
      "COOP and COEP headers are present, but this document is still " +
      "not cross-origin isolated. HTTP=" + headers.status +
      ", COOP=" + String(headers.coop) +
      ", COEP=" + String(headers.coep) +
      ", CORP=" + String(headers.corp),
      activeRegistration
    );
  })();
})();
