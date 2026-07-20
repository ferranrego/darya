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
export const FSRS_PARAMETERS = generatorParameters({ enable_fuzz: true, enable_short_term: true });
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
