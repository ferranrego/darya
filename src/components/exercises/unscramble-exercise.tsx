"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, X } from "lucide-react";
import { profile as langProfile } from "@/lib/lang";

interface UnscrambleExerciseProps {
  words: string[];
  sentenceTarget: string;
  sentenceTranslit?: string;
  sentenceEn: string;
  onComplete: (isCorrect: boolean) => void;
}

export function UnscrambleExercise({
  words,
  sentenceTarget,
  sentenceTranslit,
  sentenceEn,
  onComplete,
}: UnscrambleExerciseProps) {
  const [availableWords, setAvailableWords] = useState(() => {
    const scrambled = [...words].map((text, i) => ({ id: `${i}-${text}`, text })).sort(() => Math.random() - 0.5);
    if (scrambled.map(s => s.text).join(" ") === sentenceTarget && words.length > 1) {
      scrambled.reverse();
    }
    return scrambled;
  });
  
  const [selectedWords, setSelectedWords] = useState<Array<{ id: string, text: string }>>([]);
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect">("idle");

  const handleSelectWord = (word: typeof availableWords[0]) => {
    if (status !== "idle") return;
    setAvailableWords(prev => {
      const nextAvailable = prev.filter(w => w.id !== word.id);
      setSelectedWords(prevSelected => {
        const nextSelected = [...prevSelected, word];
        if (nextAvailable.length === 0) {
          const attempt = nextSelected.map(s => s.text).join(" ");
          if (attempt.replace(/\s+/g, "") === sentenceTarget.replace(/\s+/g, "")) {
            setStatus("correct");
          }
        }
        return nextSelected;
      });
      return nextAvailable;
    });
  };

  const handleDeselectWord = (word: typeof availableWords[0]) => {
    if (status !== "idle") return;
    setSelectedWords(prev => prev.filter(w => w.id !== word.id));
    setAvailableWords(prev => [...prev, word]);
  };

  const checkAnswer = () => {
    const attempt = selectedWords.map(s => s.text).join(" ");
    if (attempt.replace(/\s+/g, "") === sentenceTarget.replace(/\s+/g, "")) {
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

      {/* Target Area */}
      <motion.div 
        animate={status === "incorrect" ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        dir={langProfile.dir}
        className={`relative min-h-[140px] w-full rounded-3xl p-5 flex flex-wrap gap-3 items-start content-start mb-8 transition-colors ${
          status === "incorrect" 
            ? "bg-danger/10 border-2 border-danger" 
            : status === "correct" 
            ? "bg-sabz/10 border-2 border-sabz" 
            : "bg-surface border-2 border-dashed border-line shadow-inner"
        }`}
      >
        <AnimatePresence>
          {selectedWords.length === 0 && status === "idle" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex items-center justify-center text-ink-soft/60 font-medium absolute inset-0 pointer-events-none"
            >
              Tap words to build the sentence
            </motion.div>
          )}
        </AnimatePresence>
        
        {selectedWords.map((word) => (
          <motion.button
            layout
            layoutId={word.id}
            key={word.id}
            onClick={() => handleDeselectWord(word)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-5 py-3 rounded-2xl shadow-sm text-2xl font-dari transition-colors ${
              status === "correct" 
                ? "bg-sabz text-white" 
                : status === "incorrect"
                ? "bg-danger text-white"
                : "bg-paper border-2 border-line text-ink hover:border-danger hover:text-danger"
            }`}
          >
            {word.text}
          </motion.button>
        ))}
      </motion.div>

      <AnimatePresence>
        {status === "correct" && sentenceTranslit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="w-full text-center mb-4 -mt-4 text-sm text-ink-soft italic overflow-hidden"
          >
            {sentenceTranslit}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Word Pool */}
      <div 
        dir={langProfile.dir}
        className="w-full flex flex-wrap gap-3 justify-center min-h-[140px]"
      >
        {availableWords.map((word) => (
          <motion.button
            layout
            layoutId={word.id}
            key={word.id}
            onClick={() => handleSelectWord(word)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-5 py-3 bg-paper border-2 border-line text-ink rounded-2xl shadow-sm text-2xl font-dari hover:border-sabz hover:text-sabz transition-colors"
          >
            {word.text}
          </motion.button>
        ))}
      </div>

      <div className="mt-auto pt-8 w-full flex flex-col items-center">
        <button
          onClick={status === "correct" ? () => onComplete(true) : checkAnswer}
          disabled={status === "incorrect" || (status === "idle" && availableWords.length > 0)}
          className={`w-full max-w-[200px] py-4 rounded-full font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            status === "idle" ? "bg-sabz text-white hover:bg-sabz-soft hover:shadow-md" :
            status === "correct" ? "bg-sabz text-white hover:bg-sabz-soft hover:shadow-md" : "bg-danger text-white"
          }`}
        >
          {status === "idle" && "Check Answer"}
          {status === "correct" && <span className="flex items-center justify-center gap-2"><Check size={24} /> Next</span>}
          {status === "incorrect" && <span className="flex items-center justify-center gap-2"><X size={24} /> Try Again</span>}
        </button>
      </div>
    </div>
  );
}
