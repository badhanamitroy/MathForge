const { execSync } = require('child_process');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const testUrl = 'file:///C:/Users/Dell/Downloads/Textbook-Graph-Suite-main/Textbook-Graph-Suite-main/docs/scratch/phase23_final_approval_test.html';

try {
  const out = execSync(`"${chromePath}" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --disable-web-security --virtual-time-budget=10000 --dump-dom "${testUrl}"`, {
    encoding: 'utf8',
    maxBuffer: 15 * 1024 * 1024
  });
  const lines = out.split('\n').filter(l => l.includes('[PASS]') || l.includes('[FAIL]') || l.includes('Diagonal pixel counts') || l.includes('Exported PNG pixel audit'));
  console.log(lines.join('\n'));
} catch (e) {
  console.error('Execution error:', e);
}
