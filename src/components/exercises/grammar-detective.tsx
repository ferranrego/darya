"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

interface GrammarDetectiveProps {
  correctSentenceTarget: string;
  correctSentenceTranslit: string;
  incorrectSentenceTarget: string;
  incorrectSentenceTranslit: string;
  explanationEn: string;
  onComplete: (isCorrect: boolean) => void;
}

export function GrammarDetective({
  correctSentenceTarget,
  correctSentenceTranslit,
  incorrectSentenceTarget,
  incorrectSentenceTranslit,
  explanationEn,
  onComplete,
}: GrammarDetectiveProps) {
  // 0 is correct, 1 is incorrect
  const [order] = useState(() => Math.random() > 0.5 ? [0, 1] : [1, 0]);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "evaluating">("idle");

  const sentences = [
    { target: correctSentenceTarget, translit: correctSentenceTranslit, isCorrect: true },
    { target: incorrectSentenceTarget, translit: incorrectSentenceTranslit, isCorrect: false }
  ];

  const handleSelect = (isCorrect: boolean, idx: number) => {
    if (status !== "idle") return;
    setSelected(idx);
    setStatus("evaluating");
    
    if (!isCorrect) {
      setTimeout(() => {
        setStatus("idle");
        setSelected(null);
      }, 3000);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto items-center p-4 pt-8">
      <h3 className="text-lg font-semibold mb-1 text-center">Grammar Detective</h3>
      <p className="text-sm text-ink-soft mb-8 text-center">Which sentence is grammatically correct?</p>

      <div className="flex flex-col gap-4 w-full">
        {order.map((origIdx, renderIdx) => {
          const sent = sentences[origIdx];
          const isSelected = selected === renderIdx;
          let btnClass = "bg-surface border-line hover:shadow-md";
          
          if (status === "evaluating") {
            if (isSelected && sent.isCorrect) btnClass = "bg-sabz/10 border-sabz text-sabz";
            else if (isSelected && !sent.isCorrect) btnClass = "bg-danger/10 border-danger text-danger";
          }

          return (
            <button
              key={renderIdx}
              onClick={() => handleSelect(sent.isCorrect, renderIdx)}
              disabled={status !== "idle"}
              className={`w-full flex flex-col items-center justify-center p-6 rounded-2xl border transition-all ${btnClass}`}
            >
              <span className="font-dari text-2xl text-center leading-relaxed" dir="rtl">{sent.target}</span>
              <span className="text-sm opacity-60 mt-2">{sent.translit}</span>
            </button>
          );
        })}
      </div>

      {status === "evaluating" && (
        <div className={`mt-6 p-4 rounded-xl text-sm ${selected !== null && sentences[order[selected]].isCorrect ? 'bg-sabz-soft/30 text-sabz' : 'bg-danger/10 text-danger'}`}>
          <p className="font-medium mb-1">
            {selected !== null && sentences[order[selected]].isCorrect ? (
              <span className="flex items-center gap-1"><Check size={16}/> Exactly!</span>
            ) : (
              <span className="flex items-center gap-1"><X size={16}/> Not quite.</span>
            )}
          </p>
          <p className="mb-4">{explanationEn}</p>
          {selected !== null && sentences[order[selected]].isCorrect && (
            <div className="flex justify-center w-full mt-2">
              <button onClick={() => onComplete(true)} className="w-full py-3 bg-sabz text-white rounded-xl font-semibold hover:bg-sabz-soft hover:text-sabz transition-colors flex justify-center items-center gap-2">
                <Check size={20} /> Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
