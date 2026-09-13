import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { profile as lang } from "@/lib/lang";

/**
 * Hand a question the book could not answer to the tutor.
 *
 * Only a link: it opens the tutor with the question drafted and the learner
 * sends it themselves. Nothing here calls a model, so the hub adds no new way
 * to spend the free-tier quota every learner shares - a question costs exactly
 * what the same question typed into the chat would.
 */
export function askTutorHref(question: string): string {
  return `/chat?ask=${encodeURIComponent(question)}`;
}

export function AskTutorLink({ question, label }: { question: string; label?: string }) {
  return (
    <Link
      href={askTutorHref(question)}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-lapis px-5 text-[15px] font-medium text-white transition-all active:scale-[0.98]"
    >
      <MessageCircle size={17} />
      {label ?? `Ask ${lang.brand.mascotName}`}
    </Link>
  );
}
