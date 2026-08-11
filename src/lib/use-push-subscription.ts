import { useState, useEffect, useCallback } from "react";
import { urlB64ToUint8Array } from "./push";

/** POSTs a subscription to the backend. Upserts on endpoint, so it is safe to
 *  repeat. Returns nothing and throws on failure — callers decide what to show. */
async function storeSubscription(sub: PushSubscription) {
  const keys = sub.toJSON().keys;
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: keys?.p256dh, auth: keys?.auth },
      platform: /iPad|iPhone|iPod/.test(navigator.userAgent) ? "ios" : "web",
    }),
  });
  if (!res.ok) throw new Error(`Server rejected the subscription (${res.status})`);
}

export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setTimeout(() => setIsSupported(true), 0);

    // Re-post any subscription the browser already holds. The device and the
    // database drift apart otherwise — a subscription reaped server-side after
    // a 410, or a POST that failed at enable time, leaves the browser
    // believing it is subscribed while nothing can ever be delivered. This is
    // the only thing that closes that gap, and the upsert makes it free.
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (!sub) return;
        setIsSubscribed(true);
        try {
          await storeSubscription(sub);
        } catch (e) {
          console.error("Push subscription re-sync failed", e);
        }
      })
      .catch(() => {});
  }, []);

  const subscribe = useCallback(async () => {
    setError(null);
    try {
      setIsSubscribing(true);

      // Safari requires the permission request to happen inside the user
      // gesture, before any other asynchronous work.
      if ("Notification" in window) {
        let permission = window.Notification.permission;
        if (permission !== "granted") {
          permission = await new Promise((resolve) => {
            const req = window.Notification.requestPermission(resolve);
            if (req && typeof req.then === "function") {
              req.then(resolve);
            }
          });
        }
        if (permission !== "granted") {
          throw new Error(
            permission === "denied"
              ? "Notifications are blocked for this app in iOS Settings."
              : "Notification permission was not granted.",
          );
        }
      }

      // Ensure the SW is registered so that `ready` cannot hang forever if
      // SwRegister was bypassed or failed.
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw.js");
      }

      const reg = await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          throw new Error("This build is missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
        }

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(vapidPublicKey),
        });
      }

      // Only claim success once the server confirms it stored the row.
      await storeSubscription(sub);
      setIsSubscribed(true);
    } catch (e) {
      console.error("Push subscription error", e);
      setError(e instanceof Error ? e.message : "Could not enable notifications.");
      setIsSubscribed(false);
    } finally {
      setIsSubscribing(false);
    }
  }, []);

  return { isSupported, isSubscribed, isSubscribing, error, subscribe };
}
