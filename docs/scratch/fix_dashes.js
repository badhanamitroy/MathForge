const fs = require('fs');
const p = 'C:/Users/Dell/Downloads/Textbook-Graph-Suite-main/Textbook-Graph-Suite-main/docs/PROJECT_CHANGELOG.md';
let s = fs.readFileSync(p, 'utf8');
s = s.split('â€”').join('—');
fs.writeFileSync(p, s, 'utf8');
console.log('Fixed em-dashes.');
