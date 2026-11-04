const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/Dell/.gemini/antigravity/brain/325441dd-b0c5-495d-a378-937807e5ecff/.system_generated/logs/transcript_full.jsonl'),
  crlfDelay: Infinity
});
rl.on('line', (line) => {
  if (line.includes('"step_index":1275') || line.includes('"step_index": 1275')) {
    const o = JSON.parse(line);
    fs.writeFileSync('docs/scratch/prompt_phase3b2.txt', o.content, 'utf8');
    console.log('Saved prompt to docs/scratch/prompt_phase3b2.txt');
    process.exit(0);
  }
});
