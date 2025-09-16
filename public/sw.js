
if (!self.define) {
  let e,
    s = {};
  const n = (n, t) => (
    (n = new URL(n + ".js", t).href),
    s[n] ||
      new Promise((s) => {
        if ("document" in self) {
          const e = document.createElement("script");
          (e.src = n), (e.onload = s), document.head.appendChild(e);
        } else (e = n), importScripts(n), s();
      }).then(() => {
        if (!s[n]) throw new Error(`Module ${n} did not register`);
        return s[n];
      })
  );
  self.define = (t, i) => {
    const c =
      e ||
      ("document" in self ? document.currentScript.src : "") ||
      location.href;
    if (s[c]) return;
    let o = {};
    const r = (e) => n(e, c),
      d = { module: { uri: c }, exports: o, require: r };
    s[c] = Promise.all(t.map((e) => d[e] || r(e))).then((e) => (i(...e), o));
  };
}
define(["./workbox-a797c385"], function (e) {
  "use strict";
  importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        {
          url: "/~offline",
          revision: "s2NNy8NE_tF_f6w5-R95j",
        },
      ],
      { ignoreURLParametersMatching: [/.*/] }
    );
    
    // --- Custom Share Target Logic ---
    const SHARE_TARGET_URL = '/amazon';

    async function handleShare(event) {
        const formData = await event.request.formData();
        const files = formData.getAll('image'); 
        const client = await self.clients.get(event.resultingClientId || event.clientId);

        if (client) {
             // If a client is already open, just send it the file.
            client.postMessage({ action: 'load-image', file: files[0] });
        } else {
            // If no client is open, open one and then send the file.
             const openClient = await self.clients.openWindow(SHARE_TARGET_URL);
             if (openClient) {
                 // Wait for the service worker to be ready before posting the message.
                 // This relies on the client page sending a 'share-ready' message.
                 self.addEventListener('message', (msgEvent) => {
                     if (msgEvent.data === 'share-ready' && msgEvent.source.id === openClient.id) {
                        openClient.postMessage({ action: 'load-image', file: files[0] });
                     }
                 });
             }
        }
        
        // After processing, navigate to the target URL.
        return Response.redirect(SHARE_TARGET_URL, 303);
    }

    e.registerRoute(
      ({ url }) => url.pathname === SHARE_TARGET_URL && url.search === '',
      handleShare,
      'POST'
    );
    // --- End Custom Logic ---
    
    e.cleanupOutdatedCaches();
    e.registerRoute(
    new e.NavigationRoute(e.createHandlerBoundToURL("/~offline"), {
      denylist: [/^\/api\//],
    })
  );
});

