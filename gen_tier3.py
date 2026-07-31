import json
import os

os.makedirs("/Users/ferran/repositories/dariapp/temp/lexicon_domains", exist_ok=True)

def make_entry(i, target, gloss, pos, ex_t, ex_e, tags):
    return {
        "id": f"lx-tier3-{i}",
        "target": target,
        "targetNormalized": target,
        "glossEn": gloss,
        "pos": pos,
        "freqRank": 999,
        "freqBand": 3,
        "register": "neutral",
        "variants": [],
        "exampleTarget": ex_t,
        "exampleEn": ex_e,
        "tags": tags
    }

tech = [
    ("ordinador", "computer", "noun", "Tinc un ordinador nou.", "I have a new computer."),
    ("pantalla", "screen", "noun", "La pantalla és molt gran.", "The screen is very big."),
    ("teclat", "keyboard", "noun", "El teclat està brut.", "The keyboard is dirty."),
    ("ratolí", "mouse", "noun", "Necessito un ratolí sense fil.", "I need a wireless mouse."),
    ("mòbil", "mobile phone", "noun", "He perdut el mòbil.", "I lost my mobile phone."),
    ("tauleta", "tablet", "noun", "Llegeixo a la tauleta.", "I read on the tablet."),
    ("aplicació", "application", "noun", "Aquesta aplicació és útil.", "This application is useful."),
    ("internet", "internet", "noun", "No tinc connexió a internet.", "I don't have an internet connection."),
    ("xarxa", "network", "noun", "La xarxa no funciona.", "The network is not working."),
    ("correu electrònic", "email", "noun", "T'he enviat un correu electrònic.", "I sent you an email."),
    ("missatge", "message", "noun", "He rebut el teu missatge.", "I received your message."),
    ("document", "document", "noun", "Guarda el document al núvol.", "Save the document in the cloud."),
    ("fitxer", "file", "noun", "On és el fitxer de text?", "Where is the text file?"),
    ("carpeta", "folder", "noun", "Crea una carpeta nova.", "Create a new folder."),
    ("enllaç", "link", "noun", "Fes clic a l'enllaç.", "Click on the link."),
    ("imatge", "image", "noun", "És una imatge preciosa.", "It is a beautiful image."),
    ("vídeo", "video", "noun", "Hem gravat un vídeo divertit.", "We recorded a funny video."),
    ("càmera", "camera", "noun", "La càmera té molta resolució.", "The camera has high resolution."),
    ("auriculars", "headphones", "noun", "Em poso els auriculars per escoltar música.", "I put on my headphones to listen to music."),
    ("contrasenya", "password", "noun", "He oblidat la meva contrasenya.", "I forgot my password."),
    ("usuari", "user", "noun", "Quin és el teu nom d'usuari?", "What is your username?"),
    ("wifi", "wifi", "noun", "Quina és la clau del wifi?", "What is the wifi password?"),
    ("bateria", "battery", "noun", "M'he quedat sense bateria.", "I ran out of battery."),
    ("carregador", "charger", "noun", "Em deixes el carregador?", "Can you lend me the charger?"),
    ("descarregar", "to download", "verb", "Vull descarregar un joc nou.", "I want to download a new game.")
]

money = [
    ("diners", "money", "noun", "No tinc gaires diners.", "I don't have much money."),
    ("targeta", "card", "noun", "Puc pagar amb targeta?", "Can I pay by card?"),
    ("efectiu", "cash", "noun", "Només acceptem efectiu.", "We only accept cash."),
    ("moneda", "coin", "noun", "Tinc una moneda de dos euros.", "I have a two-euro coin."),
    ("bitllet", "banknote", "noun", "Necessito canviar aquest bitllet de cinquanta.", "I need to change this fifty banknote."),
    ("preu", "price", "noun", "Quin és el preu de la poma?", "What is the price of the apple?"),
    ("compte", "bill/account", "noun", "Porti'm el compte, si us plau.", "Bring me the bill, please."),
    ("descompte", "discount", "noun", "Hi ha un descompte del deu per cent.", "There is a ten percent discount."),
    ("oferta", "offer", "noun", "Aquesta jaqueta està en oferta.", "This jacket is on offer."),
    ("botiga", "shop", "noun", "La botiga tanca a les vuit.", "The shop closes at eight."),
    ("mercat", "market", "noun", "Comprem la fruita al mercat.", "We buy fruit at the market."),
    ("supermercat", "supermarket", "noun", "Aniré al supermercat més tard.", "I will go to the supermarket later."),
    ("client", "customer", "noun", "El client sempre té la raó.", "The customer is always right."),
    ("venedor", "seller", "noun", "El venedor ens va ajudar molt.", "The seller helped us a lot."),
    ("caixa", "cash register/box", "noun", "Paga a la caixa dos.", "Pay at cash register two."),
    ("tiquet", "receipt", "noun", "Necessita el tiquet de compra?", "Do you need the receipt?"),
    ("rebut", "receipt", "noun", "He perdut el rebut de la llum.", "I lost the electricity receipt."),
    ("canvi", "change", "noun", "Quedi's el canvi.", "Keep the change."),
    ("bossa", "bag", "noun", "Vols una bossa de plàstic?", "Do you want a plastic bag?"),
    ("car", "expensive", "adjective", "Aquest rellotge és massa car.", "This watch is too expensive."),
    ("barat", "cheap", "adjective", "Vaig trobar un pis molt barat.", "I found a very cheap flat."),
    ("comprar", "to buy", "verb", "Demà aniré a comprar llet.", "Tomorrow I will go buy milk."),
    ("pagar", "to pay", "verb", "On puc pagar?", "Where can I pay?"),
    ("gastar", "to spend", "verb", "No vull gastar gaire avui.", "I don't want to spend much today."),
    ("estalviar", "to save", "verb", "Intento estalviar per a les vacances.", "I try to save for the holidays.")
]

abstract = [
    ("idea", "idea", "noun", "Tinc una bona idea.", "I have a good idea."),
    ("opinió", "opinion", "noun", "Quina és la teva opinió?", "What is your opinion?"),
    ("raó", "reason", "noun", "Tens tota la raó.", "You are absolutely right."),
    ("problema", "problem", "noun", "No hi ha cap problema.", "There is no problem."),
    ("solució", "solution", "noun", "Hem de trobar una solució ràpida.", "We have to find a quick solution."),
    ("avantatge", "advantage", "noun", "Això té un gran avantatge.", "This has a great advantage."),
    ("desavantatge", "disadvantage", "noun", "L'únic desavantatge és la distància.", "The only disadvantage is the distance."),
    ("diferència", "difference", "noun", "Quina és la diferència entre tots dos?", "What is the difference between both?"),
    ("similitud", "similarity", "noun", "Hi ha molta similitud entre els germans.", "There is a lot of similarity between the brothers."),
    ("importància", "importance", "noun", "El projecte té molta importància.", "The project has a lot of importance."),
    ("resultat", "result", "noun", "El resultat va ser sorprenent.", "The result was surprising."),
    ("situació", "situation", "noun", "És una situació complicada.", "It is a complicated situation."),
    ("decisió", "decision", "noun", "Va prendre una decisió difícil.", "He made a difficult decision."),
    ("possibilitat", "possibility", "noun", "Hi ha la possibilitat de pluja.", "There is the possibility of rain."),
    ("realitat", "reality", "noun", "Hem d'afrontar la realitat.", "We must face reality."),
    ("mentida", "lie", "noun", "No suporto cap mentida.", "I don't stand any lie."),
    ("veritat", "truth", "noun", "Digue'm la veritat.", "Tell me the truth."),
    ("respecte", "respect", "noun", "Cal tractar a tothom amb respecte.", "Everyone must be treated with respect."),
    ("atenció", "attention", "noun", "Presta atenció a classe.", "Pay attention in class."),
    ("interès", "interest", "noun", "Tinc molt interès en la història.", "I have a lot of interest in history."),
    ("llibertat", "freedom", "noun", "La llibertat d'expressió és fonamental.", "Freedom of expression is fundamental."),
    ("seguretat", "security", "noun", "La seguretat és el més important.", "Security is the most important thing."),
    ("perill", "danger", "noun", "El cartell avisa d'un perill imminent.", "The sign warns of imminent danger."),
    ("pau", "peace", "noun", "Volem viure en pau.", "We want to live in peace."),
    ("por", "fear", "noun", "Tinc por de les aranyes.", "I have a fear of spiders.")
]

connectors = [
    ("i", "and", "conjunction", "M'agrada el pa i el formatge.", "I like bread and cheese."),
    ("o", "or", "conjunction", "Vols te o cafè?", "Do you want tea or coffee?"),
    ("però", "but", "conjunction", "És car, però m'agrada.", "It's expensive, but I like it."),
    ("perquè", "because", "conjunction", "Ho faig perquè vull.", "I do it because I want to."),
    ("encara que", "even though", "conjunction", "Aniré encara que plogui.", "I will go even though it rains."),
    ("doncs", "then / well", "conjunction", "Doncs, què fem ara?", "Well, what do we do now?"),
    ("així que", "so", "conjunction", "Estava cansat, així que vaig marxar.", "I was tired, so I left."),
    ("per tant", "therefore", "conjunction", "És tard, per tant hem de córrer.", "It is late, therefore we must run."),
    ("a més", "in addition", "adverb", "A més, no tinc diners.", "In addition, I don't have money."),
    ("també", "also", "adverb", "Jo també hi vaig.", "I am also going."),
    ("tampoc", "neither", "adverb", "Jo tampoc ho sé.", "I don't know either."),
    ("sempre", "always", "adverb", "Sempre arribes tard.", "You always arrive late."),
    ("mai", "never", "adverb", "Mai he estat a París.", "I have never been to Paris."),
    ("a vegades", "sometimes", "adverb", "A vegades menjo a fora.", "Sometimes I eat out."),
    ("normalment", "normally", "adverb", "Normalment em llevo d'hora.", "I normally get up early."),
    ("d'hora", "early", "adverb", "Avui he arribat d'hora.", "Today I arrived early."),
    ("tard", "late", "adverb", "No tornis gaire tard.", "Don't come back too late."),
    ("llavors", "then", "adverb", "Llavors va començar a ploure.", "Then it started to rain."),
    ("després", "afterwards", "adverb", "Ens veurem després.", "We will see each other afterwards."),
    ("abans", "before", "adverb", "Arribaré abans de sopar.", "I will arrive before dinner."),
    ("ara", "now", "adverb", "Ho vull fer ara.", "I want to do it now."),
    ("aviat", "soon", "adverb", "Ens veurem aviat.", "We will see each other soon."),
    ("aquí", "here", "adverb", "Vine aquí, si us plau.", "Come here, please."),
    ("allà", "there", "adverb", "El llibre és allà.", "The book is there."),
    ("molt", "a lot", "adverb", "M'agrada molt llegir.", "I like to read a lot."),
    ("poc", "little", "adverb", "Ahir vaig dormir poc.", "Yesterday I slept little."),
    ("bastant", "quite / enough", "adverb", "Ho he entès bastant bé.", "I have understood it quite well."),
    ("massa", "too much", "adverb", "He menjat massa.", "I have eaten too much."),
    ("gaire", "much", "adverb", "No tinc gaire gana.", "I don't have much appetite."),
    ("gens", "not at all", "adverb", "No m'agrada gens el fred.", "I don't like the cold at all.")
]

verbs = [
    ("canviar", "to change", "verb", "Vull canviar de feina.", "I want to change jobs."),
    ("millorar", "to improve", "verb", "El teu català pot millorar.", "Your Catalan can improve."),
    ("empitjorar", "to worsen", "verb", "El temps va empitjorar ràpidament.", "The weather worsened quickly."),
    ("començar", "to begin", "verb", "La pel·lícula està a punt de començar.", "The movie is about to begin."),
    ("acabar", "to finish", "verb", "He d'acabar aquest llibre.", "I have to finish this book."),
    ("intentar", "to try", "verb", "Ho he d'intentar una vegada més.", "I have to try it one more time."),
    ("aconseguir", "to achieve", "verb", "Vull aconseguir els meus somnis.", "I want to achieve my dreams."),
    ("esforçar-se", "to make an effort", "verb", "S'ha d'esforçar-se més a classe.", "One must make more effort in class."),
    ("necessitar", "to need", "verb", "Què vas necessitar ahir?", "What did you need yesterday?"),
    ("haver de", "have to", "verb", "Hem de sortir ara mateix.", "We have to leave right now."),
    ("deure", "to owe / must", "verb", "Ell deuria ser aquí ara.", "He must be here now."),
    ("poder", "can / to be able to", "verb", "Puc obrir la finestra?", "Can I open the window?"),
    ("voler", "to want", "verb", "Què vas voler dir amb allò?", "What did you want to say with that?"),
    ("saber", "to know (a fact)", "verb", "Ho vull saber tot.", "I want to know everything."),
    ("aprendre", "to learn", "verb", "Aprendre un idioma porta temps.", "To learn a language takes time."),
    ("ensenyar", "to teach", "verb", "Em pots ensenyar com fer-ho?", "Can you teach me how to do it?"),
    ("explicar", "to explain", "verb", "Em pots explicar aquest exercici?", "Can you explain this exercise to me?"),
    ("comprendre", "to understand", "verb", "És difícil comprendre aquesta norma.", "It is difficult to understand this rule."),
    ("entendre", "to understand", "verb", "No puc entendre la teva lletra.", "I cannot understand your handwriting."),
    ("recordar", "to remember", "verb", "Has de recordar portar el paraigua.", "You must remember to bring the umbrella."),
    ("oblidar", "to forget", "verb", "No ho vull oblidar mai.", "I don't want to ever forget it."),
    ("pensar", "to think", "verb", "Vaig pensar en tu ahir.", "I thought of you yesterday."),
    ("creure", "to believe", "verb", "Ho has de creure per veure-ho.", "You have to believe it to see it."),
    ("semblar", "to seem", "verb", "Et va semblar bé la proposta?", "Did the proposal seem good to you?"),
    ("buscar", "to look for", "verb", "Vinc a buscar el meu germà.", "I come to look for my brother."),
    ("trobar", "to find", "verb", "On puc trobar un forn de pa?", "Where can I find a bakery?"),
    ("perdre", "to lose", "verb", "Tinc por de perdre el tren.", "I am afraid of losing the train."),
    ("guanyar", "to win / earn", "verb", "Vull guanyar la cursa.", "I want to win the race."),
    ("donar", "to give", "verb", "Em pots donar un cop de mà?", "Can you give me a hand?"),
    ("rebre", "to receive", "verb", "Espero rebre notícies aviat.", "I hope to receive news soon.")
]

datasets = {
    "tier3_tech.json": (tech, "tech"),
    "tier3_money.json": (money, "money"),
    "tier3_abstract.json": (abstract, "abstract"),
    "tier3_connectors.json": (connectors, "connectors"),
    "tier3_verbs.json": (verbs, "verbs")
}

offset = 1
for filename, (data, tag) in datasets.items():
    entries = []
    for d in data:
        entries.append(make_entry(offset, d[0], d[1], d[2], d[3], d[4], ["tier3", tag]))
        offset += 1
    
    with open(f"/Users/ferran/repositories/dariapp/temp/lexicon_domains/{filename}", "w", encoding="utf-8") as f:
        json.dump({"entries": entries}, f, ensure_ascii=False, indent=2)

print("Done generating JSON files.")
