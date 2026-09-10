import type { SeedTextSource } from "./seed-text-source.ts";

/**
 * L3 texts drafted but NOT yet shipped, and deliberately not imported by
 * `scripts/build-seed-texts.ts`.
 *
 * They arrived in the wrong shape (one long string per text rather than
 * sentence-by-sentence, which is what tap-a-word-to-learn needs) and were
 * converted mechanically. Two things still block them, and both are exactly
 * the defects this repo cares most about:
 *
 *  - **Unresolved vocabulary.** Ten of the fifteen use words that are not in
 *    the lexicon at all. Adding them is authoring work with a philologist at
 *    the end, not a mechanical fix - and several are Iranian rather than
 *    Afghan (اطفال for اطفال, بیروبار for بیروبار, which another text here
 *    already uses correctly).
 *  - **Iranian transliteration.** `l3-003` .. `l3-007` have every long ā and
 *    every majhul ē/ō flattened out: `emroz` for `emrōz`, `khob` for `khōb`,
 *    `seb` for `sēb`, `merawem` for `mērawēm`. PEDAGOGY §9 calls this the
 *    single defect the product cares most about, and since the app has no
 *    audio, that Latin line *is* the pronunciation a learner internalises.
 *    `l3-008` .. `l3-012` look right; `l3-013` .. `l3-017` are mixed.
 *
 * Parked rather than deleted, and parked rather than shipped: this is the
 * "author into a reviewed file, never straight into shipped content" rule from
 * CLAUDE.md applied to texts.
 *
 * Progress since they were parked: five of the fourteen blocking words were
 * Iranian ones the lexicon already had an Afghan equivalent for, so they are
 * swapped - شلوغ to بیروبار, کودکان to اطفال, خسته to مانده, مطالعه to خواندن,
 * جالب to مقبول. That improves the drafts on their own merits and leaves nine.
 *
 * What still blocks them, precisely:
 *
 *  1. Nine words are not in the lexicon at all: توپ, سالاد, کیلو, جمع, مزه‌دار,
 *     تحفه, ناوقت, بوی, and the name محمود. Adding them is not a matter of
 *     appending rows: `freqRank` has to be a real frequency, and
 *     `validate-content.ts` fails a batch whose ranks track insertion order
 *     (PEDAGOGY §4, and the 121-entry incident that rule was written from).
 *     The route is `node scripts/build-frequency.ts --lang prs --apply` with
 *     the corpora downloaded - a deliberate maintainer step, not something to
 *     fake with plausible-looking numbers.
 *  2. `l3-003` .. `l3-007` still carry Iranian transliteration throughout.
 *     `l3-008` .. `l3-012` are clean; `l3-013` .. `l3-017` are mixed.
 *
 * Worth doing: L3 currently ships two texts, so these fifteen would be the
 * difference between an empty level and a real one.
 */
export const draftSeedTexts: SeedTextSource[] = [
  {
    slug: "l3-003",
    level: "L3",
    seq: 3,
    titleTarget: "رفتن به پارک",
    titleTranslit: "raftan ba park",
    titleEn: "Going to the Park",
    sentences: [
      { target: "امروز هوا بسیار خوب است.", translit: "emroz hawa besyar khob ast.", en: "Today the weather is very good." },
      { target: "ما به پارک می‌رویم.", translit: "ma ba park merawem.", en: "We are going to the park." },
      { target: "پدرم سیب و نان می‌آورد.", translit: "padaram seb wa nan meawarad.", en: "My father brings apples and bread." },
      { target: "مادرم چای درست می‌کند.", translit: "madaram chay dorost mekonad.", en: "My mother makes tea." },
      { target: "برادر کوچکم با توپ بازی می‌کند.", translit: "baradar-e kochakam ba top bazi mekonad.", en: "My little brother plays with a ball." },
      { target: "ما زیر یک درخت بزرگ می‌نشینیم.", translit: "ma zer-e yak derakht-e bozorg meneshinem.", en: "We sit under a big tree." },
      { target: "همه ما خوشحال هستیم.", translit: "hama-ye ma khoshhal hastem.", en: "We are all happy." },
    ],
  },
  {
    slug: "l3-004",
    level: "L3",
    seq: 4,
    titleTarget: "خرید در بازار",
    titleTranslit: "kharid dar bazar",
    titleEn: "Shopping at the Market",
    sentences: [
      { target: "من فردا به بازار می‌روم.", translit: "man farda ba bazar merawam.", en: "I will go to the market tomorrow." },
      { target: "باید لباس جدید بخرم.", translit: "bayad lebas-e jadid bekharam.", en: "I must buy new clothes." },
      { target: "برادرم هم با من می‌آید.", translit: "baradaram ham ba man meayad.", en: "My brother is also coming with me." },
      { target: "او می‌خواهد یک کتاب بخواند.", translit: "o mekhahad yak ketab bekhanad.", en: "He wants to read a book." },
      { target: "ما اول به دکان لباس می‌رویم.", translit: "ma awal ba dokan-e lebas merawem.", en: "First, we go to the clothing store." },
      { target: "بعد از آن، یک کتابخانه پیدا می‌کنیم.", translit: "baad az an, yak ketabkhana payda mekonem.", en: "After that, we find a bookstore." },
      { target: "در آخر، به خانه برمی‌گردیم.", translit: "dar akher, ba khana barmegardem.", en: "Finally, we return home." },
    ],
  },
  {
    slug: "l3-005",
    level: "L3",
    seq: 5,
    titleTarget: "یک روز در مکتب",
    titleTranslit: "yak roz dar maktab",
    titleEn: "A Day at School",
    sentences: [
      { target: "مکتب ما بسیار نزدیک است.", translit: "maktab-e ma besyar nazdek ast.", en: "Our school is very close." },
      { target: "من هر روز پیاده می‌روم.", translit: "man har roz pyada merawam.", en: "I walk there every day." },
      { target: "صنف ما کلان و روشن است.", translit: "senf-e ma kalan wa roshan ast.", en: "Our classroom is big and bright." },
      { target: "معلم ما بسیار مهربان است.", translit: "moalem-e ma besyar mehraban ast.", en: "Our teacher is very kind." },
      { target: "ما در صنف درس می‌خوانیم و می‌نویسیم.", translit: "ma dar senf dars mekhanem wa menewisem.", en: "We study and write in class." },
      { target: "زنگ تفریح، با دوستانم صحبت می‌کنم.", translit: "zang-e tafreh, ba dostanam sohbat mekonam.", en: "During recess, I talk with my friends." },
      { target: "مکتب جای خوبی است.", translit: "maktab jay-e khobi ast.", en: "School is a good place." },
    ],
  },
  {
    slug: "l3-006",
    level: "L3",
    seq: 6,
    titleTarget: "پختن نان شب",
    titleTranslit: "pokhtan-e nan-e shab",
    titleEn: "Cooking Dinner",
    sentences: [
      { target: "امشب دوستانم به خانه ما می‌آیند.", translit: "emshab dostanam ba khana-ye ma meayand.", en: "Tonight my friends are coming to our house." },
      { target: "من برای آن‌ها غذا می‌پزم.", translit: "man baray-e anha ghaza mepazam.", en: "I am cooking food for them." },
      { target: "برنج و گوشت در آشپزخانه داریم.", translit: "berenj wa gosht dar ashpazkhana darem.", en: "We have rice and meat in the kitchen." },
      { target: "من سالاد هم درست می‌کنم.", translit: "man salad ham dorost mekonam.", en: "I am making a salad too." },
      { target: "خواهر بزرگم میز را آماده می‌کند.", translit: "khahar-e bozorgam mez ra amada mekonad.", en: "My older sister prepares the table." },
      { target: "مهمان‌ها ساعت هفت می‌رسند.", translit: "mehmanha saat-e haft merasand.", en: "The guests arrive at seven o'clock." },
      { target: "ما با هم نان شب می‌خوریم.", translit: "ma ba ham nan-e shab mekhorem.", en: "We eat dinner together." },
    ],
  },
  {
    slug: "l3-007",
    level: "L3",
    seq: 7,
    titleTarget: "روز بارانی",
    titleTranslit: "roz-e barani",
    titleEn: "A Rainy Day",
    sentences: [
      { target: "امروز باران می‌بارد.", translit: "emroz baran mebarad.", en: "It is raining today." },
      { target: "آسمان تاریک است.", translit: "asman tarek ast.", en: "The sky is dark." },
      { target: "من در خانه می‌مانم.", translit: "man dar khana memanam.", en: "I am staying at home." },
      { target: "یک پیاله چای گرم می‌نوشم.", translit: "yak pyala chay-e garm menusham.", en: "I drink a cup of warm tea." },
      { target: "از کلکین به بیرون نگاه می‌کنم.", translit: "az kelken ba beron negah mekonam.", en: "I look outside from the window." },
      { target: "سرک‌ها پر از آب هستند.", translit: "sarakha por az ab hastand.", en: "The streets are full of water." },
      { target: "هوای بارانی را دوست دارم.", translit: "hawa-ye barani ra dost daram.", en: "I like rainy weather." },
    ],
  },
  {
    slug: "l3-008",
    level: "L3",
    seq: 8,
    titleTarget: "یک روز در خانه",
    titleTranslit: "yak rōz dar khāna",
    titleEn: "A Day at Home",
    sentences: [
      { target: "من امروز در خانه هستم.", translit: "man imrōz dar khāna hastam.", en: "I am at home today." },
      { target: "هوا بسیار سرد است.", translit: "hawā bisyār sard ast.", en: "The weather is very cold." },
      { target: "مادر من چای گرم جور می‌کند.", translit: "mādar-i man chāy-i garm jōr mēkunad.", en: "My mother makes hot tea." },
      { target: "ما با هم چای می‌نوشیم.", translit: "mā bā ham chāy mēnōshēm.", en: "We drink tea together." },
      { target: "پدرم کتاب می‌خواند.", translit: "padar-am kitāb mēkhwānad.", en: "My father reads a book." },
      { target: "برادرم در اتاق خود بازی می‌کند.", translit: "birādar-am dar utāq-i khud bāzē mēkunad.", en: "My brother plays in his room." },
      { target: "من هم یک کتاب جدید می‌خوانم.", translit: "man ham yak kitāb-i jadēd mēkhwānam.", en: "I also read a new book." },
      { target: "شام ما یکجا نان می‌خوریم.", translit: "shām mā yakjā nān mēkhōrēm.", en: "In the evening we eat food together." },
    ],
  },
  {
    slug: "l3-009",
    level: "L3",
    seq: 9,
    titleTarget: "مکتب جدید من",
    titleTranslit: "maktab-i jadēd-i man",
    titleEn: "My New School",
    sentences: [
      { target: "من یک مکتب جدید دارم.", translit: "man yak maktab-i jadēd dāram.", en: "I have a new school." },
      { target: "این مکتب بسیار کلان است.", translit: "ēn maktab bisyār kalān ast.", en: "This school is very big." },
      { target: "صنف من روشن و پاک است.", translit: "sinf-i man rōshan wa pāk ast.", en: "My classroom is bright and clean." },
      { target: "معلم ما یک زن مهربان است.", translit: "mu'allim-i mā yak zan-i mihrubān ast.", en: "Our teacher is a kind woman." },
      { target: "من در صنف دو دوست جدید دارم.", translit: "man dar sinf dū dōst-i jadēd dāram.", en: "I have two new friends in the class." },
      { target: "نام آن‌ها احمد و محمود است.", translit: "nām-i ān-hā ahmad wa mahmūd ast.", en: "Their names are Ahmad and Mahmood." },
      { target: "ما هر روز با هم درس می‌خوانیم.", translit: "mā har rōz bā ham dars mēkhwānēm.", en: "We study together every day." },
      { target: "بعد از درس ما در حویلی بازی می‌کنیم.", translit: "ba'd az dars mā dar hawēlē bāzē mēkunēm.", en: "After class we play in the yard." },
    ],
  },
  {
    slug: "l3-010",
    level: "L3",
    seq: 10,
    titleTarget: "بازار میوه",
    titleTranslit: "bāzār-i mēwa",
    titleEn: "The Fruit Market",
    sentences: [
      { target: "امروز من با پدرم به بازار رفتم.", translit: "imrōz man bā padar-am ba bāzār raftam.", en: "Today I went to the market with my father." },
      { target: "بازار بسیار بیروبار بود.", translit: "bāzār bisyār bērūbār būd.", en: "The market was very crowded." },
      { target: "دکان‌ها پر از میوه تازه بود.", translit: "dukān-hā pur az mēwa-yi tāza būd.", en: "The shops were full of fresh fruit." },
      { target: "پدرم سیب و انگور خرید.", translit: "padar-am sēb wa angūr kharēd.", en: "My father bought apples and grapes." },
      { target: "من کیله بسیار خوش دارم.", translit: "man kēlā bisyār khush dāram.", en: "I like bananas very much." },
      { target: "ما دو کیلو کیله هم خریدیم.", translit: "mā dū kēlō kēlā ham kharēdēm.", en: "We also bought two kilos of bananas." },
      { target: "میوه‌ها بسیار شیرین بودند.", translit: "mēwa-hā bisyār shērēn būdand.", en: "The fruits were very sweet." },
      { target: "ما با خریطه پر به خانه پس آمدیم.", translit: "mā bā kharēta-yi pur ba khāna pas āmadēm.", en: "We came back home with a full bag." },
    ],
  },
  {
    slug: "l3-011",
    level: "L3",
    seq: 11,
    titleTarget: "کار در باغ",
    titleTranslit: "kār dar bāgh",
    titleEn: "Work in the Garden",
    sentences: [
      { target: "خانه ما یک باغ کوچک دارد.", translit: "khāna-yi mā yak bāgh-i kōchak dārad.", en: "Our house has a small garden." },
      { target: "در باغ گل‌های سرخ و زرد است.", translit: "dar bāgh gul-hā-yi surkh wa zard ast.", en: "There are red and yellow flowers in the garden." },
      { target: "من هر صبح به گل‌ها آب می‌دهم.", translit: "man har subh ba gul-hā āb mēdiham.", en: "I give water to the flowers every morning." },
      { target: "امروز هوا آفتابی و گرم بود.", translit: "imrōz hawā āftābē wa garm būd.", en: "Today the weather was sunny and warm." },
      { target: "من با برادرم در باغ کار کردیم.", translit: "man bā birādar-am dar bāgh kār kardēm.", en: "I worked in the garden with my brother." },
      { target: "ما برگ‌های خشک را جمع کردیم.", translit: "mā barg-hā-yi khushk rā jam' kardēm.", en: "We collected the dry leaves." },
      { target: "مادر برای ما آب سرد آورد.", translit: "mādar barā-yi mā āb-i sard āward.", en: "Mother brought us cold water." },
      { target: "باغ ما حالا بسیار مقبول است.", translit: "bāgh-i mā hālā bisyār maqbūl ast.", en: "Our garden is very beautiful now." },
    ],
  },
  {
    slug: "l3-012",
    level: "L3",
    seq: 12,
    titleTarget: "مهمان در خانه ما",
    titleTranslit: "mihmān dar khāna-yi mā",
    titleEn: "Guest in Our House",
    sentences: [
      { target: "دیشب کاکایم به خانه ما آمد.", translit: "dēshab kākā-yam ba khāna-yi mā āmad.", en: "Last night my uncle came to our house." },
      { target: "او در یک شهر دور زندگی می‌کند.", translit: "ō dar yak shahr-i dūr zindagē mēkunad.", en: "He lives in a far city." },
      { target: "ما از دیدن او بسیار خوشحال شدیم.", translit: "mā az dēdan-i ō bisyār khushhāl shudēm.", en: "We were very happy to see him." },
      { target: "مادرم یک غذای مزه‌دار پخته کرد.", translit: "mādar-am yak ghizā-yi maza-dār pukhta kard.", en: "My mother cooked a delicious meal." },
      { target: "ما کباب و برنج خوردیم.", translit: "mā kabāb wa brinj khwurdēm.", en: "We ate kebab and rice." },
      { target: "کاکایم برای من یک قلم تحفه آورد.", translit: "kākā-yam barā-yi man yak qalam tuhfa āward.", en: "My uncle brought me a pen as a gift." },
      { target: "ما تا ناوقت شب قصه کردیم.", translit: "mā tā nāwaqt-i shab qissa kardēm.", en: "We talked until late at night." },
      { target: "امروز صبح او پس به خانه خود رفت.", translit: "imrōz subh ō pas ba khāna-yi khud raft.", en: "This morning he went back to his home." },
    ],
  },
  {
    slug: "l3-013",
    level: "L3",
    seq: 13,
    titleTarget: "رفتن به بازار",
    titleTranslit: "raftan ba bāzār",
    titleEn: "Going to the market",
    sentences: [
      { target: "من به بازار می‌روم.", translit: "man ba bāzār mērawam.", en: "I go to the market." },
      { target: "من میوه و نان می‌خرم.", translit: "man mēwa wa nān mēkharam.", en: "I buy fruit and bread." },
      { target: "بازار بسیار بیروبار است.", translit: "bāzār bisyār bērūbār ast.", en: "The market is very busy." },
      { target: "هوا گرم است.", translit: "hawā garm ast.", en: "The weather is hot." },
      { target: "من مانده هستم.", translit: "man mānda hastam.", en: "I am tired." },
      { target: "به خانه بر می‌گردم.", translit: "ba khāna bar mēgardam.", en: "I return home." },
    ],
  },
  {
    slug: "l3-014",
    level: "L3",
    seq: 14,
    titleTarget: "در پارک",
    titleTranslit: "dar pārk",
    titleEn: "In the park",
    sentences: [
      { target: "ما در پارک هستیم.", translit: "mā dar pārk hastēm.", en: "We are in the park." },
      { target: "اطفال بازی می‌کنند.", translit: "atfāl bāzī mēkunand.", en: "The children are playing." },
      { target: "درختان سبز هستند.", translit: "darakhtān sabz hastand.", en: "The trees are green." },
      { target: "یک پرنده روی درخت است.", translit: "yak paranda rōyē darakht ast.", en: "A bird is on the tree." },
      { target: "ما چای می‌نوشیم.", translit: "mā chāy mēnōshēm.", en: "We drink tea." },
      { target: "روز خوبی است.", translit: "rōzē khūb ast.", en: "It is a good day." },
    ],
  },
  {
    slug: "l3-015",
    level: "L3",
    seq: 15,
    titleTarget: "خواندن کتاب",
    titleTranslit: "khwāndan-ē kitāb",
    titleEn: "Reading a book",
    sentences: [
      { target: "او یک کتاب می‌خواند.", translit: "ō yak kitāb mēkhwānad.", en: "He reads a book." },
      { target: "کتاب مقبول است.", translit: "kitāb maqbūl ast.", en: "The book is interesting." },
      { target: "او در کتابخانه نشسته است.", translit: "ō dar kitābkhāna nishasta ast.", en: "He is sitting in the library." },
      { target: "دوستانش هم آنجا هستند.", translit: "dōstānash ham ānjā hastand.", en: "His friends are also there." },
      { target: "آنها آرام خواندن می‌کنند.", translit: "ānhā ārām khwāndan mēkunand.", en: "They study quietly." },
      { target: "وقت به سرعت می‌گذرد.", translit: "waqt ba sur'at mēguzarad.", en: "Time passes quickly." },
    ],
  },
  {
    slug: "l3-016",
    level: "L3",
    seq: 16,
    titleTarget: "خانه جدید",
    titleTranslit: "khāna-yē jadēd",
    titleEn: "The new house",
    sentences: [
      { target: "خانه جدید ما بزرگ است.", translit: "khāna-yē jadēd-ē mā buzurg ast.", en: "Our new house is big." },
      { target: "چهار اتاق دارد.", translit: "chahār utāq dārad.", en: "It has four rooms." },
      { target: "یک حیاط کوچک هم دارد.", translit: "yak hayāt-ē kōchak ham dārad.", en: "It also has a small yard." },
      { target: "ما رنگ سفید را دوست داریم.", translit: "mā rang-ē safēd rā dōst dārēm.", en: "We like the white color." },
      { target: "پنجره‌ها تمیز هستند.", translit: "panjarahā tamēz hastand.", en: "The windows are clean." },
      { target: "فردا مهمان داریم.", translit: "fardā mehmān dārēm.", en: "Tomorrow we have guests." },
    ],
  },
  {
    slug: "l3-017",
    level: "L3",
    seq: 17,
    titleTarget: "پختن شام",
    titleTranslit: "pukhtan-ē shām",
    titleEn: "Cooking dinner",
    sentences: [
      { target: "مادرم شام می‌پزد.", translit: "mādar-am shām mēpazad.", en: "My mother is cooking dinner." },
      { target: "او برنج و گوشت آماده می‌کند.", translit: "ō birinj wa gōsht āmāda mēkunad.", en: "She prepares rice and meat." },
      { target: "بوی غذا بسیار خوب است.", translit: "bōy-ē ghazā bisyār khūb ast.", en: "The smell of the food is very good." },
      { target: "ما دور میز می‌نشینیم.", translit: "mā dawr-ē mēz mēnishīnēm.", en: "We sit around the table." },
      { target: "همه گرسنه هستند.", translit: "hama gursna hastand.", en: "Everyone is hungry." },
      { target: "ما با هم غذا می‌خوریم.", translit: "mā bā ham ghazā mēkhōrēm.", en: "We eat food together." },
    ],
  },
];
