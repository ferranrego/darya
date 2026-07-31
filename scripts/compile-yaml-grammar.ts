import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { parse } from "yaml";

const IN_DIR = "scripts/data/grammar-yaml/ca";
const OUT_DIR = "scripts/data";

if (!existsSync(IN_DIR)) {
  console.log("No YAML grammar files found.");
  process.exit(0);
}

const levels = readdirSync(IN_DIR);

for (const level of levels) {
  const levelDir = join(IN_DIR, level);
  const indexFile = join(levelDir, "index.yaml");
  
  if (!existsSync(indexFile)) continue;
  
  const indexData = parse(readFileSync(indexFile, "utf8"));
  const blocks = [];
  
  for (const blockId of indexData.blocks) {
    const blockDir = join(levelDir, blockId);
    const blockMeta = parse(readFileSync(join(blockDir, "block.yaml"), "utf8"));
    
    const lessons = [];
    for (const lessonId of blockMeta.lessons) {
      const lessonFile = join(blockDir, `${lessonId}.yaml`);
      const lessonData = parse(readFileSync(lessonFile, "utf8"));
      lessons.push(lessonData);
    }
    
    blocks.push({
      id: blockMeta.id,
      title: blockMeta.title,
      subtitle: blockMeta.subtitle,
      lessons
    });
  }
  
  const outData = {
    formatVersion: indexData.formatVersion,
    language: indexData.language,
    level: indexData.level,
    blocks
  };
  
  const outFile = join(OUT_DIR, `ca-grammar-${level.toLowerCase()}.json`);
  writeFileSync(outFile, JSON.stringify(outData, null, 2));
  console.log(`Compiled ${outFile} from YAML.`);
}
