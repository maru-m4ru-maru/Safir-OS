/*! coi-serviceworker compatibility bootstrap for static hosts; MIT license */
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
  const reloadKey = "safiros-coi-reload-v3";

  function waitForController(timeoutMs) {
    if (navigator.serviceWorker.controller) {
      return Promise.resolve(navigator.serviceWorker.controller);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          checkController
        );
        reject(new Error(
          "The COI service worker is active but does not control this page. " +
          "Check the site's service-worker permission. Scope=" + scope
        ));
      }, timeoutMs);

      function checkController() {
        const controller = navigator.serviceWorker.controller;
        if (!controller) {
          return;
        }

        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          checkController
        );
        resolve(controller);
      }

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        checkController
      );
      checkController();
    });
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
      sessionStorage.removeItem(reloadKey);
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

    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(
            "Timed out waiting for the COI service worker"
          )),
          20000
        );
      })
    ]);

    await waitForController(15000);

    if (
      window.crossOriginIsolated &&
      typeof SharedArrayBuffer !== "undefined"
    ) {
      sessionStorage.removeItem(reloadKey);
      return true;
    }

    const headers = await inspectIsolationHeaders();

    if (
      headers.coop !== "same-origin" ||
      headers.coep !== "require-corp"
    ) {
      if (sessionStorage.getItem(reloadKey) === "1") {
        throw new Error(
          "The COI service worker controls this page, but the required " +
          "response headers are missing. HTTP=" + headers.status +
          ", COOP=" + String(headers.coop) +
          ", COEP=" + String(headers.coep) +
          ", scope=" + scope
        );
      }

      sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
      return new Promise(() => {});
    }

    if (sessionStorage.getItem(reloadKey) === "1") {
      throw new Error(
        "COOP and COEP headers are present, but this document is still " +
        "not cross-origin isolated. HTTP=" + headers.status +
        ", COOP=" + String(headers.coop) +
        ", COEP=" + String(headers.coep) +
        ", controller=" + String(Boolean(navigator.serviceWorker.controller))
      );
    }

    sessionStorage.setItem(reloadKey, "1");
    window.location.reload();

    return new Promise(() => {});
  })();
})();
