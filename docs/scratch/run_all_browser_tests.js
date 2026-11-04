const { execSync } = require('child_process');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function runTest(file, matchPrefix) {
  const url = `file:///C:/Users/Dell/Downloads/Textbook-Graph-Suite-main/Textbook-Graph-Suite-main/docs/scratch/${file}`;
  const out = execSync(`"${chromePath}" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --disable-web-security --virtual-time-budget=10000 --dump-dom "${url}"`, {
    encoding: 'utf8',
    maxBuffer: 15 * 1024 * 1024
  });
  const results = [];
  out.split('\n').forEach(line => {
    if (line.includes('[PASS]') || line.includes('[FAIL]')) {
      if (!line.includes('console.log') && !line.includes('function') && !line.includes('PASS(') && !line.includes('FAIL(')) {
        results.push(line.trim());
      }
    }
  });
  return results;
}

console.log('=== APP BROWSER TESTS ===');
const appResults = runTest('phase23_app_browser_test.html');
appResults.forEach(r => console.log(r));

console.log('\n=== REGRESSION TESTS ===');
const regResults = runTest('phase23_regression_test.html');
regResults.forEach(r => console.log(r));
