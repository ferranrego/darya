import type { LexiconEntry } from "../../content/schema.ts";
import { derivePastStem } from "./conjugate.ts";
import { matchKey, ZWNJ } from "./normalize.ts";

/**
 * Which Grammar Hub page (if any) explains the written form of a tapped word.
 *
 * The governing principle: a wrong link is worse than no link. This function
 * only ever emits a slug when the grammar is certain from the written surface
 * form - it never guesses. Callers must still intersect the result with the
 * set of slugs that actually exist in `hubEntries` (kept out of this module
 * so it stays pure and testable without pulling in the hub content file).
 */

const MI = "می" + ZWNJ;
const NMI = "نمی" + ZWNJ;

const PRESENT_ENDINGS = new Set(["م", "ی", "د", "یم", "ید", "ند"]);
/** Simple-past / imperfect endings; "" covers the bare 3rd-person singular. */
const PAST_ENDINGS = new Set(["", "م", "ی", "یم", "ید", "ند"]);

/** The infinitive of a (possibly compound) verb headword: کار کردن → کردن. */
function infinitiveOf(entry: LexiconEntry): string {
  return entry.targetNormalized.split(" ").at(-1)!;
}

function pastStemOf(entry: LexiconEntry): string | null {
  return derivePastStem(infinitiveOf(entry));
}

function presentStemOf(entry: LexiconEntry): string | null {
  return entry.presentStem ?? null;
}

/** Does `remainderKey` decompose exactly as `stem` + one of `endings`? */
function fitsStem(remainderKey: string, stem: string | null, endings: Set<string>): boolean {
  if (!stem) return false;
  const stemKey = matchKey(stem);
  if (!remainderKey.startsWith(stemKey)) return false;
  return endings.has(remainderKey.slice(stemKey.length));
}

type TenseFit = "present" | "past" | "both" | "none";

/** Whether the text after a می‌/نمی‌ prefix reads as present, past, both, or neither. */
function tenseFitOf(rest: string, entry: LexiconEntry): TenseFit {
  const remainderKey = matchKey(rest);
  const presentFits = fitsStem(remainderKey, presentStemOf(entry), PRESENT_ENDINGS);
  const pastFits = fitsStem(remainderKey, pastStemOf(entry), PAST_ENDINGS);
  if (presentFits && pastFits) return "both";
  if (presentFits) return "present";
  if (pastFits) return "past";
  return "none";
}

/**
 * Grammar Hub slugs a tapped token's *written form* is certain evidence for.
 *
 * `entry` is the lexicon entry the token resolved to (or null for an
 * unresolved token). Pure and content-agnostic: it does not know which hub
 * slugs actually have a page, so a caller must filter the result against
 * `hubEntries` before rendering links.
 */
export function topicsForToken(surface: string, entry: LexiconEntry | null): string[] {
  const slugs = new Set<string>();

  if (matchKey(surface) === matchKey("را")) {
    slugs.add("object-marker-ra");
  }

  if (entry?.pos === "verb") {
    if (surface.startsWith(NMI)) {
      const rest = surface.slice(NMI.length);
      const fit = tenseFitOf(rest, entry);
      slugs.add("negation");
      if (fit === "present") slugs.add("present-tense");
      else if (fit === "past") slugs.add("past-continuous");
    } else if (surface.startsWith(MI)) {
      const rest = surface.slice(MI.length);
      const fit = tenseFitOf(rest, entry);
      if (fit === "present") slugs.add("present-tense");
      else if (fit === "past") slugs.add("past-continuous");
    } else if (surface.startsWith("ن") && !matchKey(entry.targetNormalized).startsWith("ن")) {
      // Past negation: نرفتم. Only fired once the rest is confirmed to start
      // with the past stem - a verb whose headword merely starts with a
      // different ن-initial form (already excluded above) is not enough, and
      // neither is a bare "starts with ن" on its own, since that would also
      // match a present-tense subjunctive negative or an unrelated word.
      const rest = surface.slice(1);
      const pastStem = pastStemOf(entry);
      const restKey = matchKey(rest);
      if (pastStem && restKey.startsWith(matchKey(pastStem))) {
        slugs.add("negation");
        const remainder = restKey.slice(matchKey(pastStem).length);
        if (PAST_ENDINGS.has(remainder)) slugs.add("simple-past");
      }
    }
  } else if (entry?.pos === "noun") {
    const HA = ZWNJ + "ها";
    const HAI = ZWNJ + "های";
    if (surface.endsWith(HAI)) {
      const base = surface.slice(0, -HAI.length);
      if (matchKey(base) === matchKey(entry.targetNormalized)) {
        slugs.add("plurals");
        // After -hā, a ی can only be the ezafe (a second plural marker never
        // stacks directly on -hā), so this reading is certain too.
        slugs.add("ezafe");
      }
    } else if (surface.endsWith(HA)) {
      const base = surface.slice(0, -HA.length);
      if (matchKey(base) === matchKey(entry.targetNormalized)) {
        slugs.add("plurals");
      }
    }
  }

  return [...slugs];
}
