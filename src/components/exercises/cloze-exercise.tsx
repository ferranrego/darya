"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, X } from "lucide-react";

interface ClozeExerciseProps {
  sentenceTarget: string;
  sentenceTranslit?: string;
  sentenceEn: string;
  missingWord: string;
  missingTranslit?: string;
  missingEn?: string;
  distractors: string[];
  onComplete: (isCorrect: boolean) => void;
}

export function ClozeExercise({
  sentenceTarget,
  sentenceTranslit,
  sentenceEn,
  missingWord,
  missingTranslit,
  missingEn,
  distractors,
  onComplete,
}: ClozeExerciseProps) {
  const [options] = useState(() => {
    // Shuffle options once on mount
    return [missingWord, ...distractors].sort(() => Math.random() - 0.5);
  });
  
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect">("idle");

  // The AI sometimes returns the sentence with a literal blank (e.g. "____" or
  // tatweel "ـــ") instead of containing the missing word. Render our
  // interactive blank at that spot, so we never show two underlines.
  const placeholderMatch = sentenceTarget.match(/_{2,}|ـ{2,}|…|\.{3,}/);
  let before: string;
  let after: string;
  if (placeholderMatch?.index !== undefined) {
    before = sentenceTarget.slice(0, placeholderMatch.index).trim();
    after = sentenceTarget.slice(placeholderMatch.index + placeholderMatch[0].length).trim();
  } else if (sentenceTarget.includes(missingWord)) {
    const idx = sentenceTarget.indexOf(missingWord);
    before = sentenceTarget.slice(0, idx).trim();
    after = sentenceTarget.slice(idx + missingWord.length).trim();
  } else {
    // Missing word not found at all: show the sentence with the blank at the end
    before = sentenceTarget.trim();
    after = "";
  }

  const handleSelect = (option: string) => {
    if (status !== "idle") return;
    
    setSelected(option);
    if (option === missingWord) {
      setStatus("correct");
    } else {
      setStatus("incorrect");
      setTimeout(() => {
        setStatus("idle");
        setSelected(null);
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto items-center justify-center p-4">
      <h3 className="text-lg font-semibold mb-1 text-center">Fill in the blank</h3>
      <div className="w-full bg-surface border border-line rounded-3xl p-6 shadow-sm mb-8 mt-2">
        <div
          dir="rtl" 
          className="text-2xl leading-relaxed text-center font-dari flex flex-wrap items-center justify-center gap-2"
        >
          <span>{before}</span>
          <div 
            className={`min-w-[80px] h-10 border-b-2 flex items-center justify-center transition-colors px-2 ${
              status === "idle" ? "border-ink-faint" : 
              status === "correct" ? "border-sabz text-sabz" : "border-danger text-danger"
            }`}
          >
            <AnimatePresence mode="wait">
              {selected && (
                <motion.span
                  key={selected}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {selected}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span>{after}</span>
        </div>
        <AnimatePresence>
          {status === "correct" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="overflow-hidden text-center"
            >
              {sentenceTranslit && (
                <p className="text-sm text-ink-soft mt-4 italic">{sentenceTranslit}</p>
              )}
              <p className={`text-sm text-ink-soft ${sentenceTranslit ? 'mt-1' : 'mt-4'}`}>{sentenceEn}</p>
              <p className="text-sm text-sabz font-medium mt-1">
                <span className="font-dari">{missingWord}</span>
                {missingTranslit && ` (${missingTranslit})`}
                {missingEn && ` = ${missingEn}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => handleSelect(opt)}
            disabled={status !== "idle" || selected === opt}
            className={`px-5 py-3 rounded-2xl text-xl font-dari transition-all ${
              selected === opt
                ? "opacity-0 scale-95" // Hide it from bank when selected
                : "bg-paper border border-line shadow-sm hover:shadow-md hover:bg-surface active:scale-95"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="h-16 mt-6 flex items-center justify-center w-full">
        {status === "correct" && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex w-full max-w-[200px] flex-col items-center gap-4">
            <button onClick={() => onComplete(true)} className="w-full py-3 bg-sabz text-white rounded-full font-semibold hover:bg-sabz-soft hover:text-sabz transition-colors flex justify-center items-center gap-2">
              <Check size={20} /> Next
            </button>
          </motion.div>
        )}
        {status === "incorrect" && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-danger flex items-center gap-2 font-medium">
            <X size={24} /> Try again
          </motion.div>
        )}
      </div>
    </div>
  );
}
