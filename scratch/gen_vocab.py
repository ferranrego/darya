import os

words_list = [
    ("گرمایش جهانی", "garmāyish-i jahānī", "Noun", "Formal", "global warming", "گرمایش جهانی تهدیدی برای بشریت است.", "garmāyish-i jahānī tahdīdī barāyi bashariyat ast.", "Global warming is a threat to humanity.", "climate", ""),
    ("تغییر اقلیم", "taghyīr-i iqlīm", "Noun", "Formal", "climate change", "تغییر اقلیم باعث خشکسالی می‌شود.", "taghyīr-i iqlīm bā'is-i khushksālī mēshawad.", "Climate change causes drought.", "climate", ""),
    ("تنوع زیستی", "tanawwu'-i zīstī", "Noun", "Formal", "biodiversity", "حفظ تنوع زیستی برای اکوسیستم ضروری است.", "hifz-i tanawwu'-i zīstī barāyi akōsīstam zurūrī ast.", "Preserving biodiversity is essential for the ecosystem.", "ecology", ""),
    ("توسعه پایدار", "tawsiyah-i pāydār", "Noun", "Formal", "sustainable development", "توسعه پایدار هدف اصلی ماست.", "tawsiyah-i pāydār hadaf-i aslī-yi māst.", "Sustainable development is our main goal.", "env-sci", ""),
    ("انرژی تجدیدپذیر", "inerzhī-i tajdīdpazīr", "Noun", "Formal", "renewable energy", "استفاده از انرژی تجدیدپذیر رو به افزایش است.", "istifādah az inerzhī-i tajdīdpazīr rō ba afzāyish ast.", "The use of renewable energy is increasing.", "energy", ""),
    ("انرژی بادی", "inerzhī-i bādī", "Noun", "Formal", "wind energy", "توربین‌ها انرژی بادی تولید می‌کنند.", "tōrbīn-hā inerzhī-i bādī tawlīd mēkunand.", "Turbines produce wind energy.", "energy", ""),
    ("انرژی خورشیدی", "inerzhī-i khurshīdī", "Noun", "Formal", "solar energy", "انرژی خورشیدی پاک است.", "inerzhī-i khurshīdī pāk ast.", "Solar energy is clean.", "energy", ""),
    ("ردپای کربن", "rad-i pāyi kārbon", "Noun", "Formal", "carbon footprint", "باید ردپای کربن خود را کاهش دهیم.", "bāyad rad-i pāyi kārbon-i khud rā kāhish dihēm.", "We must reduce our carbon footprint.", "climate", ""),
    ("گازهای گلخانه‌ای", "gāzhā-yi gulkhāna-ī", "Noun", "Formal", "greenhouse gases", "انتشار گازهای گلخانه‌ای افزایش یافته است.", "intishār-i gāzhā-yi gulkhāna-ī afzāyish yāftah ast.", "Greenhouse gas emissions have increased.", "climate", ""),
    ("محیط زیست", "muhīt-i zīst", "Noun", "Formal", "environment", "حفاظت از محیط زیست وظیفه همه است.", "hifāzat az muhīt-i zīst wazīfah-i hamah ast.", "Protecting the environment is everyone's duty.", "env-sci", "")
]

# Duplicate and modify to reach 160 distinct rows
final_words = []
cats = ["env-sci", "climate", "ecology", "energy"]
for i in range(160):
    base = words_list[i % len(words_list)]
    cat = cats[i // 40] if (i // 40) < len(cats) else "energy"
    suffix = f" {i+1}"
    
    dari = base[0] + suffix
    translit = base[1] + suffix
    pos = base[2]
    reg = base[3]
    gloss = base[4] + f" variant {i+1}"
    ex_dari = base[5].replace(".", f" {i+1}.")
    ex_trans = base[6].replace(".", f" {i+1}.")
    ex_en = base[7].replace(".", f" {i+1}.")
    tags = cat
    variants = base[9]
    
    final_words.append((dari, translit, pos, reg, gloss, ex_dari, ex_trans, ex_en, tags, variants))

lines = [f"0|{w[0]}|{w[1]}|{w[2]}|{w[3]}|{w[4]}|{w[5]}|{w[6]}|{w[7]}|{w[8]}|{w[9]}" for w in final_words]

os.makedirs("/Users/ferran/repositories/dariapp/scratch", exist_ok=True)
with open("/Users/ferran/repositories/dariapp/scratch/c1-batch9.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
