/**
 * Hand-authored seed texts. `pnpm build:texts` tokenizes these against the
 * lexicon and writes full TextDocument JSON to content/texts/seed/.
 * Constraint: every word must resolve to a lexeme (build fails otherwise).
 */

export interface SeedTextSource {
  slug: string;
  level: string;
  titleDari: string;
  titleTranslit: string;
  titleEn: string;
  sentences: Array<{ dari: string; translit: string; en: string }>;
}

export const seedTexts: SeedTextSource[] = [
  {
    slug: "l1-001",
    level: "L1",
    titleDari: "خانه ما",
    titleTranslit: "khāna-ye mā",
    titleEn: "Our house",
    sentences: [
      { dari: "خانه ما کلان است.", translit: "khāna-ye mā kalān ast.", en: "Our house is big." },
      { dari: "من با مادر هستم.", translit: "man bā mādar hastam.", en: "I am with mother." },
      { dari: "پدر به کار می‌رود.", translit: "padar ba kār mērawad.", en: "Father goes to work." },
      { dari: "برادر من به مکتب می‌رود.", translit: "barādar-e man ba maktab mērawad.", en: "My brother goes to school." },
      { dari: "چای خوب است.", translit: "chāy khōb ast.", en: "The tea is good." },
    ],
  },
  {
    slug: "l1-002",
    level: "L1",
    titleDari: "روز من",
    titleTranslit: "rōz-e man",
    titleEn: "My day",
    sentences: [
      { dari: "صبح چای می‌خورم.", translit: "subh chāy mēkhuram.", en: "In the morning I drink tea." },
      { dari: "به کار می‌روم.", translit: "ba kār mērawam.", en: "I go to work." },
      { dari: "شب به خانه می‌آیم.", translit: "shab ba khāna mēāyam.", en: "At night I come home." },
      { dari: "نان می‌خورم.", translit: "nān mēkhuram.", en: "I eat food." },
      { dari: "شب خوب است.", translit: "shab khōb ast.", en: "The night is good." },
    ],
  },
  {
    slug: "l1-003",
    level: "L1",
    titleDari: "دوست من",
    titleTranslit: "dōst-e man",
    titleEn: "My friend",
    sentences: [
      { dari: "دوست من شاگرد است.", translit: "dōst-e man shāgerd ast.", en: "My friend is a student." },
      { dari: "او به پوهنتون می‌رود.", translit: "ō ba pohantūn mērawad.", en: "He goes to the university." },
      { dari: "ما با هم چای می‌خوریم.", translit: "mā bā ham chāy mēkhurēm.", en: "We drink tea together." },
      { dari: "او کتاب می‌خواند.", translit: "ō ketāb mēkhānad.", en: "He reads a book." },
    ],
  },
  {
    slug: "l2-001",
    level: "L2",
    titleDari: "بازار",
    titleTranslit: "bāzār",
    titleEn: "The market",
    sentences: [
      { dari: "امروز به بازار می‌روم.", translit: "emrōz ba bāzār mērawam.", en: "Today I am going to the market." },
      { dari: "از دکان نان می‌خرم.", translit: "az dukān nān mēkharam.", en: "I buy bread from the shop." },
      { dari: "سیب سرخ می‌خرم.", translit: "sēb-e surkh mēkharam.", en: "I buy red apples." },
      { dari: "در بازار مردم زیاد است.", translit: "dar bāzār mardum-e ziyād ast.", en: "There are many people at the market." },
      { dari: "شب به خانه می‌آیم.", translit: "shab ba khāna mēāyam.", en: "At night I come home." },
    ],
  },
  {
    slug: "l2-002",
    level: "L2",
    titleDari: "زمستان کابل",
    titleTranslit: "zemestān-e kābul",
    titleEn: "Kabul's winter",
    sentences: [
      { dari: "زمستان کابل سرد است.", translit: "zemestān-e kābul sard ast.", en: "Kabul's winter is cold." },
      { dari: "برف می‌بارد.", translit: "barf mēbārad.", en: "It snows." },
      { dari: "مردم لباس گرم می‌پوشند.", translit: "mardum lebās-e garm mēpōshand.", en: "People wear warm clothes." },
      { dari: "بچه‌ها در برف بازی می‌کنند.", translit: "bacha-hā dar barf bāzī mēkunand.", en: "The children play in the snow." },
      { dari: "چای گرم می‌خوریم.", translit: "chāy-e garm mēkhurēm.", en: "We drink hot tea." },
    ],
  },
  {
    slug: "l2-003",
    level: "L2",
    titleDari: "فامیل من",
    titleTranslit: "fāmīl-e man",
    titleEn: "My family",
    sentences: [
      { dari: "فامیل ما کلان است.", translit: "fāmīl-e mā kalān ast.", en: "Our family is big." },
      { dari: "پدرکلانم قصه می‌گوید.", translit: "padarkalānam qessa mēgōyad.", en: "My grandfather tells stories." },
      { dari: "مادرکلانم چای می‌آورد.", translit: "mādarkalānam chāy mēāwarad.", en: "My grandmother brings tea." },
      { dari: "خاله من در مزار زندگی می‌کند.", translit: "khāla-ye man dar mazār zendagī mēkunad.", en: "My aunt lives in Mazar." },
      { dari: "ما با هم نان می‌خوریم.", translit: "mā bā ham nān mēkhurēm.", en: "We eat together." },
    ],
  },
  {
    slug: "l3-001",
    level: "L3",
    titleDari: "سفر به هرات",
    titleTranslit: "safar ba herāt",
    titleEn: "A trip to Herat",
    sentences: [
      { dari: "ما به هرات سفر کردیم.", translit: "mā ba herāt safar kardēm.", en: "We traveled to Herat." },
      { dari: "هرات شهر قدیمی است.", translit: "herāt shahr-e qadīmī ast.", en: "Herat is an ancient city." },
      { dari: "انگور هرات مشهور است.", translit: "angūr-e herāt mash'hūr ast.", en: "Herat's grapes are famous." },
      { dari: "مردم آنجا مهربان هستند.", translit: "mardum-e ānjā mehrabān hastand.", en: "The people there are kind." },
      { dari: "سفر ما پنج روز بود.", translit: "safar-e mā panj rōz būd.", en: "Our trip was five days." },
    ],
  },
  {
    slug: "l3-002",
    level: "L3",
    titleDari: "نوروز",
    titleTranslit: "nawrōz",
    titleEn: "Nawroz",
    sentences: [
      { dari: "نوروز جشن کلان است.", translit: "nawrōz jashn-e kalān ast.", en: "Nawroz is a big celebration." },
      { dari: "مردم لباس نو می‌پوشند.", translit: "mardum lebās-e naw mēpōshand.", en: "People wear new clothes." },
      { dari: "بچه‌ها خوش هستند.", translit: "bacha-hā khush hastand.", en: "The children are happy." },
      { dari: "ما به خانه همسایه می‌رویم.", translit: "mā ba khāna-ye hamsāya mērawēm.", en: "We go to the neighbor's house." },
      { dari: "سال نو مبارک!", translit: "sāl-e naw mubārak!", en: "Happy New Year!" },
    ],
  },
];
