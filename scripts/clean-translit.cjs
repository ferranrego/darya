const fs = require('fs');

const ALL_JSON_PATH = 'content/ca/grammar/all.json';
const data = JSON.parse(fs.readFileSync(ALL_JSON_PATH, 'utf8'));

function deleteTranslit(obj) {
  if (obj && typeof obj === 'object') {
    if (obj.translit !== undefined) {
      delete obj.translit;
    }
    for (const key of Object.keys(obj)) {
      deleteTranslit(obj[key]);
    }
  }
}

deleteTranslit(data);

fs.writeFileSync(ALL_JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
console.log('Deleted ALL translit properties from Catalan grammar json.');
