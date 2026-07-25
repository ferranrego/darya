import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type RecordLogItem,
} from "ts-fsrs";

/**
 * FSRS wrapper. The review UI exposes exactly two buttons; they map to FSRS
 * grades here and nowhere else.
 */
export const FSRS_PARAMETERS = generatorParameters({ 
  enable_fuzz: true, 
  enable_short_term: false,
  request_retention: 0.85,
  maximum_interval: 365
});
const scheduler = fsrs(FSRS_PARAMETERS);

export type TwoButtonGrade = "forgot" | "got_it";

const GRADE_MAP: Record<TwoButtonGrade, Rating.Again | Rating.Good> = {
  forgot: Rating.Again,
  got_it: Rating.Good,
};

/** Stability (in days) at which a learning word graduates to known. */
export const KNOWN_STABILITY_DAYS = 21;

export function newCard(now: Date): Card {
  return createEmptyCard(now);
}

export function reviewCard(card: Card, grade: TwoButtonGrade, now: Date): RecordLogItem {
  return scheduler.next(card, now, GRADE_MAP[grade]);
}

export function isGraduated(card: Card): boolean {
  return card.state === State.Review && card.stability >= KNOWN_STABILITY_DAYS;
}

/** Serialize/deserialize across the JSONB boundary (dates come back as strings). */
export function reviveCard(raw: Card): Card {
  return {
    ...raw,
    due: new Date(raw.due),
    last_review: raw.last_review ? new Date(raw.last_review) : undefined,
  };
}

/** Format a future due Date into a compact Anki-style label, e.g. "<1m", "10m", "3d". */
function formatInterval(due: Date, now: Date): string {
  const diffMs = due.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "<1m";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.round(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d`;
  const diffMo = Math.round(diffDays / 30);
  return `${diffMo}mo`;
}

/** Returns the interval labels for both buttons shown as hints in the review UI. */
export function previewIntervals(card: Card, now: Date): { forgot: string; got_it: string } {
  const againDue = scheduler.next(card, now, Rating.Again).card.due;
  const goodDue = scheduler.next(card, now, Rating.Good).card.due;
  return {
    forgot: formatInterval(againDue, now),
    got_it: formatInterval(goodDue, now),
  };
}
