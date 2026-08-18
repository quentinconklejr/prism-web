import fs from 'fs';
const d = JSON.parse(fs.readFileSync('public/explanations.json', 'utf8'));
Object.values(d).sort(() => Math.random() - 0.5).slice(0, 25)
  .forEach((x) => console.log(`--- ${x.name}, ${x.state}\n${x.text}\n`));