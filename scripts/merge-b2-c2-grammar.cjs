const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");
const yaml = require("yaml");

const IN_DIR = "content/ca/grammar/src";
const ALL_JSON_PATH = "content/ca/grammar/all.json";

const data = JSON.parse(readFileSync(ALL_JSON_PATH, "utf8"));

const b2Lessons = [];
for (let i = 1; i <= 16; i++) {
  const num = i.toString().padStart(2, "0");
  const yamlContent = readFileSync(join(IN_DIR, `b2_${num}.yaml`), "utf8");
  b2Lessons.push(yaml.parse(yamlContent));
}

const c1Lessons = [];
for (let i = 1; i <= 15; i++) {
  const num = i.toString().padStart(2, "0");
  const yamlContent = readFileSync(join(IN_DIR, `c1_${num}.yaml`), "utf8");
  c1Lessons.push(yaml.parse(yamlContent));
}

const c2Lessons = [];
for (let i = 1; i <= 15; i++) {
  const num = i.toString().padStart(2, "0");
  const yamlContent = readFileSync(join(IN_DIR, `c2_${num}.yaml`), "utf8");
  c2Lessons.push(yaml.parse(yamlContent));
}

function chunkArray(array, sizes) {
  const chunks = [];
  let index = 0;
  for (const size of sizes) {
    chunks.push(array.slice(index, index + size));
    index += size;
  }
  return chunks;
}

const b2Blocks = chunkArray(b2Lessons, [4, 4, 4, 4]).map((lessons, i) => ({
  id: `gb-b2-0${i+1}`,
  title: `Block ${i+1}`,
  subtitle: "Advanced grammatical concepts",
  lessons
}));

const c1Blocks = chunkArray(c1Lessons, [4, 4, 4, 3]).map((lessons, i) => ({
  id: `gb-c1-0${i+1}`,
  title: `Block ${i+1}`,
  subtitle: "High-level syntax and subtleties",
  lessons
}));

const c2Blocks = chunkArray(c2Lessons, [3, 3, 3, 3, 3]).map((lessons, i) => ({
  id: `gb-c2-0${i+1}`,
  title: `Block ${i+1}`,
  subtitle: "Mastery and phraseology",
  lessons
}));

const newCourses = [
  { level: "B2", blocks: b2Blocks },
  { level: "C1", blocks: c1Blocks },
  { level: "C2", blocks: c2Blocks }
];

for (const course of newCourses) {
  const existingIndex = data.courses.findIndex(c => c.level === course.level);
  if (existingIndex > -1) {
    data.courses[existingIndex] = course;
  } else {
    data.courses.push(course);
  }
}

writeFileSync(ALL_JSON_PATH, JSON.stringify(data, null, 2));
console.log("Successfully merged B2, C1, C2 grammar into all.json!");
