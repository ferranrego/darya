const fs = require('fs');
const { execSync } = require('child_process');

// We know:
// L1 total words = 500. 50% = 250.
// L2 total words = 700. 50% = 350.

// Words introduced per text: ~5.
// Target L1 texts = 250 / 5 = 50 texts.
// Target L2 texts = 350 / 5 = 70 texts.

console.log("To reach 50% coverage purely through seed texts:");
console.log("- L1: 250 words = ~50 texts");
console.log("- L2: 350 words = ~70 texts");
