import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { stringify } from "yaml";

const SOURCE_FILES = [
  "scripts/data/ca-grammar-a1.json",
  "scripts/data/ca-grammar-a2.json"
];

const OUT_DIR = "scripts/data/grammar-yaml";

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

for (const file of SOURCE_FILES) {
  if (!existsSync(file)) continue;
  
  const raw = readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  const lang = data.language;
  const level = data.level;
  
  const levelDir = join(OUT_DIR, lang, level);
  if (!existsSync(levelDir)) mkdirSync(levelDir, { recursive: true });
  
  // Write index.yaml
  const indexData = {
    formatVersion: data.formatVersion,
    language: data.language,
    level: data.level,
    blocks: data.blocks.map((b: any) => b.id)
  };
  writeFileSync(join(levelDir, "index.yaml"), stringify(indexData));
  
  for (const block of data.blocks) {
    const blockDir = join(levelDir, block.id);
    if (!existsSync(blockDir)) mkdirSync(blockDir, { recursive: true });
    
    const blockMeta = {
      id: block.id,
      title: block.title,
      subtitle: block.subtitle,
      lessons: block.lessons.map((l: any) => l.id)
    };
    writeFileSync(join(blockDir, "block.yaml"), stringify(blockMeta));
    
    for (const lesson of block.lessons) {
      const lessonFile = join(blockDir, `${lesson.id}.yaml`);
      writeFileSync(lessonFile, stringify(lesson));
    }
  }
  
  console.log(`Migrated ${file} to ${levelDir}`);
}
