"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { alphabetCourse } from "@/lib/content/load";
import { useSupabase, useUser } from "@/lib/queries/hooks";
import { getUserLetters, updateUserLetter } from "@/lib/db/letters";
import { Button } from "@/components/ui/button";
import { FSRS, Rating, createEmptyCard, type Card } from "ts-fsrs";

const fsrs = new FSRS();

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
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const currentDue = dueLetters[currentIndex];
  
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
      const f = new FSRS();
      // Ensure the card has valid dates
      const validCard = {
        ...card,
        due: new Date(card.due),
        last_review: card.last_review ? new Date(card.last_review) : undefined
      };
      
      const scheduling = f.repeat(validCard, new Date());
      const nextCard = scheduling[rating].card;
      
      await updateUserLetter(db, user.id, currentDue.letter_char, nextCard);
    },
    onSuccess: () => {
      if (currentIndex < dueLetters.length - 1) {
        setCurrentIndex(i => i + 1);
        setShowAnswer(false);
      } else {
        refetch();
        setCurrentIndex(0);
        setShowAnswer(false);
      }
    }
  });

  const handleRate = (rating: Rating) => {
    if (!currentDue) return;
    const card = currentDue.fsrs || createEmptyCard(new Date());
    reviewMutation.mutate({ rating, card });
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
          <p className="text-[12px] text-ink-faint">{dueLetters.length - currentIndex} remaining</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center p-4">
        {isLoading ? (
          <p className="text-ink-soft">Loading reviews...</p>
        ) : dueLetters.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-[48px]">🎉</div>
            <h2 className="text-[20px] font-semibold">You're all caught up!</h2>
            <p className="text-ink-soft">No letters due for review right now.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full max-w-sm gap-8">
            <div className="w-full flex flex-col items-center bg-surface border border-line rounded-3xl p-10 shadow-sm">
              <span className="text-[12px] font-medium text-ink-faint uppercase tracking-widest mb-4">
                {formToTest?.name} Form
              </span>
              <p lang="prs" className="text-[80px] font-bold text-ink leading-none">
                {formToTest?.char}
              </p>
            </div>

            {!showAnswer ? (
              <Button size="lg" className="w-full" onClick={() => setShowAnswer(true)}>
                Show Answer
              </Button>
            ) : (
              <div className="w-full flex flex-col gap-6 animate-in slide-in-from-bottom-2 fade-in">
                <div className="flex flex-col items-center">
                  <p className="text-[24px] font-bold text-ink">{letterData?.name}</p>
                  <p className="text-[16px] text-ink-soft">{letterData?.translit} · {letterData?.sound}</p>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" className="border-red-500/20 text-red-600 hover:bg-red-50" onClick={() => handleRate(Rating.Again)}>
                    Forgot
                  </Button>
                  <Button variant="outline" className="border-sabz/20 text-sabz hover:bg-sabz-soft/50" onClick={() => handleRate(Rating.Good)}>
                    Good
                  </Button>
                  <Button variant="outline" className="border-lapis/20 text-lapis hover:bg-lapis-soft/50" onClick={() => handleRate(Rating.Easy)}>
                    Easy
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
