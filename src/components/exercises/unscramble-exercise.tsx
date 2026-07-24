"use client";

import { useState, useEffect } from "react";
import { Reorder } from "motion/react";
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
  const [targetTexts] = useState(() => sentenceDari.trim().split(/\s+/));

  const [items, setItems] = useState(() => {
    // Return items scrambled (but guarantee they aren't accidentally correct initially)
    const scrambled = [...words].map((text, i) => ({ id: `${i}-${text}`, text })).sort(() => Math.random() - 0.5);
    if (scrambled.map(s => s.text).join(" ") === sentenceDari && words.length > 1) {
      scrambled.reverse();
    }
    return scrambled;
  });
  
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect">("idle");

  const checkAnswer = () => {
    const attempt = items.map(s => s.text).join(" ");
    if (attempt.replace(/\s+/g, "") === sentenceDari.replace(/\s+/g, "")) {
      setStatus("correct");
    } else {
      setStatus("incorrect");
      setTimeout(() => setStatus("idle"), 1500);
    }
  };

  const isAllCorrect = items.every((item, idx) => item.text === targetTexts[idx]);
  
  useEffect(() => {
    if (isAllCorrect && status === "idle") {
      setTimeout(() => setStatus("correct"), 0);
    }
  }, [isAllCorrect, status]);

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
        {items.map((item, idx) => {
          const isFixed = item.text === targetTexts[idx];
          return (
            <Reorder.Item 
              key={item.id} 
              value={item} 
              dragListener={!isFixed}
              className={`w-full p-4 rounded-2xl shadow-sm text-center font-dari text-2xl transition-colors ${
                isFixed 
                  ? "bg-sabz-soft border-sabz text-sabz cursor-default" 
                  : "bg-paper border border-line cursor-grab active:cursor-grabbing hover:bg-surface"
              }`}
            >
              {item.text}
            </Reorder.Item>
          );
        })}
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
