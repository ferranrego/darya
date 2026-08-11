const fs = require('fs');

const replacementsCA = [
  {
    slug: 'l2-022',
    sentences: [
      { target: "Un ocell pren el vol al bosc.", en: "A bird takes flight in the forest." },
      { target: "A l'altra banda, cau un cos.", en: "On the other side, a body falls." },
      { target: "Aquest cos és la part principal de l'arbre.", en: "This body is the main part of the tree." }
    ]
  },
  {
    slug: 'l2-026',
    sentences: [
      { target: "L'home vol crear un edifici.", en: "The man wants to create a building." },
      { target: "Aquest és el segon edifici que fa.", en: "This is the second building he makes." },
      { target: "Ell vol mantenir la casa oberta.", en: "He wants to keep the house open." },
      { target: "Ell atura el cotxe per mirar.", en: "He stops the car to look." }
    ]
  },
  {
    slug: 'l2-029',
    sentences: [
      { target: "La meva parella és del centre.", en: "My partner is from the center." },
      { target: "Ella juga en un equip gran.", en: "She plays in a big team." },
      { target: "Fa un gran pas per jugar.", en: "She takes a great step to play." },
      { target: "Ara és la germana major de l'equip.", en: "Now she is the older sister of the team." }
    ]
  },
  {
    slug: 'l2-034',
    sentences: [
      { target: "Un alemany va a l'illa.", en: "A German goes to the island." },
      { target: "Ell fa una línia a la terra.", en: "He makes a line in the dirt." },
      { target: "Dona una ordre a la gent.", en: "He gives an order to the people." },
      { target: "Aquesta és la causa del problema.", en: "This is the cause of the problem." }
    ]
  },
  {
    slug: 'l2-036',
    sentences: [
      { target: "Quin color t'agrada més?", en: "What color do you like more?" },
      { target: "El nen mitjà llegeix bé.", en: "The middle child reads well." },
      { target: "Aquesta és una prova fàcil.", en: "This is an easy test." },
      { target: "Al final del terme, estem contents.", en: "At the end of the term, we are happy." }
    ]
  },
  {
    slug: 'l2-038',
    sentences: [
      { target: "El president és un home lliure.", en: "The president is a free man." },
      { target: "Ell mira molt d'art.", en: "He looks at a lot of art." },
      { target: "No vol tenir cap arma.", en: "He doesn't want to have any weapon." },
      { target: "És molt actiu tot el dia.", en: "He is very active all day." }
    ]
  },
  {
    slug: 'l2-044',
    sentences: [
      { target: "El seu objectiu és ajudar.", en: "His objective is to help." },
      { target: "Ell dona suport a la mare.", en: "He gives support to the mother." },
      { target: "Això és un exemple d'amor.", en: "This is an example of love." },
      { target: "Ella agafa la baixa avui.", en: "She takes sick leave today." },
      { target: "Ella és el número u.", en: "She is number one." }
    ]
  },
  {
    slug: 'l2-047',
    sentences: [
      { target: "Hi ha pau al país finalment.", en: "There is peace in the country finally." },
      { target: "L'atac ha fet molt mal.", en: "The attack has done a lot of harm." },
      { target: "Ara hem de pagar el compte.", en: "Now we have to pay the bill." }
    ]
  },
  {
    slug: 'l2-052',
    sentences: [
      { target: "El metge veu sang a l'interior.", en: "The doctor sees blood on the inside." },
      { target: "Ell vol realitzar un bon treball.", en: "He wants to carry out a good work." },
      { target: "Agafa una eina petita.", en: "He takes a small tool." }
    ]
  },
  {
    slug: 'l2-054',
    sentences: [
      { target: "El mestre vol soldar.", en: "The teacher wants to weld." },
      { target: "En realitat, no és difícil.", en: "In reality, it is not difficult." },
      { target: "Tot comença a funcionar bé.", en: "Everything begins to function well." },
      { target: "Ell no es pot moure.", en: "He cannot move." }
    ]
  },
  {
    slug: 'l2-058',
    sentences: [
      { target: "La noia veu la construcció nova.", en: "The young woman sees the new construction." },
      { target: "És l'acció anterior a la batalla.", en: "It is the action prior to the battle." }
    ]
  }
];

const file = 'scripts/data/seed-texts-ca.ts';
let data = fs.readFileSync(file, 'utf8');

for (const r of replacementsCA) {
  // We want to replace the sentences array for this slug
  // The structure is:
  // slug: "l2-022",
  // ...
  // sentences: [
  //   { ... },
  //   ...
  // ],
  
  const regex = new RegExp(`(slug:\\s*"${r.slug}"[\\s\\S]*?sentences:\\s*\\[)([\\s\\S]*?)(\\]\\s*,)`, 'm');
  
  const match = data.match(regex);
  if (match) {
    let newSentences = '';
    for (const s of r.sentences) {
      newSentences += `\n      { target: "${s.target}", en: "${s.en}" },`;
    }
    newSentences += '\n    ';
    data = data.replace(regex, `$1${newSentences}$3`);
    console.log(`Replaced sentences for ${r.slug}`);
  } else {
    console.log(`Could not find ${r.slug}`);
  }
}

fs.writeFileSync(file, data);
console.log("Rewrote CA texts.");
