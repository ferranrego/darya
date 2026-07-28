/**
 * One-time enrichment: write `presentStem` onto verb entries in
 * content/lexicon/lexicon.json so the runtime conjugator (src/lib/text/
 * conjugate.ts) can generate full paradigms, and drop dead Latin-script
 * variants that can never match a Dari surface form.
 *
 * Stem sources, in precedence order:
 *   1. VERB_OVERRIDES (hand-checked irregulars)
 *   2. deterministic extraction from existing present-tense variants
 *   3. LLM batch (Groq → OpenRouter fallback, same env as expand-lexicon.ts)
 *
 * Simple verbs (no space, infinitive in دن/تن) get their own stem. Compound
 * verbs whose light verb has NO simple entry (e.g. تیر کشیدن with no کشیدن)
 * get the light verb's stem, so lexicon-index can conjugate the light verb
 * and map its forms to the compound.
 *
 * Reads/writes raw JSON - never through zod, which would strip/inject fields.
 *
 * Run: pnpm tsx scripts/enrich-verb-stems.ts [--dry-run] [--limit N]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CONTENT_FORMAT_VERSION } from "../src/lib/content/schema.ts";
import { VERB_OVERRIDES, derivePastStem } from "../src/lib/text/conjugate.ts";
import { matchKey, normalizeDari } from "../src/lib/text/normalize.ts";

const lexiconPath = join(import.meta.dirname, "..", "content", "lexicon", "lexicon.json");
const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.indexOf("--limit");
const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const PERSIAN = /^[؀-ۿ‌]+$/;
const HAS_PERSIAN = /[؀-ۿ]/;
const ENDINGS = ["م", "ی", "د", "یم", "ید", "ند"];

/**
 * Hand-authored present stems (بن مضارع) for every simple verb in the lexicon
 * not already covered by VERB_OVERRIDES. Keyed by matchKey of the infinitive.
 * `null` = deliberately no present stem: archaic verbs whose present forms
 * never occur (نهفتن، سفتن), and ZWNJ-joined compound spellings whose present
 * is written as two tokens (استخدام می‌کنم) covered by the light verb's entry.
 */
const STEM_TABLE: Record<string, string | null> = {
  // Regular ـیدن verbs: stem = infinitive minus یدن.
  فهمیدن: "فهم", خوابیدن: "خواب", خریدن: "خر", پوشیدن: "پوش", باریدن: "بار",
  خندیدن: "خند", ترسیدن: "ترس", پرسیدن: "پرس", رسیدن: "رس", دویدن: "دو",
  پریدن: "پر", سنجیدن: "سنج", بخشیدن: "بخش", لرزیدن: "لرز", ارزیدن: "ارز",
  پوسیدن: "پوس", دزدیدن: "دزد", رنجیدن: "رنج", روبیدن: "روب", اشامیدن: "آشام",
  خراشیدن: "خراش", خروشیدن: "خروش", کوشیدن: "کوش", رخشیدن: "رخش", لغزیدن: "لغز",
  نالیدن: "نال", بالیدن: "بال", چشیدن: "چش", کاویدن: "کاو", گنجیدن: "گنج",
  وزیدن: "وز", خزیدن: "خز", دریدن: "در", دمیدن: "دم", رهیدن: "ره",
  گزیدن: "گز", نازیدن: "ناز", غریدن: "غر", گرویدن: "گرو", هراسیدن: "هراس",
  چریدن: "چر", شوریدن: "شور", مالیدن: "مال", تراشیدن: "تراش", خلیدن: "خل",
  تپیدن: "تپ", چسبیدن: "چسب", نامیدن: "نام", بوسیدن: "بوس", پژوهیدن: "پژوه",
  نکوهیدن: "نکوه", اندیشیدن: "اندیش", پرستیدن: "پرست", بلعیدن: "بلع", بوییدن: "بوی",
  جویدن: "جو",
  // Causatives in ـاندن: stem = infinitive minus دن.
  رهاندن: "رهان", خواباندن: "خوابان", رساندن: "رسان", ترساندن: "ترسان",
  سوزاندن: "سوزان", لرزاندن: "لرزان", پوشاندن: "پوشان", خنداندن: "خندان",
  جوشاندن: "جوشان", ماندن: "مان",
  // ـردن (non-کردن): mostly ر-stems, some ablaut to ـار.
  بردن: "بر", پژمردن: "پژمر", ازردن: "آزار", شمردن: "شمار", سپردن: "سپار",
  افشردن: "افشار",
  // ـودن: stem in ـا.
  نمودن: "نما", گشودن: "گشا", ازمودن: "آزما", افزودن: "افزا", سرودن: "سرا",
  ستودن: "ستا", ربودن: "ربا", پیمودن: "پیما",
  // ـستن.
  بستن: "بند", شکستن: "شکن", گریستن: "گری", شستن: "شوی", کاستن: "کاه",
  رستن: "ره", شایستن: "شای", فرستادن: "فرست",
  // ـاشتن / ـشتن.
  کاشتن: "کار", گماشتن: "گمار", انباشتن: "انبار", گذشتن: "گذر",
  // ـفتن.
  بافتن: "باف", شتافتن: "شتاب", پذیرفتن: "پذیر", شکافتن: "شکاف", تافتن: "تاب",
  شگافتن: "شگاف", خفتن: "خواب", اشفتن: "آشوب", شکفتن: "شکف", شنفتن: "شنو",
  نهفتن: null, سفتن: null,
  // ـختن: stem in ـز.
  سوختن: "سوز", انداختن: "انداز", شناختن: "شناس", اموختن: "آموز", پختن: "پز",
  کشتن: "کش", گداختن: "گداز", دوختن: "دوز", اندوختن: "اندوز", افروختن: "افروز",
  تاختن: "تاز", پرداختن: "پرداز", نواختن: "نواز", باختن: "باز", گریختن: "گریز",
  اویختن: "آویز", انگیختن: "انگیز", بیختن: "بیز",
  // ـندن.
  پراکندن: "پراکن", افکندن: "افکن",
  // Misc.
  جستن: "جو",
  // ZWNJ-joined compound spellings: present is two tokens (استخدام می‌کنم).
  "استخدام‌کردن": null, امضاکردن: null, "خون‌دادن": null, "شرطی‌شدن": null,
  انکارکردن: null,
};

interface RawEntry {
  id: string;
  target: string;
  translit: string;
  glossEn: string;
  pos: string;
  freqRank: number;
  variants: string[];
  presentStem?: string;
  [key: string]: unknown;
}

/** All plausible present-stem parses of a variant. */
function presentParses(variant: string, pastStem: string): string[] {
  const v = normalizeDari(variant);
  let body = v;
  for (const pre of ["نمی‌", "نمی", "می‌", "می"]) {
    if (v.startsWith(pre) && v.length > pre.length + 1) {
      body = v.slice(pre.length);
      break;
    }
  }
  // Bare ن-initial forms are ambiguous: negative prefix (نکنم) or part of the
  // stem (نشینم). Try both readings; majority voting sorts it out.
  const bodies = body === v && body.startsWith("ن") ? [v, v.slice(1)] : [body];
  const stems: string[] = [];
  for (const b of bodies) {
    for (const e of ENDINGS) {
      if (!b.endsWith(e) || b.length <= e.length) continue;
      const stem = b.slice(0, -e.length);
      // Reject past-system parses (کردم → کرد) and implausible 1-char stems.
      if (stem === pastStem || matchKey(stem) === matchKey(pastStem)) continue;
      if ([...stem].length < 2 && stem !== "آ") continue;
      stems.push(stem);
    }
  }
  return stems;
}

/** Majority stem across all parses of all variants; null if no clear winner. */
function extractStem(entry: RawEntry, pastStem: string): string | null {
  const counts = new Map<string, number>();
  for (const v of entry.variants) {
    if (!HAS_PERSIAN.test(v)) continue;
    // Only present-looking variants: می-prefixed, or bare non-past personal form.
    for (const stem of presentParses(v, pastStem)) {
      counts.set(stem, (counts.get(stem) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);
  const [winner, winnerCount] = ranked[0];
  // Treat X and Xی as the same stem (epenthetic ی captured by some parses).
  const rivals = ranked.filter(([s]) => s !== winner && s !== winner + "ی" && winner !== s + "ی");
  if (rivals.length > 0 && rivals[0][1] >= winnerCount) return null; // ambiguous
  return winner;
}

const llmResponseSchema = z.object({
  stems: z.array(z.object({ target: z.string(), presentStem: z.string() })),
});

async function callLlm(prompt: string): Promise<string> {
  const chain = [
    { key: process.env.GROQ_API_KEY, url: "https://api.groq.com/openai/v1", model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile" },
    { key: process.env.OPENROUTER_API_KEY, url: "https://openrouter.ai/api/v1", model: process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free" },
  ].filter((p) => p.key);
  if (chain.length === 0) throw new Error("GROQ_API_KEY or OPENROUTER_API_KEY must be set");
  let lastErr: unknown;
  for (const p of chain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${p.url}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
          body: JSON.stringify({
            model: p.model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
            response_format: { type: "json_object" },
          }),
        });
        if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
        const text = (await res.json())?.choices?.[0]?.message?.content;
        if (!text) throw new Error("empty response");
        return text;
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr;
}

async function llmStems(batch: RawEntry[]): Promise<Map<string, string>> {
  const list = batch.map((e) => `- ${e.target} (${e.translit}, "${e.glossEn}")`).join("\n");
  const prompt = `You are an expert Persian (Dari/Farsi) linguist. For each infinitive verb below, give its PRESENT STEM (بن مضارع) in Persian script only - the stem used in present-tense conjugation. Examples: کردن → کن، رفتن → رو، گفتن → گو، خریدن → خر، پرسیدن → پرس، فهمیدن → فهم.

Verbs:
${list}

Return ONLY JSON: {"stems": [{"target": "<infinitive exactly as given>", "presentStem": "<present stem in Persian script>"}]}`;
  const raw = await callLlm(prompt);
  const parsed = llmResponseSchema.parse(JSON.parse(raw));
  const out = new Map<string, string>();
  for (const s of parsed.stems) {
    const stem = normalizeDari(s.presentStem);
    if (PERSIAN.test(stem) && stem.length > 0) out.set(matchKey(s.target), stem);
  }
  return out;
}

async function main() {
  const file = JSON.parse(readFileSync(lexiconPath, "utf8"));
  const entries: RawEntry[] = file.entries;

  const simpleVerbKeys = new Set(
    entries
      .filter((e) => e.pos === "verb" && !e.target.includes(" ") && /(دن|تن)$/.test(e.target))
      .map((e) => matchKey(normalizeDari(e.target)))
  );

  const bySource = { override: 0, table: 0, regex: 0, llm: 0, compound: 0 };
  const skipped: string[] = [];
  const needLlm: RawEntry[] = [];
  const flagged: string[] = [];
  let cleaned = 0;
  let processed = 0;

  // Pass 1: variant cleanup (all entries) - drop dead Latin-only keys.
  for (const e of entries) {
    const before = e.variants.length;
    e.variants = e.variants.filter((v) => HAS_PERSIAN.test(v));
    cleaned += before - e.variants.length;
  }

  // Pass 2: simple verbs.
  for (const e of entries) {
    if (e.pos !== "verb" || e.target.includes(" ")) continue;
    if (!/(دن|تن)$/.test(e.target)) {
      skipped.push(`${e.id} ${e.target}`);
      continue;
    }
    if (processed++ >= limit) break;
    const inf = normalizeDari(e.target);
    const override = VERB_OVERRIDES[matchKey(inf)];
    if (override?.skip) continue;
    if (override?.presentStem) {
      e.presentStem = override.presentStem;
      bySource.override++;
      continue;
    }
    const tableStem = STEM_TABLE[matchKey(inf)];
    if (tableStem !== undefined) {
      if (tableStem !== null) {
        e.presentStem = tableStem;
        bySource.table++;
      }
      continue;
    }
    const pastStem = derivePastStem(inf)!;
    const stem = extractStem(e, pastStem);
    if (stem) {
      e.presentStem = normalizeDari(stem);
      bySource.regex++;
    } else {
      needLlm.push(e);
    }
  }

  // Pass 3: LLM for the remainder.
  if (needLlm.length > 0 && !dryRun) {
    for (let i = 0; i < needLlm.length; i += 20) {
      const batch = needLlm.slice(i, i + 20);
      try {
        const stems = await llmStems(batch);
        for (const e of batch) {
          const stem = stems.get(matchKey(normalizeDari(e.target)));
          if (stem) {
            e.presentStem = stem;
            bySource.llm++;
          } else {
            skipped.push(`${e.id} ${e.target} (LLM returned nothing)`);
          }
        }
        console.log(`LLM batch ${i / 20 + 1}: ${stems.size}/${batch.length} stems`);
      } catch (err) {
        console.error(`LLM batch failed: ${err}`);
        for (const e of batch) skipped.push(`${e.id} ${e.target} (LLM batch failed)`);
      }
    }
  }

  // Pass 4: compound verbs whose light verb has no simple entry - put the
  // light verb's stem on the highest-frequency compound so lexicon-index can
  // conjugate the light verb under that entry's id.
  const lightVerbCarrier = new Map<string, RawEntry>();
  for (const e of entries) {
    if (e.pos !== "verb" || !e.target.includes(" ")) continue;
    const light = normalizeDari(e.target.split(" ").at(-1)!);
    if (!/(دن|تن)$/.test(light) || simpleVerbKeys.has(matchKey(light))) continue;
    const cur = lightVerbCarrier.get(matchKey(light));
    if (!cur || e.freqRank < cur.freqRank) lightVerbCarrier.set(matchKey(light), e);
  }
  for (const [lightKey, carrier] of lightVerbCarrier) {
    const override = VERB_OVERRIDES[lightKey];
    if (override?.presentStem) {
      carrier.presentStem = override.presentStem;
      bySource.compound++;
    } else {
      skipped.push(`${carrier.id} ${carrier.target} (light verb has no override stem)`);
    }
  }

  // Flag possible separable prefixes for manual review.
  for (const e of entries) {
    if (e.presentStem && /^(بر|در|باز|فرو|وا)/.test(e.target) && !VERB_OVERRIDES[matchKey(normalizeDari(e.target))]) {
      flagged.push(`${e.id} ${e.target} → ${e.presentStem}`);
    }
  }

  file.formatVersion = CONTENT_FORMAT_VERSION;

  console.log(`\nStems: ${bySource.override} override, ${bySource.table} table, ${bySource.regex} regex, ${bySource.llm} LLM, ${bySource.compound} compound-carrier`);
  console.log(`Dropped ${cleaned} non-Persian variants`);
  if (skipped.length) console.log(`\nSkipped (${skipped.length}):\n  ${skipped.join("\n  ")}`);
  if (flagged.length) console.log(`\nPossible prefix verbs - review stems manually:\n  ${flagged.join("\n  ")}`);
  if (needLlm.length && dryRun) console.log(`\n[dry-run] would query LLM for ${needLlm.length} verbs`);

  const regexDerived = entries.filter((e) => e.presentStem && !VERB_OVERRIDES[matchKey(normalizeDari(e.target))] && e.pos === "verb" && !e.target.includes(" "));
  console.log(`\nDerived stems for review:\n  ${regexDerived.map((e) => `${e.target} → ${e.presentStem}`).join("\n  ")}`);

  if (dryRun) {
    console.log("\n[dry-run] no changes written");
    return;
  }
  writeFileSync(lexiconPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nWrote ${lexiconPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
