"use client";

import { useCallback } from "react";

export function useAudio() {
  const playAudio = useCallback((text: string) => {
    if (!text || text.trim() === "") return;

    // The native Web Speech API voices for Persian/Farsi are notoriously robotic 
    // or completely broken on many devices (especially iOS). 
    // For a language learning app, using a high-quality network TTS is much better.
    // We use the public Google Translate TTS endpoint as a robust alternative.
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=fa&client=tw-ob`;
    
    const audio = new Audio(url);
    audio.playbackRate = 0.85; // Slightly slower for language learners
    
    audio.play().catch(error => {
      console.error("Network audio playback failed, falling back to native TTS:", error);
      
      // Fallback to native speech synthesis if offline or blocked
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        const availableVoices = window.speechSynthesis.getVoices();
        
        let selectedVoice = availableVoices.find(v => v.lang.startsWith("fa") || v.lang.startsWith("prs") || v.lang.startsWith("ar"));
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.lang = selectedVoice ? selectedVoice.lang : "fa-IR";
        utterance.rate = 0.8;
        
        window.speechSynthesis.speak(utterance);
      }
    });
  }, []);

  return { playAudio };
}
