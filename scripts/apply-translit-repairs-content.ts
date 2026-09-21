/**
 * Apply a word-level transliteration repair across `content/<lang>/` outside
 * the lexicon - the grammar course, the Grammar Hub, seed texts, the alphabet.
 *
 * The lexicon has `apply-translit-repairs.ts`, which works entry by entry. The
 * rest of the content has no entry ids to key on, so this replaces whole Latin
 * words in any `*ranslit` field, and only words named explicitly on the command
 * line's map file. It will not touch a field the map does not mention.
 *
 *   node scripts/apply-translit-repairs-content.ts --map <file.json> [--dry]
 *
 * The map is {"was": "now"}, matched on whole hyphen-or-space delimited words
 * so `motar` cannot rewrite the inside of another word.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contentRoot } from "./content-path.ts";

const at = process.argv.indexOf("--map");
const mapPath = at !== -1 ? process.argv[at + 1] : undefined;
const dry = process.argv.includes("--dry");
if (!mapPath) {
  console.error("usage: node scripts/apply-translit-repairs-content.ts --map <file.json> [--dry]");
  process.exit(1);
}
const map: Record<string, string> = JSON.parse(readFileSync(mapPath, "utf8"));
const BOUNDARY = "[\\s\\-\\u2014(),.:;?!\"'\u00ab\u00bb]";
const edges = `(^|${BOUNDARY})`;

function repair(text: string): string {
  let out = text;
  for (const [was, now] of Object.entries(map)) {
    out = out.replace(new RegExp(`${edges}${was}(?=$|${BOUNDARY})`, "gu"), (_m, pre) => pre + now);
  }
  return out;
}

let changed = 0;
const files: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith(".json") && !p.includes("lexicon.json")) files.push(p);
  }
};
walk(contentRoot());

for (const path of files) {
  const raw = readFileSync(path, "utf8");
  const json = JSON.parse(raw);
  let touched = false;
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === "string" && /ranslit$/i.test(k)) {
          const next = repair(v);
          if (next !== v) {
            console.log(`${path.replace(contentRoot() + "/", "")}\n  - ${v}\n  + ${next}`);
            o[k] = next;
            changed++;
            touched = true;
          }
        } else visit(v);
      }
    }
  };
  visit(json);
  if (touched && !dry) writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
}
console.log(`\n${changed} field(s) ${dry ? "would change" : "changed"} across ${files.length} files`);
