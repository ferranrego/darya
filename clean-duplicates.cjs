const fs = require('fs');
const path = require('path');

function cleanFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  for (const block of data.blocks) {
    for (const lesson of block.lessons) {
      if (lesson.id === 'gl-01') continue;
      
      lesson.exercises = lesson.exercises.filter(ex => {
        if (ex.target === 'Nosaltres ___ a casa.' ||
            ex.target === 'El llibre està aquí.' ||
            ex.target === 'La casa és gran.') {
          return false;
        }
        return true;
      });
    }
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

cleanFile(path.join(__dirname, 'scripts/data/ca-grammar-a1.json'));
cleanFile(path.join(__dirname, 'scripts/data/ca-grammar-a2.json'));
console.log('Cleaned duplicates!');
