
// This is a custom service worker file.

// It's recommended to read this to understand how the share target works:
// https://web.dev/articles/workbox-share-targets

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname === '/planogram') {
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const imageFiles = formData.getAll('images');

      if (imageFiles.length > 0) {
        const file = imageFiles[0];
        
        // Find the correct client to send the image to
        const clients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        
        // Find the planogram page specifically, or fall back to any client
        let targetClient = clients.find(c => c.url.includes('/planogram'));
        if (!targetClient && clients.length > 0) {
            targetClient = clients[0];
        }

        if (targetClient) {
          // Send the file to the client page.
          targetClient.postMessage({ file, action: 'load-image' });
          // Redirect the user to the planogram page
          return Response.redirect('/planogram', 303);
        } else {
          // If no client is open, we can't send the file.
          // This case is less likely but good to handle.
          console.error("No open client to send shared image to.");
          // We can still redirect, and the user can upload manually.
          return Response.redirect('/planogram', 303);
        }
      } else {
        // If no file, just redirect.
        return Response.redirect('/planogram', 303);
      }
    })());
  }
});

// A simple listener to let the client know the SW is ready for messages
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'share-ready') {
        // This is just to acknowledge readiness. No action needed here.
    }
});


// Standard PWA service worker installation
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});
