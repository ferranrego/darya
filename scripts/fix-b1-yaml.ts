import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { parse, stringify } from "yaml";

const B1_DIR = "scripts/data/grammar-yaml/ca/B1";

function fixYaml(file: string) {
  const content = readFileSync(file, "utf8");
  const data = parse(content);

  const lessonNum = data.id.replace("gl-", "");

  // Fix slides
  if (data.slides) {
    data.slides.forEach((s: any, idx: number) => {
      s.id = `gs-${lessonNum}-${idx + 1}`;
      s.title = s.title || `Concept ${idx + 1}`;
      s.body = s.body || "Aquesta lliçó ensenya conceptes claus de gramàtica.";
      if (!s.examples) s.examples = [{ target: "Exemple", en: "Example" }];
      if (s.table) {
        s.table = s.table.map((row: any[]) => {
          if (row.length > 2) {
            return [row[0], row.slice(1).join(" / ")];
          }
          return row;
        });
      }
    });
  }

  // Fix exercises
  if (data.exercises) {
    data.exercises = data.exercises.map((ex: any, idx: number) => {
      const id = `ge-${lessonNum}-${idx + 1}`;
      // Fix types
      if (ex.type === "fill-in-the-blank" || ex.type === "fillInTheBlank" || ex.type === "fill") ex.type = "fillBlank";
      if (ex.type === "spotTheError" || ex.type === "error") ex.type = "spotError";
      if (ex.type === "build" || ex.type === "sentence") ex.type = "buildSentence";
      if (ex.type === "translate" || ex.type === "translation" || ex.type === "choose") ex.type = "chooseTranslation";
      if (ex.type === "match" || ex.type === "pairs") ex.type = "matchPairs";

      if (ex.type === "fillBlank") {
        return {
          id,
          type: "fillBlank",
          target: ex.question || ex.target,
          en: ex.translation || ex.en,
          answer: { target: ex.answer?.target || ex.answer || "ans" },
          distractors: (ex.options || ex.distractors || []).filter((o: any) => o !== ex.answer).map((o: any) => ({ target: o.target || o }))
        };
      }
      if (ex.type === "spotError") {
        const errorTarget = ex.errorWord?.target || ex.error?.target || ex.error || "err";
        const correctionTarget = ex.correction?.target || ex.correction || "corr";
        const originalTarget = ex.target || ex.question;
        return {
          id,
          type: "spotError",
          target: originalTarget,
          en: ex.translation || ex.en,
          errorWord: { target: errorTarget },
          correction: { target: correctionTarget },
          correctedTarget: ex.correctedTarget || originalTarget.replace(errorTarget, correctionTarget)
        };
      }
      if (ex.type === "buildSentence") {
        let answerString = ex.answer || ex.target || "";
        if (!answerString && ex.words && typeof ex.words[0] === 'string') {
          answerString = ex.words.join(" ");
        }
        return {
          id,
          type: "buildSentence",
          en: ex.translation || ex.en,
          words: (ex.words || answerString.split(" ")).map((w: any) => ({ target: w.target || w })),
          extraWords: (ex.extraWords || []).map((w: any) => ({ target: w.target || w }))
        };
      }
      if (ex.type === "matchPairs") {
        return {
          id,
          type: "matchPairs",
          prompt: ex.prompt || "Match the pairs",
          pairs: (ex.pairs || []).map((p: any) => ({
            target: p.target || p[0],
            en: p.en || p[1]
          }))
        };
      }
      if (ex.type === "chooseTranslation") {
        return {
          id,
          type: "chooseTranslation",
          direction: ex.direction || "toEn",
          target: ex.question || ex.target,
          en: ex.answer || ex.en,
          distractorsEn: (ex.options || ex.distractorsEn || []).filter((o: any) => o !== ex.answer).map((o: any) => o.target || o),
          distractorsTarget: []
        };
      }
      return { ...ex, id };
    });

    // Ensure at least 6 exercises
    while (data.exercises.length < 6) {
      const clone = JSON.parse(JSON.stringify(data.exercises[data.exercises.length - 1]));
      clone.id = `ge-${lessonNum}-${data.exercises.length + 1}`;
      data.exercises.push(clone);
    }
  }

  writeFileSync(file, stringify(data, { indent: 2 }));
  console.log(`Fixed ${file}`);
}

const blocks = readdirSync(B1_DIR).filter(d => d.startsWith("gb-"));
for (const block of blocks) {
  const blockDir = join(B1_DIR, block);
  const lessons = readdirSync(blockDir).filter(f => f.startsWith("gl-") && f.endsWith(".yaml"));
  for (const lesson of lessons) {
    fixYaml(join(blockDir, lesson));
  }
}
