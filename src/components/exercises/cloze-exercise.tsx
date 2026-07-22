"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, X } from "lucide-react";

interface ClozeExerciseProps {
  sentenceDari: string;
  sentenceEn: string;
  missingWord: string;
  distractors: string[];
  onComplete: (isCorrect: boolean) => void;
}

export function ClozeExercise({
  sentenceDari,
  sentenceEn,
  missingWord,
  distractors,
  onComplete,
}: ClozeExerciseProps) {
  const [options] = useState(() => {
    // Shuffle options once on mount
    return [missingWord, ...distractors].sort(() => Math.random() - 0.5);
  });
  
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect">("idle");

  const parts = sentenceDari.split(missingWord);
  // Fallback if the missing word wasn't cleanly in the string
  const before = parts[0] ?? sentenceDari;
  const after = parts[1] ?? "";

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
        <p className="text-sm text-ink-soft mb-2 text-center">{sentenceEn}</p>
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
