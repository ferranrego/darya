"use client";

import { useCallback } from "react";
import { profile } from "./lang/index.ts";

export function useAudio() {
  const playAudio = useCallback((text: string) => {
    if (!text || text.trim() === "") return;

    // Native Web Speech voices for the languages we teach are notoriously
    // robotic or outright missing (especially on iOS), so prefer a network TTS
    // and keep speechSynthesis as the offline fallback.
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      text,
    )}&tl=${profile.ttsLocale}&client=tw-ob`;

    const audio = new Audio(url);
    audio.playbackRate = 0.85; // Slightly slower for language learners

    audio.play().catch((error) => {
      console.error("Network audio playback failed, falling back to native TTS:", error);

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const available = window.speechSynthesis.getVoices();

        // Best acceptable voice, in the profile's order of preference.
        const selectedVoice = profile.ttsVoicePrefixes
          .map((prefix) => available.find((v) => v.lang.startsWith(prefix)))
          .find(Boolean);

        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.lang = selectedVoice?.lang ?? profile.ttsLocale;
        utterance.rate = 0.8;

        window.speechSynthesis.speak(utterance);
      }
    });
  }, []);

  return { playAudio };
}
