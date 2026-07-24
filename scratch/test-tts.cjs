// eslint-disable-next-line @typescript-eslint/no-require-imports
const https = require('https');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

const text = encodeURIComponent('سلام');
const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${text}&tl=fa&client=tw-ob`;

https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  if (res.statusCode !== 200) {
    console.error('Failed with status:', res.statusCode);
    return;
  }
  const file = fs.createWriteStream('scratch/hello.mp3');
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Downloaded hello.mp3, size:', fs.statSync('scratch/hello.mp3').size);
  });
});
