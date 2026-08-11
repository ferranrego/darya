const fs = require('fs');
const file = 'scripts/data/seed-texts-ca.ts';
let data = fs.readFileSync(file, 'utf8');

const replacements = [
  // l1-029 costa -> val
  {
    from: '{ target: "Això costa molts diners.", en: "This costs a lot of money." }',
    to: '{ target: "Aquests costen molts diners.", en: "These cost a lot of money." }'
  },
  // l1-026 dona -> porta
  {
    from: '{ target: "El pare dona aigua.", en: "The father gives water." }',
    to: '{ target: "El pare porta aigua.", en: "The father brings water." }'
  },
  // l1-029 dona -> donen
  {
    from: '{ target: "La dona dona menjar al nen.", en: "The woman gives food to the boy." }',
    to: '{ target: "Elles donen menjar al nen.", en: "They give food to the boy." }'
  },
  // l1-043 vol -> canta
  {
    from: '{ target: "Ell vol cantar bé.", en: "He wants to sing well." }',
    to: '{ target: "Ell canta molt bé.", en: "He sings very well." }'
  },
  // l1-048 cuina -> cuinen
  {
    from: '{ target: "El pare cuina una taronja.", en: "The father cooks an orange." }',
    to: '{ target: "Ells cuinen una taronja.", en: "They cook an orange." }'
  },
  // l2-010 vol -> volen
  {
    from: '{ target: "Ell vol acabar d\'hora perquè està cansat.", en: "He wants to finish early because he is tired." }',
    to: '{ target: "Ells volen acabar d\'hora perquè estan cansats.", en: "They want to finish early because they are tired." }'
  },
  // l2-016 vol -> volem
  {
    from: '{ target: "La majoria vol tornar aviat.", en: "The majority wants to return soon." }',
    to: '{ target: "Nosaltres volem tornar aviat.", en: "We want to return soon." }'
  },
  // l2-024 vol -> intenta
  {
    from: '{ target: "El meu propi germà vol matar l\'animal.", en: "My own brother wants to kill the animal." }',
    to: '{ target: "El meu propi germà intenta matar l\'animal.", en: "My own brother tries to kill the animal." }'
  }
];

let changed = 0;
for (const r of replacements) {
  if (data.includes(r.from)) {
    data = data.replace(r.from, r.to);
    changed++;
  } else {
    console.log("NOT FOUND:", r.from);
  }
}

fs.writeFileSync(file, data);
console.log(`Replaced ${changed} strings.`);
