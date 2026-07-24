"use client";

import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/lib/use-push-subscription";

interface NotificationPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPrompt({ isOpen, onClose }: NotificationPromptProps) {
  const { isSupported, isSubscribed, isSubscribing, subscribe } = usePushSubscription();

  // If already subscribed or not supported, we shouldn't show anything ideally,
  // but we can auto-close.
  useEffect(() => {
    if (isOpen && (isSubscribed || !isSupported)) {
      onClose();
    }
  }, [isOpen, isSubscribed, isSupported, onClose]);

  if (!isOpen) return null;

  const handleEnable = async () => {
    await subscribe();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-sm overflow-hidden rounded-[24px] bg-surface p-6 shadow-xl"
        >
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-lapis-soft text-lapis">
            <Bell size={28} strokeWidth={2} />
          </div>

          <div className="mt-5 text-center">
            <h3 className="text-[20px] font-semibold tracking-tight">Stay updated</h3>
            <p className="mt-2 text-[15px] text-ink-soft">
              Turn on notifications to get daily practice reminders and know when you receive new chat messages.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Button size="lg" onClick={handleEnable} disabled={isSubscribing}>
              {isSubscribing ? "Enabling..." : "Enable notifications"}
            </Button>
            <Button size="lg" variant="secondary" onClick={onClose} disabled={isSubscribing}>
              Maybe later
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
