/**
 * Hand-authored seed texts. `pnpm build:texts` tokenizes these against the
 * lexicon and writes full TextDocument JSON to content/texts/seed/.
 * Constraint: every word must resolve to a lexeme (build fails otherwise).
 */

export interface SeedTextSource {
  slug: string;
  level: string;
  titleTarget: string;
  titleTranslit: string;
  titleEn: string;
  sentences: Array<{ target: string; translit: string; en: string }>;
}

export const seedTexts: SeedTextSource[] = [
  {
    slug: "l1-001",
    level: "L1",
    titleTarget: "خانه ما",
    titleTranslit: "khāna-ye mā",
    titleEn: "Our house",
    sentences: [
      { target: "خانه ما کلان است.", translit: "khāna-ye mā kalān ast.", en: "Our house is big." },
      { target: "من با مادر هستم.", translit: "man bā mādar hastam.", en: "I am with mother." },
      { target: "پدر به کار می‌رود.", translit: "padar ba kār mērawad.", en: "Father goes to work." },
      { target: "برادر من به مکتب می‌رود.", translit: "barādar-e man ba maktab mērawad.", en: "My brother goes to school." },
      { target: "چای خوب است.", translit: "chāy khōb ast.", en: "The tea is good." },
    ],
  },
  {
    slug: "l1-002",
    level: "L1",
    titleTarget: "روز من",
    titleTranslit: "rōz-e man",
    titleEn: "My day",
    sentences: [
      { target: "صبح چای می‌خورم.", translit: "subh chāy mēkhuram.", en: "In the morning I drink tea." },
      { target: "به کار می‌روم.", translit: "ba kār mērawam.", en: "I go to work." },
      { target: "شب به خانه می‌آیم.", translit: "shab ba khāna mēāyam.", en: "At night I come home." },
      { target: "نان می‌خورم.", translit: "nān mēkhuram.", en: "I eat food." },
      { target: "شب خوب است.", translit: "shab khōb ast.", en: "The night is good." },
    ],
  },
  {
    slug: "l1-003",
    level: "L1",
    titleTarget: "دوست من",
    titleTranslit: "dōst-e man",
    titleEn: "My friend",
    sentences: [
      { target: "دوست من شاگرد است.", translit: "dōst-e man shāgerd ast.", en: "My friend is a student." },
      { target: "او به پوهنتون می‌رود.", translit: "ō ba pohantūn mērawad.", en: "He goes to the university." },
      { target: "ما با هم چای می‌خوریم.", translit: "mā bā ham chāy mēkhurēm.", en: "We drink tea together." },
      { target: "او کتاب می‌خواند.", translit: "ō ketāb mēkhānad.", en: "He reads a book." },
    ],
  },
  {
    slug: "l2-001",
    level: "L2",
    titleTarget: "بازار",
    titleTranslit: "bāzār",
    titleEn: "The market",
    sentences: [
      { target: "امروز به بازار می‌روم.", translit: "emrōz ba bāzār mērawam.", en: "Today I am going to the market." },
      { target: "از دکان نان می‌خرم.", translit: "az dukān nān mēkharam.", en: "I buy bread from the shop." },
      { target: "سیب سرخ می‌خرم.", translit: "sēb-e surkh mēkharam.", en: "I buy red apples." },
      { target: "در بازار مردم زیاد است.", translit: "dar bāzār mardum-e ziyād ast.", en: "There are many people at the market." },
      { target: "شب به خانه می‌آیم.", translit: "shab ba khāna mēāyam.", en: "At night I come home." },
    ],
  },
  {
    slug: "l2-002",
    level: "L2",
    titleTarget: "زمستان کابل",
    titleTranslit: "zemestān-e kābul",
    titleEn: "Kabul's winter",
    sentences: [
      { target: "زمستان کابل سرد است.", translit: "zemestān-e kābul sard ast.", en: "Kabul's winter is cold." },
      { target: "برف می‌بارد.", translit: "barf mēbārad.", en: "It snows." },
      { target: "مردم لباس گرم می‌پوشند.", translit: "mardum lebās-e garm mēpōshand.", en: "People wear warm clothes." },
      { target: "بچه‌ها در برف بازی می‌کنند.", translit: "bacha-hā dar barf bāzī mēkunand.", en: "The children play in the snow." },
      { target: "چای گرم می‌خوریم.", translit: "chāy-e garm mēkhurēm.", en: "We drink hot tea." },
    ],
  },
  {
    slug: "l2-003",
    level: "L2",
    titleTarget: "فامیل من",
    titleTranslit: "fāmīl-e man",
    titleEn: "My family",
    sentences: [
      { target: "فامیل ما کلان است.", translit: "fāmīl-e mā kalān ast.", en: "Our family is big." },
      { target: "پدرکلانم قصه می‌گوید.", translit: "padarkalānam qessa mēgōyad.", en: "My grandfather tells stories." },
      { target: "مادرکلانم چای می‌آورد.", translit: "mādarkalānam chāy mēāwarad.", en: "My grandmother brings tea." },
      { target: "خاله من در مزار زندگی می‌کند.", translit: "khāla-ye man dar mazār zendagī mēkunad.", en: "My aunt lives in Mazar." },
      { target: "ما با هم نان می‌خوریم.", translit: "mā bā ham nān mēkhurēm.", en: "We eat together." },
    ],
  },
  {
    slug: "l3-001",
    level: "L3",
    titleTarget: "سفر به هرات",
    titleTranslit: "safar ba herāt",
    titleEn: "A trip to Herat",
    sentences: [
      { target: "ما به هرات سفر کردیم.", translit: "mā ba herāt safar kardēm.", en: "We traveled to Herat." },
      { target: "هرات شهر قدیمی است.", translit: "herāt shahr-e qadīmī ast.", en: "Herat is an ancient city." },
      { target: "انگور هرات مشهور است.", translit: "angūr-e herāt mash'hūr ast.", en: "Herat's grapes are famous." },
      { target: "مردم آنجا مهربان هستند.", translit: "mardum-e ānjā mehrabān hastand.", en: "The people there are kind." },
      { target: "سفر ما پنج روز بود.", translit: "safar-e mā panj rōz būd.", en: "Our trip was five days." },
    ],
  },
  {
    slug: "l3-002",
    level: "L3",
    titleTarget: "نوروز",
    titleTranslit: "nawrōz",
    titleEn: "Nawroz",
    sentences: [
      { target: "نوروز جشن کلان است.", translit: "nawrōz jashn-e kalān ast.", en: "Nawroz is a big celebration." },
      { target: "مردم لباس نو می‌پوشند.", translit: "mardum lebās-e naw mēpōshand.", en: "People wear new clothes." },
      { target: "بچه‌ها خوش هستند.", translit: "bacha-hā khush hastand.", en: "The children are happy." },
      { target: "ما به خانه همسایه می‌رویم.", translit: "mā ba khāna-ye hamsāya mērawēm.", en: "We go to the neighbor's house." },
      { target: "سال نو مبارک!", translit: "sāl-e naw mubārak!", en: "Happy New Year!" },
    ],
  },
];
