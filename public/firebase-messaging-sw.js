// Firebase Cloud Messaging service worker — handles pushes that arrive while
// Handy is closed or in a background tab. Foreground messages never reach
// here; those go to onMessage() in src/services/notifications/pushService.ts.
//
// Two service workers are registered for this app and that is expected: this
// one (scope "/firebase-cloud-messaging-push-scope", registered explicitly by
// pushService) and Workbox's generated sw.js for the PWA shell. They don't
// interfere.
//
// The Firebase config arrives as query params rather than being hardcoded —
// a file in public/ can't read Vite's env vars, and duplicating the config
// here would silently drift from src/app/config/firebase.ts. See
// registerMessagingServiceWorker().
//
// compat builds are used deliberately: the modular SDK has no importScripts
// form, and this file is loaded directly by the browser rather than bundled.
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const params = new URLSearchParams(self.location.search);

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification ?? {};
  self.registration.showNotification(title ?? "Handy", {
    body: body ?? "",
    icon: icon ?? "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // Lets a later push about the same subject replace an earlier one instead
    // of stacking duplicates in the tray.
    tag: payload.data?.tag ?? "handy",
    data: { url: payload.data?.url ?? "/" },
  });
});

// Focus an already-open Handy tab rather than opening a second one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
