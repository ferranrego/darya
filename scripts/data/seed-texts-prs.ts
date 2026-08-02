/**
 * Hand-authored seed texts. `pnpm build:texts` tokenizes these against the
 * lexicon and writes full TextDocument JSON to content/texts/seed/.
 * Constraint: every word must resolve to a lexeme (build fails otherwise).
 */

export interface SeedTextSource {
  slug: string;
  level: string;
  titleTarget: string;
  titleTranslit?: string;
  titleEn: string;
  sentences: Array<{ target: string; translit?: string; en: string }>;
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
  {
    slug: "l4-001",
    level: "L4",
    titleTarget: "دوستم در کابل",
    titleTranslit: "dōstam dar kābul",
    titleEn: "My friend in Kabul",
    sentences: [
      { target: "دوستی که در قریه ما کلان شد، حالا در کابل زندگی می‌کند.", translit: "dōstē ke dar qarya-ye mā kalān shud, hālā dar kābul zendagī mēkunad.", en: "A friend who grew up in our village now lives in Kabul." },
      { target: "او سال گذشته به آنجا رفته است.", translit: "ō sāl-e guzashta ba ānjā rafta ast.", en: "He went there last year." },
      { target: "اگر کارش خوب پیش برود، فامیلش را هم به کابل می‌آورد.", translit: "agar kārash khōb pēsh berawad, fāmīlash rā ham ba kābul mēāwarad.", en: "If his work goes well, he will bring his family to Kabul too." },
      { target: "خانه نو او در شهر ساخته شده است.", translit: "khāna-ye naw-e ō dar shahr sākhta shuda ast.", en: "His new house has been built in the city." },
      { target: "هفته پیش او به ما زنگ زد و گفت که دلش برای قریه تنگ شده است.", translit: "hafta pēsh ō ba mā zang zad wa guft ke delash barāyi qarya tang shuda ast.", en: "Last week he called us and said that he has become homesick for the village." },
      { target: "ما هم منتظر هستیم که او دوباره به دیدن ما بیاید.", translit: "mā ham muntazir hastēm ke ō dōbāra ba dīdan-e mā biyāyad.", en: "We are also waiting for him to come see us again." },
    ],
  },
  {
    slug: "l4-002",
    level: "L4",
    titleTarget: "باغ در تابستان",
    titleTranslit: "bāgh dar tābestān",
    titleEn: "The garden in summer",
    sentences: [
      { target: "تابستان در قریه ما گرم و آفتابی است.", translit: "tābestān dar qarya-ye mā garm wa āftābī ast.", en: "Summer in our village is hot and sunny." },
      { target: "انگور و انار در باغ ما رسیده است.", translit: "angūr wa anār dar bāgh-e mā rasīda ast.", en: "Grapes and pomegranates in our garden have ripened." },
      { target: "اگر باران کم ببارد، میوه‌ها زودتر می‌رسند.", translit: "agar bārān kam bebārad, mēwa-hā zūdtar mērasand.", en: "If little rain falls, the fruits ripen sooner." },
      { target: "دهقانی که این باغ را دارد، هر روز به آن آب می‌دهد.", translit: "dehqānē ke īn bāgh rā dārad, har rōz ba ān āb mēdehad.", en: "The farmer who owns this garden waters it every day." },
      { target: "میوه‌ی تازه به بازار برده شده است.", translit: "mēwa-ye tāza ba bāzār burda shuda ast.", en: "The fresh fruit has been taken to the market." },
      { target: "مردم از میوه‌ی شیرین این فصل خوش هستند.", translit: "mardum az mēwa-ye shīrīn-e īn fasl khush hastand.", en: "People are happy with this season's sweet fruit." },
    ],
  },
  {
    slug: "l4-003",
    level: "L4",
    titleTarget: "کار نو",
    titleTranslit: "kār-e naw",
    titleEn: "New work",
    sentences: [
      { target: "پدرم چند ماه پیش کار نو گرفته است.", translit: "padaram chand māh pēsh kār-e naw gerefta ast.", en: "My father got new work a few months ago." },
      { target: "او حالا در یک دفتر کلان کار می‌کند.", translit: "ō hālā dar yak daftar-e kalān kār mēkunad.", en: "He now works in a big office." },
      { target: "اگر او سخت کار کند، معاش بیشتر می‌گیرد.", translit: "agar ō sakht kār kunad, ma'āsh bēshtar mēgīrad.", en: "If he works hard, he gets more pay." },
      { target: "دفتری که او در آن کار می‌کند، نزدیک بازار است.", translit: "daftarē ke ō dar ān kār mēkunad, nazdīk-e bāzār ast.", en: "The office where he works is near the market." },
      { target: "خانه ما هم بازسازی شده است.", translit: "khāna-ye mā ham bāzsāzi shuda ast.", en: "Our house has also been renovated." },
      { target: "همه ما از این تغییر خوش هستیم.", translit: "hama-ye mā az īn taghīr khush hastēm.", en: "All of us are happy about this change." },
    ],
  },
  {
    slug: "l5-001",
    level: "L5",
    titleTarget: "مکتب نو در قریه",
    titleTranslit: "maktab-e naw dar qarya",
    titleEn: "The new school in the village",
    sentences: [
      { target: "سال گذشته بزرگان قریه یک جلسه گرفتند و درباره ساختن مکتب نو صحبت کردند.", translit: "sāl-e guzashta buzurgān-e qarya yak jalasa gereftand wa darbāra-ye sākhtan-e maktab-e naw suhbat kardand.", en: "Last year the village elders held a meeting and talked about building a new school." },
      { target: "رئیس شورا گفت که مکتب قدیمی برای همه شاگردان خورد است.", translit: "ra'īs-e shōrā guft ke maktab-e qadīmī barāyi hama-ye shāgerdān khurd ast.", en: "The council head said that the old school is too small for all the students." },
      { target: "اگر مردم کمک کنند، مکتب نو زودتر ساخته می‌شود.", translit: "agar mardum kumak kunand, maktab-e naw zūdtar sākhta mēshawad.", en: "If people help, the new school will be built sooner." },
      { target: "دهقانی که زمین کنار سرک داشت، آن را برای مکتب داد.", translit: "dehqānē ke zamīn kinār-e sarak dāsht, ān rā barāyi maktab dād.", en: "A farmer who had land beside the road gave it for the school." },
      { target: "مردم گفتند که این تصمیم شورا بسیار خوب است.", translit: "mardum guftand ke īn tasmīm-e shōrā besyār khōb ast.", en: "People said that this decision of the council was very good." },
      { target: "سرانجام، بعد از چند ماه، مکتب نو برای شاگردان باز شد.", translit: "saranjām, ba'd az chand māh, maktab-e naw barāyi shāgerdān bāz shud.", en: "Finally, after a few months, the new school opened for the students." },
    ],
  },
  {
    slug: "l5-002",
    level: "L5",
    titleTarget: "کمک مردم",
    titleTranslit: "kumak-e mardum",
    titleEn: "The people's help",
    sentences: [
      { target: "وقتی مردم قریه از تصمیم شورا شنیدند، همه خوش شدند.", translit: "waqt-e mardum-e qarya az tasmīm-e shōrā shunīdand, hama khush shudand.", en: "When the villagers heard about the council's decision, everyone was happy." },
      { target: "مردم گفتند که دست به دست هم می‌دهند تا مکتب زودتر ساخته شود.", translit: "mardum guftand ke dast ba dast-e ham mēdehand tā maktab zūdtar sākhta shawad.", en: "The people said that they would join hands so that the school would be built sooner." },
      { target: "هر خانه مقداری پول داد و کارگران هم بدون معاش کار کردند.", translit: "har khāna meqdārē pul dād wa kārgarān ham bidūn-e ma'āsh kār kardand.", en: "Each household gave some money, and the workers also worked without pay." },
      { target: "معلم مکتب گفت که این کار همکاری قوی مردم را نشان می‌دهد.", translit: "mu'allem-e maktab guft ke īn kār hamkārī-ye qawī-ye mardum rā neshān mēdehad.", en: "The school's teacher said that this shows the people's strong cooperation." },
      { target: "اگر همه دست به دست هم بدهند، هیچ کار دشوار نیست.", translit: "agar hama dast ba dast-e ham bidehand, hēch kār dushwār nēst.", en: "If everyone joins hands, no task is difficult." },
      { target: "وقتی مکتب باز شد، همه مردم قریه جشن گرفتند.", translit: "waqt-e maktab bāz shud, hama-ye mardum-e qarya jashn gereftand.", en: "When the school opened, all the villagers held a celebration." },
    ],
  },
  {
    slug: "l5-003",
    level: "L5",
    titleTarget: "تصمیم تاجر",
    titleTranslit: "tasmīm-e tājir",
    titleEn: "The trader's decision",
    sentences: [
      { target: "تاجری که در بازار کابل دکان داشت، تصمیم گرفت کار خود را کلان‌تر کند.", translit: "tājirē ke dar bāzār-e kābul dukān dāsht, tasmīm gereft kār-e khud rā kalāntar kunad.", en: "A trader who had a shop in Kabul's bazaar decided to expand his business." },
      { target: "دوستان او گفتند که این کار خطر دارد و ممکن است ضرر کند.", translit: "dōstān-e ō guftand ke īn kār khatar dārad wa mumken ast zarar kunad.", en: "His friends said that this was risky and he might suffer a loss." },
      { target: "اما او فکر کرد که باید دل به دریا بزند.", translit: "ammā ō fikr kard ke bāyad del ba daryā bezanad.", en: "But he thought that he had to take the plunge." },
      { target: "او با یک تاجر دیگر در هرات موافقت کرد که با هم کار کنند.", translit: "ō bā yak tājir-e dīgar dar herāt muwāfiqat kard ke bā ham kār kunand.", en: "He agreed with another trader in Herat that they would work together." },
      { target: "اگر این تجارت خوب پیش برود، هر دو تاجر سود خوبی می‌برند.", translit: "agar īn tejārat khōb pēsh berawad, har dū tājir sūd-e khōbī mēbarand.", en: "If this trade goes well, both traders will earn a good profit." },
      { target: "بعد از یک سال، تجارت آن‌ها موفق شد و دکانی دیگر هم باز کردند.", translit: "ba'd az yak sāl, tejārat-e ānhā muwaffaq shud wa dukānī dīgar ham bāz kardand.", en: "After a year, their business succeeded, and they also opened another shop." },
      { target: "مردم گفتند که تصمیم تاجر درست بود.", translit: "mardum guftand ke tasmīm-e tājir durust būd.", en: "People said that the trader's decision was right." },
    ],
  },
];
