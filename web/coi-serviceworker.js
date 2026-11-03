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
  const reloadKey = "safiros-coi-reload-v2";

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
      { scope }
    );

    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Timed out waiting for the COI service worker")),
          20000
        );
      })
    ]);

    const worker = registration.installing || registration.waiting;
    if (worker) {
      await new Promise((resolve, reject) => {
        const checkState = () => {
          if (worker.state === "activated") {
            worker.removeEventListener("statechange", checkState);
            resolve();
          } else if (worker.state === "redundant") {
            worker.removeEventListener("statechange", checkState);
            reject(new Error("The COI service worker became redundant"));
          }
        };

        worker.addEventListener("statechange", checkState);
        checkState();
      });
    }

    if (
      window.crossOriginIsolated &&
      typeof SharedArrayBuffer !== "undefined"
    ) {
      sessionStorage.removeItem(reloadKey);
      return true;
    }

    if (sessionStorage.getItem(reloadKey) === "1") {
      throw new Error(
        "The COI service worker is active, but this page is still not isolated. " +
        "Check whether service workers are blocked for this site."
      );
    }

    sessionStorage.setItem(reloadKey, "1");
    window.location.reload();

    return new Promise(() => {});
  })();
})();
