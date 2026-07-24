import { useState, useEffect, useCallback } from "react";
import { urlB64ToUint8Array } from "./push";

export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setTimeout(() => setIsSupported(true), 0);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(sub !== null);
        });
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    try {
      setIsSubscribing(true);

      // Safari requires explicit permission request in a user gesture
      // before we do any other asynchronous operations.
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
          throw new Error("Notification permission denied");
        }
      }

      // Ensure SW is registered so that ready doesn't hang indefinitely
      // if SwRegister was bypassed or failed.
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw.js");
      }

      const reg = await navigator.serviceWorker.ready;
      
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
        }
        
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(vapidPublicKey),
        });
      }

      // Send sub to backend
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.toJSON().keys?.p256dh,
            auth: sub.toJSON().keys?.auth,
          },
          platform: /iPad|iPhone|iPod/.test(navigator.userAgent) ? "ios" : "web"
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to store subscription");
      }

      setIsSubscribed(true);
    } catch (e) {
      console.error("Push subscription error", e);
    } finally {
      setIsSubscribing(false);
    }
  }, []);

  return { isSupported, isSubscribed, isSubscribing, subscribe };
}
