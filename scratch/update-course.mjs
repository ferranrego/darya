import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'content/alphabet/course.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

for (const unit of data.units) {
  const allChars = unit.letters.map(l => l.char);
  for (const ex of unit.exercises) {
    if (ex.distractors && ex.distractors.length < 3) {
      const target = ex.targetChar;
      const needed = 3 - ex.distractors.length;
      const available = allChars.filter(c => c !== target && !ex.distractors.includes(c));
      for (let i = 0; i < needed; i++) {
        // Just push if available, if not, find from previous units
        if (available.length > 0) {
          const c = available.pop();
          ex.distractors.push(c);
        } else {
          // If we run out of letters in this unit (very rare), just pick a generic fallback
          ex.distractors.push('ا');
        }
      }
    }
    
    if (ex.type === "readWord") {
      if (ex.choices && ex.choices.length < 4) {
         // Never auto-pad with fake choices - a padded choice derived from the
         // correct answer once leaked into course.json as "mēwaz0" etc.
         // Real distractors must be written by hand.
         throw new Error(`readWord ${ex.id} has only ${ex.choices.length} choices; add real distractors manually`);
      }
    }
  }

  // Adding some dummy recognizeForm exercises if none exist
  if (!unit.exercises.some(e => e.type === 'recognizeForm')) {
     const letter = unit.letters[0];
     if (letter) {
         unit.exercises.push({
           id: unit.id + "-f1",
           type: "recognizeForm",
           targetChar: letter.char,
           targetForm: "initial",
           glyph: letter.forms.initial,
           distractors: unit.letters.filter(l => l.char !== letter.char).map(l => l.char).slice(0, 3)
         });
         // Make sure we have enough distractors
         const lastEx = unit.exercises[unit.exercises.length - 1];
         while (lastEx.distractors.length < 3) lastEx.distractors.push("ا");
     }
  }
}

fs.writeFileSync(file, JSON.stringify(data, null, 2));
