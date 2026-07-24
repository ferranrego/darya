import fs from "fs";
import { join } from "path";

const THEMES = {
  "Food & Drink": /\b(food|eat|drink|water|bread|meat|fruit|apple|tea|coffee|rice|milk|cheese|vegetable|cook|kitchen|meal|breakfast|lunch|dinner|soup|sweet|sugar|salt|oil|wine|beer|egg|chicken|beef|pork|fish|hungry|thirsty)\b/i,
  "Colors & Shapes": /\b(red|blue|green|yellow|black|white|color|colour|brown|orange|purple|pink|grey|gray|shape|circle|square|round|flat|dark|light|triangle|rectangle)\b/i,
  "Nature & Environment": /\b(nature|weather|tree|sun|moon|star|water|sky|mountain|rain|snow|wind|storm|cloud|sea|ocean|river|lake|flower|plant|forest|wood|earth|land|dirt|sand|rock|stone|ice|fire|leaf)\b/i,
  "Weather & Climate": /\b(weather|rain|snow|wind|storm|cloud|hot|cold|warm|cool|sun|sunny|fog|ice|freeze|melt|climate|temperature|degree)\b/i,
  "Time & Calendar": /\b(time|day|week|month|year|today|tomorrow|yesterday|hour|minute|second|morning|afternoon|evening|night|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|autumn|winter|now|then|always|never|sometimes|often|rarely|soon|late|early|calendar|date|century|decade)\b/i,
  "People & Identity": /\b(people|person|man|woman|child|kid|baby|boy|girl|friend|enemy|human|individual|identity|name|age|gender|male|female)\b/i,
  "Family & Relationships": /\b(family|parent|mother|father|brother|sister|son|daughter|husband|wife|marriage|wedding|uncle|aunt|cousin|grandfather|grandmother|grandson|granddaughter|relative|relation)\b/i,
  "Home & Furniture": /\b(home|house|room|door|window|wall|floor|roof|bed|chair|table|desk|furniture|sofa|kitchen|bathroom|bedroom|living room|garden|yard|key|lock|carpet|rug|lamp|mirror|apartment|building)\b/i,
  "Travel & Transportation": /\b(travel|trip|journey|car|bus|train|plane|flight|airport|station|road|street|path|way|go|arrive|depart|leave|visit|tourist|hotel|ticket|passport|map|drive|ride|walk|run|bicycle|bike|boat|ship|vehicle)\b/i,
  "Work & Business": /\b(work|job|business|office|company|boss|manager|employee|worker|buy|sell|market|shop|store|trade|industry|profession|career|hire|fire|meeting|project)\b/i,
  "Money & Finance": /\b(money|pay|salary|price|cost|cheap|expensive|bank|economy|finance|cash|coin|dollar|euro|tax|debt|loan|borrow|lend|rich|poor)\b/i,
  "Emotions & Feelings": /\b(emotion|feeling|feel|happy|sad|angry|afraid|scared|fear|love|hate|like|dislike|joy|sorrow|surprise|shock|cry|laugh|smile|tear|proud|ashamed|guilty|hope|despair|worry|anxious|calm|peace|mad|glad)\b/i,
  "Body & Anatomy": /\b(body|head|face|eye|ear|nose|mouth|lip|tooth|teeth|hair|neck|shoulder|arm|hand|finger|leg|foot|toe|back|chest|stomach|heart|blood|bone|skin|muscle|brain|tongue)\b/i,
  "Health & Medicine": /\b(health|sick|ill|disease|doctor|hospital|medicine|pain|hurt|ache|nurse|pharmacy|pill|drug|cure|heal|injury|wound|fever|cough|sneeze|virus|bacteria)\b/i,
  "Society & Politics": /\b(society|politics|government|law|rule|president|minister|election|vote|country|nation|state|city|town|village|citizen|public|private|war|peace|army|soldier|weapon|gun|conflict|leader|king|queen|power)\b/i,
  "Science & Technology": /\b(science|technology|computer|phone|internet|web|software|hardware|machine|engine|energy|power|electricity|physics|chemistry|biology|space|universe|planet|screen|keyboard|mouse|network|data|file)\b/i,
  "Arts & Entertainment": /\b(art|culture|music|song|sing|dance|book|read|write|paint|draw|picture|photo|film|movie|theater|play|actor|author|poet|poem|game|sport|fun|entertainment)\b/i,
  "Law & Justice": /\b(law|justice|court|judge|lawyer|police|crime|prison|jail|arrest|guilty|innocent|punish|fine|steal|thief|murder|kill|legal|illegal|right|wrong|rule|regulation)\b/i,
  "Education & Learning": /\b(education|learn|teach|school|college|university|student|teacher|class|course|lesson|exam|test|study|homework|degree|grade)\b/i,
  "Sports & Recreation": /\b(sport|game|play|football|soccer|basketball|baseball|tennis|swim|run|jump|team|win|lose|score|match|player)\b/i,
  "Clothing & Fashion": /\b(clothes|clothing|shirt|pants|trousers|dress|skirt|shoe|hat|coat|jacket|sock|wear|fashion|style|ring|jewelry|watch|glass)\b/i,
  "Animals & Pets": /\b(animal|dog|cat|bird|fish|horse|cow|sheep|farm|wild|pet|mouse|rat|snake|insect|spider|fly|bee|bear|lion|tiger|elephant|monkey|pig)\b/i,
  "Religion & Beliefs": /\b(religion|god|pray|church|mosque|temple|belief|faith|holy|sacred|divine|spirit|soul|sin|heaven|hell|angel|demon)\b/i,
  "Communication & Media": /\b(communication|media|news|newspaper|magazine|radio|television|tv|broadcast|message|letter|email|call|speak|talk|say|tell|word|language|translate)\b/i,
  "Geography & Places": /\b(geography|place|map|north|south|east|west|world|continent|ocean|sea|mountain|river|lake|forest|desert|island|valley|hill|capital)\b/i,
  "War & Conflict": /\b(war|conflict|army|soldier|weapon|gun|bomb|fight|battle|attack|defend|destroy|victory|defeat|peace|enemy|military|guard)\b/i,
  "Materials & Substances": /\b(material|substance|wood|metal|iron|gold|silver|glass|plastic|paper|cloth|cotton|wool|leather|stone|rock|sand|dirt|dust)\b/i,
};

const filePattern = /^core-lexicon-\d+\.txt$/;
const dataDir = join(import.meta.dirname, "data");

const files = fs.readdirSync(dataDir).filter(f => filePattern.test(f));

let totalWords = 0;
let taggedWords = 0;

for (const file of files) {
  const filePath = join(dataDir, file);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  
  const newLines = lines.map(line => {
    if (line.trim() === "" || line.startsWith("#")) return line;
    
    const parts = line.split("|");
    if (parts.length < 11) return line;
    
    const glossEn = parts[5];
    const pos = parts[3];
    
    let matchedTheme = "";
    
    for (const [theme, regex] of Object.entries(THEMES)) {
      if (regex.test(glossEn)) {
        matchedTheme = theme;
        break;
      }
    }
    
    if (!matchedTheme) {
      if (pos === "verb") matchedTheme = "Actions & Movement";
      else if (pos === "adjective" || pos === "adverb") matchedTheme = "Descriptions & Qualities";
      else if (pos === "conjunction" || pos === "preposition" || pos === "particle" || pos === "pronoun" || pos === "determiner") matchedTheme = "Grammar & Connectors";
      else if (pos === "numeral") matchedTheme = "Numbers & Quantities";
      else matchedTheme = "Abstract Concepts";
    }
    
    parts[9] = matchedTheme;
    totalWords++;
    if (matchedTheme !== "Abstract Concepts") taggedWords++;
    
    return parts.join("|");
  });
  
  fs.writeFileSync(filePath, newLines.join("\n"));
}

console.log(`Re-tagged ${totalWords} words.`);
console.log(`Explicitly categorized ${taggedWords} words (fallback: ${totalWords - taggedWords}).`);
