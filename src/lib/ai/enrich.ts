import "server-only";
import { z } from "zod";
import type { EnrichMode } from "../chat/shared";
import { completeJson } from "./providers";

/**
 * On-demand helpers for chat messages: Latin transliteration and English
 * translation. Results are cached on the message row, so each message costs
 * at most one call per mode across all readers.
 */

const schemas = {
  translit: z.object({ translit: z.string().min(1) }),
  translation: z.object({ translation: z.string().min(1) }),
  correction: z.object({
    corrected: z.string(),
    issues: z.array(
      z.object({
        before: z.string(),
        after: z.string(),
        whyEn: z.string(),
      })
    ),
  }),
} as const;

function buildPrompt(body: string, mode: EnrichMode): string {
  const shared = `A learner wrote this message in a Dari (Afghan Persian) chat room. It may mix Dari script with Latin letters or English; leave any non-Dari spans exactly as they are.

Message: ${body}`;

  if (mode === "translit") {
    return `${shared}

Transliterate it. Transliteration rules: Latin, Kabuli pronunciation, long vowels ā ē ī ō ū, use kh/gh/ch/sh/zh/q/', w for و. Example: "می‌روم" → "mērawam".

Return ONLY JSON: {"translit": "..."}`;
  }

  if (mode === "correction") {
    return `${shared}

Check the Dari for any grammatical or spelling mistakes, and correct them. Keep it encouraging and gentle.
Return the fully corrected string in Dari, and a list of issues found.
For each issue, show the 'before' text (the mistake), the 'after' text (the correction), and 'whyEn' (a short explanation in English).

Return ONLY JSON: {"corrected": "...", "issues": [{"before": "...", "after": "...", "whyEn": "..."}]}`;
  }

  return `${shared}

Translate it into natural, everyday English. Keep the tone casual, as chat.

Return ONLY JSON: {"translation": "..."}`;
}

export async function enrichChatMessage(body: string, mode: EnrichMode): Promise<unknown> {
  return completeJson(buildPrompt(body, mode), {
    temperature: 0.2,
    validate: (raw) => {
      const parsed = schemas[mode].parse(JSON.parse(raw));
      if (mode === "translit") return (parsed as { translit: string }).translit;
      if (mode === "translation") return (parsed as { translation: string }).translation;
      return parsed; // returns the whole correction object
    },
  });
}
