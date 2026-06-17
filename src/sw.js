import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

self.skipWaiting();
self.addEventListener("activate", () => self.clients.claim());

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// NetworkFirst para Supabase: datos frescos si hay red, caché si no
registerRoute(
  ({ url }) => /^[^/]+\.supabase\.co$/i.test(url.hostname),
  new NetworkFirst({
    cacheName: "supabase-api",
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.hostname === "fonts.googleapis.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts-sheets" }),
);

registerRoute(
  ({ url }) => url.hostname === "fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new ExpirationPlugin({ maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Recordatorios de soundcheck (push real, enviado por la Edge Function)
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* payload no es JSON */ }
  event.waitUntil(
    self.registration.showNotification(data.title || "Soundcheck", {
      body: data.body || "",
      icon: "/Festival-Handover/icon.svg",
      badge: "/Festival-Handover/icon.svg",
      tag: data.tag,
      data: { url: data.url || "/Festival-Handover/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/Festival-Handover/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      const existing = list.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
