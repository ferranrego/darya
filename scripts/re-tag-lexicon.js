import fs from "fs";
import { join } from "path";

const THEMES = {
  "Food & Drink": /\b(food|eat|drink|water|bread|meat|fruit|apple|tea|coffee|rice|milk|cheese|vegetable|cook|kitchen|meal|breakfast|lunch|dinner|soup|sweet|sugar|salt|oil|wine|beer)\b/i,
  "Colors & Shapes": /\b(red|blue|green|yellow|black|white|color|colour|brown|orange|purple|pink|grey|gray|shape|circle|square|round|flat|dark|light)\b/i,
  "Nature & Weather": /\b(nature|weather|tree|sun|moon|star|water|sky|mountain|rain|snow|wind|storm|cloud|sea|ocean|river|lake|flower|plant|animal|dog|cat|bird|fish|horse|cow|sheep|farm|wild|hot|cold|warm|cool)\b/i,
  "Time & Calendar": /\b(time|day|week|month|year|today|tomorrow|yesterday|hour|minute|second|morning|afternoon|evening|night|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|autumn|winter|now|then|always|never|sometimes|often|rarely|soon|late|early)\b/i,
  "People & Family": /\b(people|person|man|woman|mother|father|brother|sister|son|daughter|child|kid|baby|boy|girl|friend|enemy|family|parent|husband|wife|marriage|wedding|boy|girl|uncle|aunt|cousin|grandfather|grandmother)\b/i,
  "Home & Furniture": /\b(home|house|room|door|window|wall|floor|roof|bed|chair|table|desk|furniture|sofa|kitchen|bathroom|bedroom|living room|garden|yard|key|lock)\b/i,
  "Travel & Transportation": /\b(travel|trip|journey|car|bus|train|plane|flight|airport|station|road|street|path|way|go|arrive|depart|leave|visit|tourist|hotel|ticket|passport|map|drive|ride|walk|run)\b/i,
  "Work & Business": /\b(work|job|business|office|company|boss|manager|employee|worker|money|pay|salary|buy|sell|price|cost|cheap|expensive|market|shop|store|bank|economy|trade|industry|profession)\b/i,
  "Emotions & Feelings": /\b(emotion|feeling|feel|happy|sad|angry|afraid|scared|fear|love|hate|like|dislike|joy|sorrow|surprise|shock|cry|laugh|smile|tear|proud|ashamed|guilty|hope|despair|worry|anxious|calm|peace)\b/i,
  "Body & Health": /\b(body|head|face|eye|ear|nose|mouth|lip|tooth|teeth|hair|neck|shoulder|arm|hand|finger|leg|foot|toe|back|chest|stomach|heart|blood|bone|skin|health|sick|ill|disease|doctor|hospital|medicine|pain|hurt|ache)\b/i,
  "Society & Politics": /\b(society|politics|government|law|rule|president|minister|election|vote|country|nation|state|city|town|village|citizen|public|private|war|peace|army|soldier|weapon|gun|peace|conflict|leader)\b/i,
  "Science & Tech": /\b(science|technology|computer|phone|internet|web|software|hardware|machine|engine|energy|power|electricity|math|number|calculate|measure|physics|chemistry|biology|space|universe|planet)\b/i,
  "Arts & Culture": /\b(art|culture|music|song|sing|dance|book|read|write|paint|draw|picture|photo|film|movie|theater|play|actor|author|poet|poem|religion|god|pray|church|mosque|temple)\b/i,
  "Law & Justice": /\b(law|justice|court|judge|lawyer|police|crime|prison|jail|arrest|guilty|innocent|punish|fine|steal|thief|murder|kill|legal|illegal)\b/i,
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
      if (pos === "verb") matchedTheme = "Actions";
      else if (pos === "adjective" || pos === "adverb") matchedTheme = "Descriptions";
      else if (pos === "conjunction" || pos === "preposition" || pos === "particle" || pos === "pronoun" || pos === "determiner") matchedTheme = "Grammar & Connectors";
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
