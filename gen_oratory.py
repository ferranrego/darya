import json
import os

words = [
    ("nogensmenys", "adverb", "nevertheless", "La situació és complexa; nogensmenys, cal cercar una solució consensuada.", "The situation is complex; nevertheless, a consensual solution must be sought."),
    ("tanmateix", "adverb", "however", "L'informe presenta deficiències; tanmateix, les conclusions generals són vàlides.", "The report presents deficiencies; however, the general conclusions are valid."),
    ("ensems", "adverb", "at the same time / together", "Ambdós països van decidir actuar ensems per combatre l'evasió fiscal.", "Both countries decided to act together to combat tax evasion."),
    ("àdhuc", "adverb", "even", "La llei s'aplicarà a tots els ciutadans, àdhuc als residents a l'estranger.", "The law will apply to all citizens, even those residing abroad."),
    ("endemés", "adverb", "furthermore", "El projecte és inviable econòmicament; endemés, incompleix la normativa mediambiental.", "The project is economically unfeasible; furthermore, it breaches environmental regulations."),
    ("subsegüentment", "adverb", "subsequently", "El contracte fou rescindit i, subsegüentment, s'inicià el litigi.", "The contract was rescinded and, subsequently, the litigation began."),
    ("consegüentment", "adverb", "consequently", "S'han esgotat els fons i, consegüentment, el programa queda suspès.", "The funds have been exhausted and, consequently, the program is suspended."),
    ("altrament", "adverb", "otherwise", "Cal presentar la documentació demà; altrament, la sol·licitud serà denegada.", "The documentation must be presented tomorrow; otherwise, the application will be denied."),
    ("palesament", "adverb", "evidently", "El testimoni va incórrer palesament en diverses contradiccions durant el judici.", "The witness evidently incurred in several contradictions during the trial."),
    ("indefectiblement", "adverb", "unfailingly", "Aquest procediment conduirà indefectiblement a l'arxivament de la causa.", "This procedure will unfailingly lead to the archiving of the case."),
    ("irremissiblement", "adverb", "irremissibly / inevitably", "El deteriorament de les relacions diplomàtiques ens aboca irremissiblement al conflicte.", "The deterioration of diplomatic relations irremissibly plunges us into conflict."),
    ("ineludiblement", "adverb", "unavoidably", "L'Estat ha de garantir ineludiblement l'accés a l'educació universal.", "The State must unavoidably guarantee access to universal education."),
    ("inherentment", "adverb", "inherently", "El risc està inherentment lligat a qualsevol inversió financera.", "Risk is inherently linked to any financial investment."),
    ("intrínsecament", "adverb", "intrinsically", "La llibertat d'expressió és intrínsecament valuosa per a la democràcia.", "Freedom of expression is intrinsically valuable for democracy."),
    ("extrínsecament", "adverb", "extrinsically", "El valor de l'obra ve donat extrínsecament per les fluctuacions del mercat.", "The value of the work is extrinsically determined by market fluctuations."),
    ("taxativament", "adverb", "categorically / strictly", "La constitució prohibeix taxativament qualsevol forma de censura prèvia.", "The constitution strictly prohibits any form of prior censorship."),
    ("categòricament", "adverb", "categorically", "El ministre va desmentir categòricament les acusacions de corrupció.", "The minister categorically denied the accusations of corruption."),
    ("fefaentment", "adverb", "irrefutably / reliably", "Cal demostrar fefaentment la titularitat del bé immoble per efectuar la venda.", "The ownership of the real estate must be reliably proven to carry out the sale."),
    ("inqüestionablement", "adverb", "unquestionably", "L'avenç científic ha millorat inqüestionablement la qualitat de vida humana.", "Scientific progress has unquestionably improved the human quality of life."),
    ("incontrovertiblement", "adverb", "incontrovertibly", "L'anàlisi de l'ADN demostra incontrovertiblement l'autoria del crim.", "The DNA analysis incontrovertibly proves the authorship of the crime."),
    ("peremptòriament", "adverb", "peremptorily", "El tribunal va ordenar peremptòriament l'aturada de les obres.", "The court peremptorily ordered the halt of the construction works."),
    ("imperativament", "adverb", "imperatively", "La normativa europea exigeix imperativament la reducció de les emissions.", "European regulations imperatively demand the reduction of emissions."),
    ("prescriptivament", "adverb", "prescriptively", "L'Acadèmia no actua només descriptivament, sinó també prescriptivament.", "The Academy acts not only descriptively, but also prescriptively."),
    ("normativament", "adverb", "normatively", "L'ús d'aquest terme, tot i ser habitual, és normativament incorrecte.", "The use of this term, despite being common, is normatively incorrect."),
    ("consuetudinàriament", "adverb", "customarily", "Aquestes terres han estat utilitzades consuetudinàriament per a la pastura.", "These lands have been customarily used for grazing."),
    ("sistemàticament", "adverb", "systematically", "Els drets de la minoria han estat sistemàticament vulnerats.", "The rights of the minority have been systematically violated."),
    ("esporàdicament", "adverb", "sporadically", "La malaltia pot reaparèixer esporàdicament si no se segueix el tractament.", "The disease may reappear sporadically if the treatment is not followed."),
    ("conjuntament", "adverb", "jointly", "Els departaments han de treballar conjuntament per assolir els objectius.", "The departments must work jointly to achieve the goals."),
    ("solidàriament", "adverb", "jointly and severally", "Tots els administradors respondran solidàriament dels deutes contrets.", "All administrators will be jointly and severally liable for the debts incurred."),
    ("subsidiàriament", "adverb", "subsidiarily", "L'empresa matriu respondrà subsidiàriament en cas d'insolvència de la filial.", "The parent company will respond subsidiarily in the event of the subsidiary's insolvency."),
    ("anàlogament", "adverb", "analogously", "El codi penal castiga el robatori i, anàlogament, l'apropiació indeguda.", "The penal code punishes robbery and, analogously, misappropriation."),
    ("correlativament", "adverb", "correlatively", "Si els ingressos augmenten, els impostos pujaran correlativament.", "If revenues increase, taxes will rise correlatively."),
    ("successivament", "adverb", "successively", "Els candidats seran cridats successivament per a les entrevistes.", "The candidates will be called successively for the interviews."),
    ("simultàniament", "adverb", "simultaneously", "Els atemptats es van produir simultàniament a diverses capitals.", "The attacks occurred simultaneously in several capitals."),
    ("retrospectivament", "adverb", "retrospectively", "Analitzant l'època retrospectivament, podem comprendre millor les causes de la guerra.", "Analyzing the era retrospectively, we can better understand the causes of the war."),
    ("retroactivament", "adverb", "retroactively", "La nova legislació fiscal no s'aplicarà retroactivament.", "The new tax legislation will not be applied retroactively."),
    ("prospectivament", "adverb", "prospectively", "Cal planificar prospectivament per afrontar els reptes demogràfics del futur.", "It is necessary to plan prospectively to face the demographic challenges of the future."),
    ("hipotèticament", "adverb", "hypothetically", "Hipotèticament, aquest escenari podria desembocar en una crisi global.", "Hypothetically, this scenario could lead to a global crisis."),
    ("teòricament", "adverb", "theoretically", "El model funciona teòricament, però la seva aplicació pràctica és dubtosa.", "The model works theoretically, but its practical application is doubtful."),
    ("pragmàticament", "adverb", "pragmatically", "Hem d'afrontar el problema pragmàticament, deixant de banda la ideologia.", "We must face the problem pragmatically, putting aside ideology."),
    ("empíricament", "adverb", "empirically", "La hipòtesi ha estat demostrada empíricament mitjançant nombrosos assaigs clínics.", "The hypothesis has been proven empirically through numerous clinical trials."),
    ("explícitament", "adverb", "explicitly", "El tractat reconeix explícitament el dret d'autodeterminació dels pobles.", "The treaty explicitly recognizes the right of self-determination of peoples."),
    ("implícitament", "adverb", "implicitly", "En signar l'acord, les parts acceptaven implícitament les condicions prèvies.", "By signing the agreement, the parties implicitly accepted the preconditions."),
    ("tàcitament", "adverb", "tacitly", "La renovació del contracte es va produir tàcitament en no haver-hi renúncia expressa.", "The renewal of the contract occurred tacitly since there was no express resignation."),
    ("veladament", "adverb", "covertly / veiledly", "El portaveu va amenaçar veladament amb la convocatòria d'una vaga general.", "The spokesperson veiledly threatened with the call for a general strike."),
    ("subreptíciament", "adverb", "surreptitiously", "L'esmena va ser introduïda subreptíciament en el darrer tràmit parlamentari.", "The amendment was surreptitiously introduced in the final parliamentary procedure."),
    ("ostensiblement", "adverb", "ostensibly", "La qualitat de l'aire ha millorat ostensiblement des de la prohibició del trànsit.", "Air quality has ostensibly improved since the traffic ban."),
    ("notòriament", "adverb", "notoriously", "La gestió d'aquesta crisi ha estat notòriament negligent per part del govern.", "The management of this crisis has been notoriously negligent on the part of the government."),
    ("plausiblement", "adverb", "plausibly", "El sospitós podria haver fugit plausiblement per la frontera sud.", "The suspect could have plausibly fled through the southern border."),
    ("versemblantment", "adverb", "plausibly / likely", "L'incendi va ser provocat versemblantment per una negligència humana.", "The fire was likely caused by human negligence.")
]

entries = []
for i, (word, pos, gloss, example, example_en) in enumerate(words):
    entry = {
        "word": word,
        "pos": pos,
        "gloss": gloss,
        "example": example,
        "exampleEn": example_en,
        # Including extra fields as requested by the system instruction's schema as well
        "id": f"lx-ORATORY-{i+1}",
        "target": word,
        "targetNormalized": word,
        "glossEn": gloss,
        "freqRank": 999,
        "freqBand": 10,
        "register": "formal",
        "variants": [],
        "exampleTarget": example,
        "tags": ["oratory", "C2"]
    }
    entries.append(entry)

out_dict = {"entries": entries}

os.makedirs("temp/lexicon_domains", exist_ok=True)
with open("temp/lexicon_domains/c2_oratory.json", "w", encoding="utf-8") as f:
    json.dump(out_dict, f, ensure_ascii=False, indent=2)

print("Generated c2_oratory.json")
