"use client";

import { useState } from "react";
import { Reorder, motion } from "motion/react";
import { Check, X } from "lucide-react";

interface UnscrambleExerciseProps {
  words: string[];
  sentenceDari: string;
  sentenceEn: string;
  onComplete: (isCorrect: boolean) => void;
}

export function UnscrambleExercise({
  words,
  sentenceDari,
  sentenceEn,
  onComplete,
}: UnscrambleExerciseProps) {
  const [items, setItems] = useState(() => {
    // Return items scrambled (but guarantee they aren't accidentally correct initially)
    let scrambled = [...words].sort(() => Math.random() - 0.5);
    if (scrambled.join(" ") === sentenceDari && words.length > 1) {
      scrambled.reverse();
    }
    return scrambled;
  });
  
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect">("idle");

  const checkAnswer = () => {
    const attempt = items.join(" ");
    // Remove extra spaces for comparison just in case
    if (attempt.replace(/\s+/g, "") === sentenceDari.replace(/\s+/g, "")) {
      setStatus("correct");
    } else {
      setStatus("incorrect");
      setTimeout(() => setStatus("idle"), 1500);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto items-center p-4 pt-8">
      <h3 className="text-lg font-semibold mb-1 text-center">Unscramble the sentence</h3>
      <p className="text-sm text-ink-soft mb-8 text-center">{sentenceEn}</p>

      <Reorder.Group 
        axis="y" 
        values={items} 
        onReorder={setItems} 
        className="flex flex-col gap-3 w-full"
      >
        {items.map((word) => (
          <Reorder.Item 
            key={word} 
            value={word} 
            className="w-full bg-paper border border-line p-4 rounded-2xl shadow-sm text-center font-dari text-2xl cursor-grab active:cursor-grabbing hover:bg-surface transition-colors"
          >
            {word}
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <div className="mt-8 w-full flex flex-col items-center">
        <button
          onClick={status === "correct" ? () => onComplete(true) : checkAnswer}
          disabled={status === "incorrect"}
          className={`w-full max-w-[200px] py-3.5 rounded-full font-semibold transition-colors ${
            status === "idle" ? "bg-sabz text-white hover:bg-sabz-soft hover:text-sabz" :
            status === "correct" ? "bg-sabz text-white hover:bg-sabz-soft hover:text-sabz" : "bg-danger text-white"
          }`}
        >
          {status === "idle" && "Check Answer"}
          {status === "correct" && <span className="flex items-center justify-center gap-2"><Check size={20} /> Next</span>}
          {status === "incorrect" && <span className="flex items-center justify-center gap-2"><X size={20} /> Try Again</span>}
        </button>
      </div>
    </div>
  );
}
