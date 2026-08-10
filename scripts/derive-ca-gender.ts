/**
 * Derive Catalan noun gender from the entry's own authored `exampleTarget`.
 *
 * No lexicon entry records gender today, and a deterministic sentence frame
 * cannot agree an article or an adjective without it - `el cadira blanc`
 * instead of `la cadira blanca` is what an ungendered filler produces. Every
 * noun already carries a hand-written example sentence, almost always with a
 * determiner or a predicate adjective attached, so gender is recoverable
 * without asking anyone to type it in from scratch.
 *
 * One pass: a determiner immediately before the headword (`la casa`, `un
 * gos`). Anything it does not resolve is reported, not guessed.
 *
 * A second pass used to fire on `l'`-elision, disambiguated by a predicate
 * adjective's `-a` ending elsewhere in the sentence (`L'aigua és freda` ->
 * f). A philologist review of its output found it wrong 5 times in the 10
 * entries it resolved: it treated any `-a`-ending token as an adjective,
 * which a 3rd-person `-ar` verb (`fa`, `canta`, `m'agrada`) and an unrelated
 * noun (`muntanya`, `platja`) both are, so `aire`, `estiu`, `hivern`,
 * `ocell` and `esport` were all derived feminine from a verb or an unrelated
 * word in their sentence, not from anything that agreed with them. The other
 * 5 it got right were right by coincidence, not by evidence - matching the
 * elided headword against itself, or a real adjective that agreed with a
 * *different* noun in the sentence. Retired rather than fixed: a heuristic
 * with a 50% failure rate on the cases it fires on is not worth trying to
 * patch, and the words it used to cover are hand-resolved below instead.
 *
 * Scoped to `beginner-spec.json`-typed nouns (~200 of 3,143), not the whole
 * lexicon: that is the vocabulary the frame engine actually fills slots from
 * (see beginner-spec.ts), so it is the vocabulary that needs to be *right*,
 * not merely present. Extending coverage later is adding rows to this run,
 * not redesigning it.
 *
 * Usage:
 *   node scripts/derive-ca-gender.ts              # report only
 *   node scripts/derive-ca-gender.ts --apply       # write the resolved ones
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lexiconFileSchema, type LexiconEntry } from "../src/lib/content/schema.ts";
import { buildLexiconIndex as buildCa } from "../src/lib/lang/ca/lexicon-index.ts";
import { contentRoot } from "./content-path.ts";
import { readSpec, specWords } from "./verify-beginner-core.ts";

const FEMININE_DET = new Set([
  "la", "una", "les", "unes", "aquesta", "aquestes", "molta", "moltes",
  "meva", "teva", "seva", "nostra", "vostra", "poca", "tota",
]);
const MASCULINE_DET = new Set([
  "el", "un", "els", "uns", "aquest", "aquests", "molt", "molts",
  "meu", "teu", "seu", "nostre", "vostre", "poc", "tot", "del", "al",
]);
// "cada" (each) is deliberately not in either set: it is gender-invariant
// (cada dia m., cada setmana f.) and proves nothing about the noun that
// follows it - a philologist review caught this as a latent miscall waiting
// for the first entry it happened to sit in front of.

/**
 * Just enough of the plural rule to recognise a plural in an example
 * sentence, not to author one - see `src/lib/lang/ca/surface.ts` for the
 * real, single-answer version. A philologist review caught this missing the
 * c/g/ç/j respelling before feminine -es (taronja -> taronges, not
 * *taronjes), which under-resolves rather than mis-resolves: pass 1 simply
 * fails to match a real plural spelled the respelled way, and the entry falls
 * through to hand review - annoying, not wrong, but cheap to fix.
 */
function pluralOf(base: string): string[] {
  if (/a$/.test(base)) {
    const stem = base.slice(0, -1);
    if (/c$/.test(stem)) return [stem.slice(0, -1) + "ques"];
    if (/g$/.test(stem)) return [stem.slice(0, -1) + "gues"];
    if (/ç$/.test(stem)) return [stem.slice(0, -1) + "ces"];
    if (/j$/.test(stem)) return [stem.slice(0, -1) + "ges"];
    return [stem + "es"];
  }
  return [base + "s", base + "os"];
}

/**
 * What the two derivation passes cannot see, hand-resolved and awaiting the
 * philologist pass CLAUDE.md requires before content ships.
 *
 * Two kinds of gap, and they need different handling:
 *
 *  - Ordinary nouns whose example sentence carries no determiner or agreeing
 *    adjective at all - `Avui és dilluns`, `Fa molt de vent`, `No menjo
 *    carn`. The days of the week are a closed class and share one answer
 *    (masculine: `el dilluns`), noted once rather than seven times.
 *  - Epicene nouns - `estudiant`, `català` - whose grammatical gender is not a
 *    property of the word at all; the same form takes either article
 *    depending on who is being talked about (`un estudiant` / `una
 *    estudiant`). These are marked "common" rather than guessed into one
 *    gender, so a frame filling a `[NOUN.human]` slot from one of them knows
 *    to agree the rest of the sentence with whichever referent it picked, not
 *    with a gender the noun does not have.
 */
const HAND_RESOLVED: Record<string, "m" | "f" | "common"> = {
  "lx-0067": "m", // any - l'any passat, un any
  "lx-0070": "m", // home - l'home
  "lx-0073": "m", // temps - el temps
  "lx-0325": "m", // sol - el sol
  "lx-0087": "m", // nom - el nom
  "lx-0338": "f", // hora - la hora / l'hora
  "lx-0317": "f", // música - la música
  "lx-1981": "f", // pedra - la pedra
  "lx-0542": "m", // paper - el paper
  "lx-0600": "m", // amor - l'amor
  "lx-1041": "m", // diners - els diners
  "lx-0320": "f", // festa - la festa
  "lx-0132": "f", // son (sleepiness) - la son
  "lx-0711": "m", // te - el te
  "lx-0310": "common", // estudiant - un/una estudiant
  "lx-0580": "m", // animal - l'animal
  "lx-0604": "f", // por - la por
  "lx-0955": "m", // cavall - el cavall
  // català: NOT epicene (philologist review) - DIEC2 gives a regular m./f.
  // pair, català/catalana, like italià/italiana. The entry already carries
  // the feminine as a variant ("catalanes" etc.), so the headword itself is
  // masculine, the same as its "language" sense (el català).
  "lx-0001": "m", // català
  "lx-0408": "m", // hospital - l'hospital
  "lx-3962": "f", // esquerra - l'esquerra
  "lx-0558": "m", // avió - l'avió
  "lx-0465": "m", // octubre - months are masculine
  "lx-0328": "m", // arbre - l'arbre
  "lx-0795": "f", // estació - l'estació
  "lx-1290": "f", // estrella - l'estrella
  "lx-0327": "m", // vent - el vent
  "lx-0459": "m", // abril
  "lx-0463": "m", // agost
  "lx-0295": "f", // carn - la carn
  "lx-0393": "m", // oli - l'oli
  "lx-0290": "f", // llet - la llet
  "lx-3151": "m", // ample (bandwidth) - l'ample de banda
  "lx-0455": "m", // diumenge - days of the week are masculine
  "lx-0453": "m", // divendres
  "lx-0454": "m", // dissabte
  "lx-0302": "m", // sucre - el sucre
  "lx-0293": "f", // fruita - la fruita
  "lx-0304": "f", // taronja - la taronja
  "lx-0561": "m", // autobús - l'autobús
  "lx-0449": "m", // dilluns
  "lx-1068": "m", // conill - el conill
  "lx-0452": "m", // dijous
  "lx-0450": "m", // dimarts
  "lx-0367": "m", // armari - l'armari
  "lx-0451": "m", // dimecres
  "lx-0297": "m", // arròs - l'arròs
  "lx-0306": "f", // verdura - la verdura
  "lx-0432": "f", // sabata - la sabata
  "lx-0502": "m", // mitjó - el mitjó
  // The ten words the retired pass 2 used to cover (see the note above),
  // hand-resolved directly. Five of these (aire, estiu, hivern, ocell,
  // esport) are exactly the words a philologist review found that pass
  // getting wrong - confirmed masculine here, the opposite of what it said.
  "lx-0079": "f", // aigua - l'aigua freda
  "lx-0099": "f", // escola - l'escola
  "lx-1504": "m", // aire - l'aire
  "lx-0923": "f", // habitació - l'habitació
  "lx-0139": "m", // estiu - l'estiu
  "lx-0140": "m", // hivern - l'hivern
  "lx-0738": "f", // esquena - l'esquena
  "lx-0332": "m", // ocell - l'ocell
  "lx-0731": "f", // orella - l'orella
  "lx-0609": "m", // esport - l'esport
};

function deriveGender(entry: LexiconEntry): "m" | "f" | null {
  const example = entry.exampleTarget ?? "";
  const head = entry.target.toLowerCase();
  const forms = new Set([head, ...pluralOf(head)]);
  const toks = example
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[«"'(¿¡]+|[.,!?;:»"')]+$/g, ""));

  // An immediately preceding determiner.
  for (let i = 1; i < toks.length; i++) {
    if (!forms.has(toks[i])) continue;
    const prev = toks[i - 1];
    if (FEMININE_DET.has(prev)) return "f";
    if (MASCULINE_DET.has(prev)) return "m";
  }

  return null;
}

/** Which lexeme ids `beginner-spec.json` types, resolved the same way `scripts/verify-beginner-core.ts` counts coverage. */
function specTypedIds(entries: readonly LexiconEntry[]): Set<string> {
  const root = contentRoot();
  const spec = readSpec(root);
  if (!spec) return new Set();
  const index = buildCa([...entries]);
  const ids = new Set<string>();
  for (const word of specWords(spec)) {
    const direct = index.resolve(word);
    if (direct) {
      ids.add(direct.id);
      continue;
    }
    const parts = word.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const resolved = parts.map((p) => index.resolve(p));
    if (resolved.every((e) => e)) for (const e of resolved) ids.add(e!.id);
  }
  return ids;
}

function main() {
  const apply = process.argv.includes("--apply");
  const lexiconPath = join(contentRoot(), "lexicon", "lexicon.json");
  const file = lexiconFileSchema.parse(JSON.parse(readFileSync(lexiconPath, "utf8")));

  const typedIds = specTypedIds(file.entries);
  const targets = file.entries.filter((e) => e.pos === "noun" && typedIds.has(e.id));
  const resolved: { entry: LexiconEntry; gender: "m" | "f" | "common"; source: "derived" | "hand" }[] = [];
  const unresolved: LexiconEntry[] = [];

  for (const entry of targets) {
    const derived = deriveGender(entry);
    const hand = HAND_RESOLVED[entry.id];
    if (derived) resolved.push({ entry, gender: derived, source: "derived" });
    else if (hand) resolved.push({ entry, gender: hand, source: "hand" });
    else unresolved.push(entry);
  }

  console.log(
    `${targets.length} spec-typed nouns: ` +
      `${resolved.filter((r) => r.source === "derived").length} derived from the example sentence, ` +
      `${resolved.filter((r) => r.source === "hand").length} hand-resolved (awaiting philologist review), ` +
      `${unresolved.length} unresolved\n`,
  );
  if (unresolved.length) {
    console.log("unresolved:");
    console.log(unresolved.map((e) => `  ${e.id}\t${e.target}\t"${e.exampleTarget}"`).join("\n"));
  }

  console.log("\nhand-resolved batch, for review:");
  console.log(
    resolved
      .filter((r) => r.source === "hand")
      .map((r) => `  ${r.entry.id}\t${r.entry.target} (${r.gender})\t"${r.entry.exampleTarget}"`)
      .join("\n"),
  );

  if (!apply) {
    console.log("\n(report only - pass --apply to write the resolved genders)");
    return;
  }

  const byId = new Map(resolved.map((r) => [r.entry.id, r.gender]));
  file.entries = file.entries.map((e) => (byId.has(e.id) ? { ...e, gender: byId.get(e.id) } : e));
  writeFileSync(lexiconPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nwrote ${resolved.length} genders to ${lexiconPath}`);
}

main();
