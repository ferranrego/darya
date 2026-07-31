import json
import os

words = [
    ("falsabilitat", "noun", "falsifiability", "La falsabilitat és el criteri de demarcació proposat per Popper per distingir la ciència de la pseudociència.", "Falsifiability is the demarcation criterion proposed by Popper to distinguish science from pseudoscience."),
    ("hermenèutica", "noun", "hermeneutics", "L'hermenèutica filosòfica qüestiona que hi hagi una comprensió objectiva desvinculada dels prejudicis de l'intèrpret.", "Philosophical hermeneutics questions whether there is an objective understanding detached from the interpreter's prejudices."),
    ("fenomenologia", "noun", "phenomenology", "La fenomenologia descriu les estructures de l'experiència tal com es presenten a la consciència.", "Phenomenology describes the structures of experience as they present themselves to consciousness."),
    ("empirisme", "noun", "empiricism", "L'empirisme sosté que tot coneixement deriva, en última instància, de l'experiència sensorial.", "Empiricism holds that all knowledge derives, ultimately, from sensory experience."),
    ("paradigma", "noun", "paradigm", "Els canvis de paradigma científic impliquen una transformació radical de la cosmovisió dominant.", "Scientific paradigm shifts imply a radical transformation of the dominant worldview."),
    ("incommensurabilitat", "noun", "incommensurability", "La incommensurabilitat entre teories rivals dificulta l'establiment d'un criteri objectiu per triar-ne la millor.", "The incommensurability between rival theories hinders the establishment of an objective criterion for choosing the best one."),
    ("ontologia", "noun", "ontology", "L'ontologia de la mecànica quàntica desafia les nocions clàssiques de causalitat i localitat.", "The ontology of quantum mechanics challenges the classical notions of causality and locality."),
    ("teleologia", "noun", "teleology", "La biologia moderna rebutja la teleologia en l'evolució, considerant l'adaptació com a resultat de la selecció natural.", "Modern biology rejects teleology in evolution, considering adaptation as a result of natural selection."),
    ("gnoseologia", "noun", "gnoseology / epistemology", "La gnoseologia kantiana estableix límits estrictes a allò que la raó humana pot arribar a conèixer.", "Kantian gnoseology establishes strict limits on what human reason can come to know."),
    ("reduccionisme", "noun", "reductionism", "El reduccionisme metodològic intenta explicar els fenòmens biològics complexos a partir de lleis fisicoquímiques subjacents.", "Methodological reductionism attempts to explain complex biological phenomena from underlying physicochemical laws."),
    ("determinisme", "noun", "determinism", "El determinisme laplacià postula que l'estat present de l'univers és l'efecte del seu passat i la causa del seu futur.", "Laplacian determinism postulates that the present state of the universe is the effect of its past and the cause of its future."),
    ("constructivisme", "noun", "constructivism", "El constructivisme social subratlla que els fets científics no són descoberts sinó construïts en un context sociològic específic.", "Social constructivism emphasizes that scientific facts are not discovered but constructed in a specific sociological context."),
    ("deductivisme", "noun", "deductivism", "El deductivisme parteix de premisses generals axiomàtiques per arribar, de manera logicofarmal, a conclusions particulars irrefutables.", "Deductivism starts from general axiomatic premises to arrive, in a logico-formal manner, at irrefutable particular conclusions."),
    ("inductivisme", "noun", "inductivism", "L'inductivisme ingenu ha estat criticat perquè cap nombre d'observacions pot garantir la veritat universal d'una teoria.", "Naive inductivism has been criticized because no number of observations can guarantee the universal truth of a theory."),
    ("solipsisme", "noun", "solipsism", "El solipsisme metodològic restringeix el fonament de l'evidència exclusivament als estats mentals del propi subjecte de recerca.", "Methodological solipsism restricts the foundation of evidence exclusively to the mental states of the researching subject themselves."),
    ("positivisme", "noun", "positivism", "El positivisme lògic pretenia purgar el llenguatge científic de qualsevol enunciat de caràcter metafísic o inavaluable empíricament.", "Logical positivism aimed to purge scientific language of any statement of a metaphysical or empirically unevaluable nature."),
    ("fal·libilisme", "noun", "fallibilism", "El fal·libilisme accepta que cap creença científica no és del tot immune a una possible revisió a la llum de noves evidències.", "Fallibilism accepts that no scientific belief is entirely immune to a possible revision in light of new evidence."),
    ("holisme", "noun", "holism", "Des d'una perspectiva l'holisme sosté que les propietats d'un sistema complex no poden deduir-se de la mera suma de les seves parts.", "From one perspective, holism maintains that the properties of a complex system cannot be deduced from the mere sum of its parts."),
    ("corol·lari", "noun", "corollary", "La dilatació del temps és un corol·lari ineludible dels postulats de la teoria de la relativitat especial.", "Time dilation is an unavoidable corollary of the postulates of the special theory of relativity."),
    ("axioma", "noun", "axiom", "En l'estructuració d'una teoria deductiva pura, un axioma s'assumeix com a vertader sense necessitat de cap demostració prèvia.", "In the structuring of a pure deductive theory, an axiom is assumed true without the need for any prior demonstration."),
    ("postulat", "noun", "postulate", "La termodinàmica es fonamenta en un conjunt de postulats que no deriven de lleis més fonamentals sinó de l'observació estadística.", "Thermodynamics is based on a set of postulates that do not derive from more fundamental laws but from statistical observation."),
    ("sil·logisme", "noun", "syllogism", "L'estructura d'un sil·logisme vàlid garanteix que, si les premisses són certes, la conclusió ho ha de ser per necessitat lògica.", "The structure of a valid syllogism guarantees that, if the premises are true, the conclusion must be by logical necessity."),
    ("tautologia", "noun", "tautology", "El model econòmic va ser desestimat per no aportar capacitat predictiva i limitar-se a una simple tautologia matemàtica.", "The economic model was dismissed for not providing predictive capacity and limiting itself to a simple mathematical tautology."),
    ("inferència", "noun", "inference", "La inferència estadística ens permet extrapolar conclusions generals sobre una població a partir de mostreigs aleatoris.", "Statistical inference allows us to extrapolate general conclusions about a population from random samplings."),
    ("refutació", "noun", "refutation", "La refutació empírica de la teoria del flogist va marcar un abans i un després en el desenvolupament de la química moderna.", "The empirical refutation of the phlogiston theory marked a turning point in the development of modern chemistry."),
    ("corroboració", "noun", "corroboration", "El descobriment de les ones gravitacionals va proporcionar una nova corroboració a les prediccions teòriques d'Einstein.", "The discovery of gravitational waves provided a new corroboration for Einstein's theoretical predictions."),
    ("conjectura", "noun", "conjecture", "Fins que no es presenti una demostració formal o un contraexemple, aquest teorema romandrà en qualitat de conjectura.", "Until a formal demonstration or counterexample is presented, this theorem will remain in the capacity of a conjecture."),
    ("premissa", "noun", "premise", "Tota l'argumentació trontolla si hom demostra que la premissa fonamental parteix d'una anàlisi esbiaixada de les dades.", "The entire argumentation falters if one demonstrates that the fundamental premise stems from a biased analysis of the data."),
    ("paralogisme", "noun", "paralogism", "L'autor va incórrer en un paralogisme metodològic en equiparar la simultaneïtat dels esdeveniments amb llur relació causal.", "The author incurred a methodological paralogism by equating the simultaneity of the events with their causal relationship."),
    ("sofisma", "noun", "sophism", "El discurs del demagog estigué ple de sofismes dissenyats per ofuscar la complexitat de l'evidència científica disponible.", "The demagogue's speech was full of sophisms designed to obfuscate the complexity of the available scientific evidence."),
    ("apriorisme", "noun", "apriorism", "L'apriorisme metodològic impedeix abordar de manera neutra fenòmens que contradiuen obertament els nostres esquemes conceptuals previs.", "Methodological apriorism prevents neutrally addressing phenomena that openly contradict our prior conceptual schemes."),
    ("contingència", "noun", "contingency", "Els processos evolutius estan profundament marcats per la contingència històrica i els esdeveniments atzarosos extrems.", "Evolutionary processes are deeply marked by historical contingency and extreme random events."),
    ("determinació", "noun", "determination", "L'article explora els mecanismes ocults que subjeuen a la determinació dels trets fenotípics complexos en els organismes biològics.", "The article explores the hidden mechanisms underlying the determination of complex phenotypic traits in biological organisms."),
    ("causalitat", "noun", "causality", "Establir la direccionalitat de la causalitat en sistemes sociològics multivariables sol representar un desafiament analític gairebé insuperable.", "Establishing the directionality of causality in multivariable sociological systems often represents a nearly insurmountable analytical challenge."),
    ("correlació", "noun", "correlation", "Un dels principis més elementals de l'epistemologia estadística és que una correlació forta no implica necessàriament una relació de causalitat.", "One of the most elementary principles of statistical epistemology is that a strong correlation does not necessarily imply a causal relationship."),
    ("aleatorietat", "noun", "randomness", "La criptografia moderna depèn de l'aleatorietat inherent a determinats fenòmens de desintegració radioactiva quantitativament impredictibles.", "Modern cryptography relies on the inherent randomness of certain quantitatively unpredictable radioactive decay phenomena."),
    ("estocàstic", "adjective", "stochastic", "La volatilitat dels mercats es modela sovint mitjançant equacions diferencials estocàstiques complexes de gran complexitat computacional.", "Market volatility is often modeled using complex stochastic differential equations of great computational complexity."),
    ("anomalia", "noun", "anomaly", "L'acumulació persistent d'una anomalia observacional finalment forçarà un canvi d'enfocament en tota la disciplina acadèmica establerta.", "The persistent accumulation of an observational anomaly will eventually force a change of focus in the entire established academic discipline."),
    ("taxonomia", "noun", "taxonomy", "La taxonomia cladística contemporània intenta reflectir fidelment les veritables relacions de parentesc filogenètic entre les espècies existents.", "Contemporary cladistic taxonomy attempts to faithfully reflect the true phylogenetic kinship relationships among existing species."),
    ("ontogènesi", "noun", "ontogeny", "Tradicionalment s'havia postulat la llei biogenètica segons la qual l'ontogènesi recapitulava acceleradament la filogènesi de l'espècie en qüestió.", "Traditionally, the biogenetic law had been postulated according to which ontogeny at an accelerated pace recapitulated the phylogeny of the species in question."),
    ("filogènesi", "noun", "phylogeny", "L'anàlisi rigorosa de la filogènesi proporciona claus indispensables per comprendre el procés d'especiació evolutiva al llarg d'eons inabastables.", "The rigorous analysis of phylogeny provides indispensable keys to understanding the evolutionary speciation process over vast eons."),
    ("teleonomia", "noun", "teleonomy", "La teleonomia substitueix l'antic concepte de finalitat conscient per descriure els processos biològics direccionals programats de manera genètica i cega.", "Teleonomy replaces the old concept of conscious finality to describe blindly and genetically programmed directional biological processes."),
    ("isomorfisme", "noun", "isomorphism", "En teoria general de sistemes, l'isomorfisme permet aplicar models matemàtics desenvolupats en un camp a problemàtiques d'àmbits científics dispars.", "In general systems theory, isomorphism allows applying mathematical models developed in one field to problems in disparate scientific domains."),
    ("heurístic", "adjective", "heuristic", "L'ús d'un marc analític d'alt valor heurístic afavoreix l'abstracció creativa davant la manca de dades empíriques solvents per contrastar la hipòtesi en curs.", "The use of an analytical framework of high heuristic value favors creative abstraction in the face of a lack of sound empirical data to contrast the current hypothesis."),
    ("pragmatisme", "noun", "pragmatism", "El pragmatisme conceptual valora primordialment la utilitat instrumental de les teories científiques, desvinculant-les d'una veritat absoluta i ontològica inabastable.", "Conceptual pragmatism primarily values the instrumental utility of scientific theories, detaching them from an absolute and unreachable ontological truth."),
    ("biaix", "noun", "bias", "L'investigador va dissenyar l'experiment d'una manera que feia pràcticament impossible minimitzar eficaçment el biaix de selecció dels pacients afectats greument.", "The researcher designed the experiment in a way that made it practically impossible to effectively minimize the selection bias of the severely affected patients."),
    ("falsar", "verb", "to falsify", "Per tal que una hipòtesi assoleixi la categoria d'enunciat científic, cal poder idear de manera concisa un experiment rigorós dissenyat expressament per falsar-la.", "In order for a hypothesis to achieve the category of scientific statement, it is necessary to be able to concisely devise a rigorous experiment expressly designed to falsify it."),
    ("inferir", "verb", "to infer", "L'anàlisi exhaustiva de l'espectre d'absorció va permetre als astrònoms inferir inequívocament l'existència de vapor d'aigua atmosfèric a l'exoplaneta examinat ahir.", "The exhaustive analysis of the absorption spectrum allowed astronomers to unequivocally infer the existence of atmospheric water vapor on the exoplanet examined yesterday."),
    ("extrapolar", "verb", "to extrapolate", "Resulta epistemològicament temerari pretendre extrapolar els resultats prometedors obtinguts in vitro als complexos models clínics i patològics in vivo.", "It is epistemologically reckless to intend to extrapolate the promising results obtained in vitro to the complex in vivo clinical and pathological models."),
    ("corroborar", "verb", "to corroborate", "La replicació estricta de l'estudi independent no només no va aconseguir corroborar les troballes primigènies de l'autor, sinó que va palesar un seguit d'errors estadístics letals.", "The strict replication of the independent study not only failed to corroborate the author's original findings, but also revealed a series of lethal statistical errors.")
]

entries = []
for i, (word, pos, gloss, example, example_en) in enumerate(words):
    entry = {
        "word": word,
        "pos": pos,
        "gloss": gloss,
        "example": example,
        "exampleEn": example_en,
        "id": f"lx-EPISTEMOLOGY-{i+1}",
        "target": word,
        "targetNormalized": word,
        "glossEn": gloss,
        "freqRank": 999,
        "freqBand": 10,
        "register": "formal",
        "variants": [],
        "exampleTarget": example,
        "tags": ["epistemology", "science", "C2"]
    }
    entries.append(entry)

out_dict = {"entries": entries}

os.makedirs("temp/lexicon_domains", exist_ok=True)
with open("temp/lexicon_domains/c2_epistemology.json", "w", encoding="utf-8") as f:
    json.dump(out_dict, f, ensure_ascii=False, indent=2)

print("Generated c2_epistemology.json")
