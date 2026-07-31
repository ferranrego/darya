"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var path_1 = require("path");
var yaml_1 = require("yaml");
var SOURCE_FILES = [
    "scripts/data/ca-grammar-a1.json",
    "scripts/data/ca-grammar-a2.json"
];
var OUT_DIR = "scripts/data/grammar-yaml";
if (!(0, fs_1.existsSync)(OUT_DIR)) {
    (0, fs_1.mkdirSync)(OUT_DIR, { recursive: true });
}
for (var _i = 0, SOURCE_FILES_1 = SOURCE_FILES; _i < SOURCE_FILES_1.length; _i++) {
    var file = SOURCE_FILES_1[_i];
    if (!(0, fs_1.existsSync)(file))
        continue;
    var raw = (0, fs_1.readFileSync)(file, "utf8");
    var data = JSON.parse(raw);
    var lang = data.language;
    var level = data.level;
    var levelDir = (0, path_1.join)(OUT_DIR, lang, level);
    if (!(0, fs_1.existsSync)(levelDir))
        (0, fs_1.mkdirSync)(levelDir, { recursive: true });
    // Write index.yaml
    var indexData = {
        formatVersion: data.formatVersion,
        language: data.language,
        level: data.level,
        blocks: data.blocks.map(function (b) { return b.id; })
    };
    (0, fs_1.writeFileSync)((0, path_1.join)(levelDir, "index.yaml"), (0, yaml_1.stringify)(indexData));
    for (var _a = 0, _b = data.blocks; _a < _b.length; _a++) {
        var block = _b[_a];
        var blockDir = (0, path_1.join)(levelDir, block.id);
        if (!(0, fs_1.existsSync)(blockDir))
            (0, fs_1.mkdirSync)(blockDir, { recursive: true });
        var blockMeta = {
            id: block.id,
            title: block.title,
            subtitle: block.subtitle,
            lessons: block.lessons.map(function (l) { return l.id; })
        };
        (0, fs_1.writeFileSync)((0, path_1.join)(blockDir, "block.yaml"), (0, yaml_1.stringify)(blockMeta));
        for (var _c = 0, _d = block.lessons; _c < _d.length; _c++) {
            var lesson = _d[_c];
            var lessonFile = (0, path_1.join)(blockDir, "".concat(lesson.id, ".yaml"));
            (0, fs_1.writeFileSync)(lessonFile, (0, yaml_1.stringify)(lesson));
        }
    }
    console.log("Migrated ".concat(file, " to ").concat(levelDir));
}
