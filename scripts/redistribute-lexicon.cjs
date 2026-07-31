const fs = require('fs');

const LEXICON_PATH = 'content/ca/lexicon/lexicon.json';
const BANDS = 10;

function redistribute() {
  const data = JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf8'));
  
  if (!data.entries || data.entries.length === 0) {
    console.error('No entries found.');
    return;
  }
  
  // Sort entries by freqRank ascending (1 is most common)
  // If freqRank is missing or same, preserve original order as tie-breaker
  data.entries.sort((a, b) => (a.freqRank || 0) - (b.freqRank || 0));
  
  const total = data.entries.length;
  // Let's do a monotonically decreasing or flat distribution.
  // Actually, flat is perfectly balanced: total / BANDS words per band.
  // For 4055 words over 10 bands, that's ~405 words per band.
  const wordsPerBand = Math.floor(total / BANDS);
  const remainder = total % BANDS;
  
  let currentBand = 1;
  let countInBand = 0;
  // Give the remainder to the first few bands so they are slightly larger (more common words)
  let targetInBand = wordsPerBand + (currentBand <= remainder ? 1 : 0);
  
  let i = 0;
  for (const entry of data.entries) {
    entry.freqBand = currentBand;
    // We can also re-assign freqRank cleanly from 1 to total to remove gaps
    entry.freqRank = i + 1;
    
    countInBand++;
    if (countInBand >= targetInBand && currentBand < BANDS) {
      currentBand++;
      countInBand = 0;
      targetInBand = wordsPerBand + (currentBand <= remainder ? 1 : 0);
    }
    i++;
  }
  
  fs.writeFileSync(LEXICON_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Successfully redistributed ${total} words across ${BANDS} bands.`);
  
  // Output a quick summary of the new distribution
  const summary = new Array(BANDS).fill(0);
  for (const entry of data.entries) {
    summary[entry.freqBand - 1]++;
  }
  console.log('New Band Distribution:', summary);
}

redistribute();
