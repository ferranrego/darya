const fs = require('fs');

const replacementsPRS = [
  {
    slug: 'l2-011',
    sentences: [
      { target: "مرد دوباره در شهر می‌گردد.", en: "The man strolls in the city again." },
      { target: "او یک خبر تازه دارد.", en: "He has fresh news." },
      { target: "حرف او بسیار خوب است.", en: "His word is very good." }
    ]
  },
  {
    slug: 'l2-016',
    sentences: [
      { target: "رئیس کشتی در ساحل است.", en: "The boss of the ship is on the beach." },
      { target: "او یک درخت می‌کارد.", en: "He plants a tree." },
      { target: "سپس، قند را در آب می‌اندازد.", en: "Then, he throws sugar in the water." }
    ]
  },
  {
    slug: 'l2-021',
    sentences: [
      { target: "زنگ مکتب می‌زند.", en: "The school bell rings." },
      { target: "جشن شروع می‌شود.", en: "The celebration starts." },
      { target: "چقدر سوال در امتحان است؟", en: "How many questions are in the exam?" },
      { target: "کتاب در آتش می‌سوزد.", en: "The book burns in the fire." }
    ]
  },
  {
    slug: 'l2-024',
    sentences: [
      { target: "کارمند در شرق کار می‌کند.", en: "The employee works in the east." },
      { target: "او نیاز به متر دارد.", en: "He needs a tape measure." },
      { target: "چوب درخت می‌پوسد.", en: "The wood of the tree rots." }
    ]
  },
  {
    slug: 'l2-031',
    sentences: [
      { target: "دستگاه گزارش خراب است.", en: "The reporting device is broken." },
      { target: "میدان گرم است.", en: "The field is warm." },
      { target: "هوا چند درجه است؟", en: "How many degrees is the weather?" }
    ]
  },
  {
    slug: 'l2-035',
    sentences: [
      { target: "کارگر در شبکه طراحی می‌کند.", en: "The worker designs in the network." },
      { target: "او برای مغز نسخه می‌گیرد.", en: "He takes a prescription for the brain." }
    ]
  },
  {
    slug: 'l2-036',
    sentences: [
      { target: "او شعر می‌سراید.", en: "He composes poetry." },
      { target: "به شعر خود می‌نازد.", en: "He boasts about his poetry." },
      { target: "برق در آسمان برخاست.", en: "Lightning rose in the sky." },
      { target: "این کار مرا آزرد.", en: "This act hurt me." }
    ]
  },
  {
    slug: 'l2-040',
    sentences: [
      { target: "باد می‌وزد و برگ می‌چسبد.", en: "The wind blows and the leaf sticks." },
      { target: "مرد افغانی کاغذ می‌سوزاند.", en: "The Afghan man burns paper." }
    ]
  },
  {
    slug: 'l2-041',
    sentences: [
      { target: "معمولاً زخم او درد دارد.", en: "Usually his wound has pain." },
      { target: "مادر او کلاه می‌بافد.", en: "His mother knits a hat." },
      { target: "مادر روی او را می‌بوسد.", en: "The mother kisses his face." },
      { target: "او شایسته محبت است.", en: "He is worthy of affection." }
    ]
  },
  {
    slug: 'l2-042',
    sentences: [
      { target: "دهقان شرایط سازمان را می‌شکافد.", en: "The farmer splits the organization's conditions." },
      { target: "او موی اسب را می‌تابد.", en: "He twists the horse's hair." }
    ]
  }
];

const file = 'scripts/data/seed-texts-prs.ts';
let data = fs.readFileSync(file, 'utf8');

for (const r of replacementsPRS) {
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
console.log("Rewrote PRS texts.");
