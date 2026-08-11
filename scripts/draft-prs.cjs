const fs = require('fs');

const l1Texts = [
  { slug: "l1-029", prs: "او محبت دارد.\\nاین محبت بزرگ است.", en: "He has affection.\\nThis affection is big." },
  { slug: "l1-030", prs: "مهتاب در دشت است.\\nاین بحر خوب است.", en: "The moon is in the plain.\\nThis meter is good." },
  { slug: "l1-031", prs: "او هوشیار و بهادر است.\\nآن نادان اینجا نیست.", en: "He is clever and brave.\\nThat ignorant is not here." },
  { slug: "l1-032", prs: "بی‌بی در خانه است.\\nبی‌بی من پیر است.", en: "Grandmother is in the house.\\nMy grandmother is old." },
  { slug: "l1-033", prs: "روغن و نمک ترش نیست.\\nپنیر و شکر روی میز است.", en: "Oil and salt are not sour.\\nCheese and sugar are on the table." },
  { slug: "l1-034", prs: "الماری و تشناب بزرگ است.\\nکلید کجاست؟", en: "The cupboard and the bathroom are big.\\nWhere is the key?" },
  { slug: "l1-035", prs: "ناشتا با پیاز است.\\nکچالو و سبزی می‌خوریم.", en: "Breakfast is with onion.\\nWe eat potato and vegetable." },
  { slug: "l1-036", prs: "طفل روی خاک می‌خزد.\\nکل مردم به یک سو می‌بالند.", en: "The child crawls on the dirt.\\nAll the people grow in one direction." },
  { slug: "l1-037", prs: "من شک ندارم.\\nشک شما بیجا است.", en: "I have no doubt.\\nYour doubt is out of place." }
];

const l2Texts = [
  { slug: "l2-031", prs: "گزارش دستگاه خراب است.\\nمیدان چند درجه است؟", en: "The device's report is broken.\\nHow many degrees is the square?" },
  { slug: "l2-032", prs: "شعر سینمای داخلی خوب است.\\nاو در عروسی رنجید.", en: "The domestic cinema's poem is good.\\nHe was offended at the wedding." },
  { slug: "l2-033", prs: "خارجی آزادی می‌خواهد.\\nرخسار او در ماموریت مستقیم بود.", en: "The foreigner wants freedom.\\nHis cheek was straight in the precinct." },
  { slug: "l2-034", prs: "همسایه در شکست شدید است.\\nهدف دریدن کاغذ بود.", en: "The neighbor is in a severe defeat.\\nThe goal was to tear the paper." },
  { slug: "l2-035", prs: "کارگر شبکه طراحی می‌کند.\\nنسخه برای مغز است.", en: "The worker designs the network.\\nThe prescription is for the brain." },
  { slug: "l2-036", prs: "او شعر می‌سراید و می‌نازد.\\nبرق برخاست و ما را آزرد.", en: "He composes poetry and boasts.\\nThe lightning rose and hurt us." },
  { slug: "l2-037", prs: "وکیل هرات تصمیم می‌گیرد.\\nجامعه پرتره او را دید.", en: "The lawyer of Herat makes a decision.\\nSociety saw his portrait." },
  { slug: "l2-038", prs: "تولید فیلم برای تلویزیون است.\\nسرویس کاملاً نو است.", en: "The production of the film is for television.\\nThe bus is completely new." },
  { slug: "l2-039", prs: "استاد می‌خندد و می‌افزاید.\\nنتیجه امنیت خوب است.", en: "The professor laughs and adds.\\nThe result of security is good." },
  { slug: "l2-040", prs: "برگ می‌چسبد وقتی باد می‌وزد.\\nافغانی چوب می‌سوزاند.", en: "The leaf sticks when the wind blows.\\nThe Afghan burns wood." },
  { slug: "l2-041", prs: "معمولاً زخم شایسته است.\\nاو کلاه می‌بافد و می‌بوسد.", en: "Usually the wound is worthy.\\nHe knits a hat and kisses." },
  { slug: "l2-042", prs: "سازمان شرایط را می‌شکافد.\\nدهقان موی می‌تابد.", en: "The organization splits the conditions.\\nThe farmer twists hair." },
  { slug: "l2-043", prs: "مسافر تلاش می‌کند تا بگذرد.\\nما در عید می‌کوشیم.", en: "The passenger makes an effort to cross.\\nWe try during Eid." },
  { slug: "l2-044", prs: "دلیل مشخص واقعی است.\\nاو مردم را می‌انگیزد.", en: "The specific reason is real.\\nHe rouses the people." }
];

fs.writeFileSync('scripts/data/prs-l1-batch-02.json', JSON.stringify(l1Texts, null, 2));
fs.writeFileSync('scripts/data/prs-l2-batch-02.json', JSON.stringify(l2Texts, null, 2));
console.log("Written PRS texts.");
