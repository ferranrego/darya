const fs = require('fs');

const ALL_JSON_PATH = 'content/ca/grammar/all.json';
const data = JSON.parse(fs.readFileSync(ALL_JSON_PATH, 'utf8'));

// Find the last used IDs in A1, A2, B1
let nextBlock = 1;
let nextLesson = 1;

for (const course of data.courses) {
  if (['A1', 'A2', 'B1'].includes(course.level)) {
    for (const block of course.blocks) {
      const bId = parseInt(block.id.split('-')[1], 10);
      if (bId >= nextBlock) nextBlock = bId + 1;
      
      for (const lesson of block.lessons) {
        const lId = parseInt(lesson.id.split('-')[1], 10);
        if (lId >= nextLesson) nextLesson = lId + 1;
      }
    }
  }
}

// Fix B2, C1, C2 courses
for (const course of data.courses) {
  if (['B2', 'C1', 'C2'].includes(course.level)) {
    // Inject required fields
    course.formatVersion = '1.1';
    course.language = 'ca';
    
    // Fix IDs
    for (const block of course.blocks) {
      block.id = `gb-${nextBlock.toString().padStart(2, '0')}`;
      nextBlock++;
      
      for (const lesson of block.lessons) {
        lesson.id = `gl-${nextLesson.toString().padStart(2, '0')}`;
        nextLesson++;
      }
    }
  }
}

fs.writeFileSync(ALL_JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
console.log('Fixed B2, C1, C2 courses formatting and IDs.');
