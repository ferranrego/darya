"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

interface RealiaExerciseProps {
  documentType: string;
  markdown: string;
  questionEn: string;
  optionsEn: string[];
  correctOptionIndex: number;
  onComplete: (isCorrect: boolean) => void;
}

export function RealiaExercise({
  documentType,
  markdown,
  questionEn,
  optionsEn,
  correctOptionIndex,
  onComplete,
}: RealiaExerciseProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "evaluating">("idle");

  const handleSelect = (idx: number) => {
    if (status !== "idle") return;
    setSelected(idx);
    setStatus("evaluating");
    
    if (idx !== correctOptionIndex) {
      setTimeout(() => {
        setStatus("idle");
        setSelected(null);
      }, 1500);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto items-center p-4">
      <h3 className="text-sm font-medium text-ink-faint uppercase tracking-wider mb-1">
        Reading Comprehension: {documentType}
      </h3>
      <p className="text-xs text-ink-soft mb-4">Read the text and answer the question below.</p>
      
      {/* Realia Document Container */}
      <div 
        className="w-full bg-yellow-50 dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-700 rounded-lg p-6 mb-8 shadow-sm font-dari text-lg text-right text-stone-800 dark:text-stone-200 whitespace-pre-wrap"
        dir="rtl"
      >
        {markdown}
      </div>

      <div className="w-full">
        <p className="font-medium text-lg mb-4">{questionEn}</p>
        <div className="flex flex-col gap-3">
          {optionsEn.map((opt, idx) => {
            const isSelected = selected === idx;
            let btnClass = "bg-surface border-line hover:bg-paper";
            
            if (status === "evaluating") {
              if (isSelected && idx === correctOptionIndex) btnClass = "bg-sabz text-white border-sabz";
              else if (isSelected && idx !== correctOptionIndex) btnClass = "bg-danger text-white border-danger";
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelect(idx)}
                disabled={status !== "idle"}
                className={`w-full text-left p-4 rounded-xl border transition-all ${btnClass} flex items-center justify-between`}
              >
                <span>{opt}</span>
                {status === "evaluating" && isSelected && idx === correctOptionIndex && <Check size={20} />}
                {status === "evaluating" && isSelected && idx !== correctOptionIndex && <X size={20} />}
              </button>
            );
          })}
        </div>
        {status === "evaluating" && selected === correctOptionIndex && (
          <div className="mt-8 flex justify-center w-full">
            <button onClick={() => onComplete(true)} className="w-full max-w-[200px] py-3.5 bg-sabz text-white rounded-full font-semibold hover:bg-sabz-soft hover:text-sabz transition-colors flex justify-center items-center gap-2">
              <Check size={20} /> Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
