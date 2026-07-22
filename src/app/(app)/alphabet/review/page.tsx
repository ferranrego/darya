"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from "motion/react";
import { alphabetCourse } from "@/lib/content/load";
import { useSupabase, useUser } from "@/lib/queries/hooks";
import { getUserLetters, updateUserLetter } from "@/lib/db/letters";
import { Button } from "@/components/ui/button";
import { FSRS, Rating, createEmptyCard, type Card } from "ts-fsrs";

const fsrs = new FSRS({});

export default function AlphabetReviewPage() {
  const db = useSupabase();
  const { data: user } = useUser();

  const { data: letters, isLoading, refetch } = useQuery({
    queryKey: ["user-letters"],
    queryFn: async () => {
      if (!user) return [];
      return await getUserLetters(db, user.id);
    },
    enabled: !!user,
  });

  const dueLetters = letters?.filter(l => l.due && new Date(l.due) <= new Date()) || [];
  
  const [forceReview, setForceReview] = useState(false);
  const activeLetters = forceReview ? (letters || []) : dueLetters;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [exitDir, setExitDir] = useState<1 | -1>(1);

  const currentDue = activeLetters[currentIndex];

  // Swipe animation values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacityGotIt = useTransform(x, [0, 100], [0, 1]);
  const opacityForgot = useTransform(x, [0, -100], [0, 1]);

  useEffect(() => {
    x.set(0);
  }, [currentIndex, isLoading, x]);

  useEffect(() => {
    if (showAnswer) {
      const hasSeen = localStorage.getItem("hasSeenAlphabetSwipeHint");
      if (!hasSeen) {
        setTimeout(() => {
          animate(x, [0, -15, 20, -15, 0], { duration: 0.5 });
          localStorage.setItem("hasSeenAlphabetSwipeHint", "true");
        }, 300);
      }
    }
  }, [showAnswer, x]);
  
  // Look up the letter in the course to get its forms
  const letterData = useMemo(() => {
    if (!currentDue) return null;
    for (const unit of alphabetCourse.units) {
      const found = unit.letters.find(l => l.char === currentDue.letter_char);
      if (found) return found;
    }
    return null;
  }, [currentDue]);

  // Randomly select a form to test
  const formToTest = useMemo(() => {
    if (!letterData) return null;
    const forms = [
      { name: "Isolated", char: letterData.forms.isolated || letterData.char },
      { name: "Initial", char: letterData.forms.initial },
      { name: "Medial", char: letterData.forms.medial },
      { name: "Final", char: letterData.forms.final },
    ];
    return forms[Math.floor(Math.random() * forms.length)];
  }, [letterData]);

  const reviewMutation = useMutation({
    mutationFn: async ({ rating, card }: { rating: Rating; card: Card }) => {
      if (!user || !currentDue) return;
      const f = new FSRS({});
      // Ensure the card has valid dates
      const validCard = {
        ...card,
        due: new Date(card.due),
        last_review: card.last_review ? new Date(card.last_review) : undefined
      };
      
      const scheduling = f.repeat(validCard, new Date());
      const nextCard = (scheduling as any)[rating].card;
      
      await updateUserLetter(db, user.id, currentDue.letter_char, nextCard);
    },
    onSuccess: () => {
      if (currentIndex < activeLetters.length - 1) {
        setCurrentIndex(i => i + 1);
        setShowAnswer(false);
      } else {
        refetch();
        setCurrentIndex(0);
        setShowAnswer(false);
        setForceReview(false);
      }
    }
  });

  const handleRate = (rating: Rating, dir: 1 | -1) => {
    if (!currentDue) return;
    setExitDir(dir);
    const card = currentDue.fsrs || createEmptyCard(new Date());
    reviewMutation.mutate({ rating, card: card as Card });
  };

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/alphabet"
          className="flex size-9 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface hover:text-ink"
        >
          <ArrowLeft size={19} />
        </Link>
        <div>
          <p className="text-[15px] font-semibold leading-tight">Review Letters</p>
          <p className="text-[12px] text-ink-faint">{activeLetters.length - currentIndex} remaining</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center p-4">
        {isLoading ? (
          <p className="text-ink-soft">Loading reviews...</p>
        ) : activeLetters.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-[48px]">🎉</div>
            <h2 className="text-[20px] font-semibold">You're all caught up!</h2>
            <p className="text-ink-soft">No letters due for review right now.</p>
            {letters && letters.length > 0 && (
              <Button variant="secondary" className="mt-4" onClick={() => setForceReview(true)}>
                Review anyway
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center w-full max-w-sm gap-8 relative">
            <AnimatePresence mode="wait" onExitComplete={() => x.set(0)}>
              <motion.div
                key={`${currentDue?.letter_char}-${currentIndex}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: exitDir * 60, transition: { duration: 0.2 } }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                style={{ x, rotate }}
                drag={showAnswer ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.6}
                onDragEnd={(e, { offset, velocity }) => {
                  const swipePower = Math.abs(offset.x) * velocity.x;
                  if (offset.x > 100 || swipePower > 500) {
                    handleRate(Rating.Good, 1);
                  } else if (offset.x < -100 || swipePower < -500) {
                    handleRate(Rating.Again, -1);
                  } else {
                    animate(x, 0, { type: "spring", stiffness: 300, damping: 20 });
                  }
                }}
                className="w-full flex flex-col items-center bg-surface border border-line rounded-3xl p-10 shadow-[0_2px_20px_rgba(31,26,23,0.05)] relative overflow-hidden"
              >
                {/* Swipe Overlays */}
                {showAnswer && (
                  <>
                    <motion.div style={{ opacity: opacityGotIt }} className="pointer-events-none absolute inset-0 bg-sabz-soft/40 flex items-center justify-center z-20">
                      <span className="text-sabz font-bold text-2xl uppercase tracking-widest bg-surface/90 px-5 py-2.5 rounded-2xl shadow-sm border border-sabz/20">Got it</span>
                    </motion.div>
                    <motion.div style={{ opacity: opacityForgot }} className="pointer-events-none absolute inset-0 bg-red-500/10 flex items-center justify-center z-20">
                      <span className="text-red-500 font-bold text-2xl uppercase tracking-widest bg-surface/90 px-5 py-2.5 rounded-2xl shadow-sm border border-red-500/20">Forgot</span>
                    </motion.div>
                  </>
                )}

                <div className="relative z-10 w-full flex flex-col items-center">
                  <span className="text-[12px] font-medium text-ink-faint uppercase tracking-widest mb-4">
                    {formToTest?.name} Form
                  </span>
                  <p lang="prs" className="text-[80px] font-bold text-ink leading-none cursor-default select-none">
                    {formToTest?.char}
                  </p>
                  
                  <AnimatePresence mode="wait">
                    {showAnswer && (
                      <motion.div
                        key="answer"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 flex flex-col items-center w-full"
                      >
                        <p className="text-[24px] font-bold text-ink">{letterData?.name}</p>
                        <p className="text-[16px] text-ink-soft">{letterData?.translit} · {letterData?.sound}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>

            {!showAnswer ? (
              <Button size="lg" className="w-full" onClick={() => setShowAnswer(true)}>
                Show Answer
              </Button>
            ) : (
              <div className="w-full flex gap-3">
                <Button variant="secondary" size="lg" className="flex-1 border-red-500/20 text-red-600 hover:bg-red-50" onClick={() => handleRate(Rating.Again, -1)}>
                  Forgot
                </Button>
                <Button size="lg" className="flex-1" onClick={() => handleRate(Rating.Good, 1)}>
                  Got it
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
