const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../Coordinates_graph.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add coordinates-tool.css in head
const targetLink = '<link rel="stylesheet" href="assets/css/common.css">';
if (!content.includes(targetLink)) {
  console.error('Target link not found');
  process.exit(1);
}
content = content.replace(
  targetLink,
  targetLink + '\r\n  <link rel="stylesheet" href="assets/css/tools/coordinates-tool.css">'
);

// 2. Replace monolithic script with shared engine script and initStandalone
const scriptStartMarker = '<script>';
const scriptEndMarker = '})();\r\n</script>';

const idxStart = content.lastIndexOf(scriptStartMarker);
const idxEnd = content.indexOf(scriptEndMarker, idxStart);

if (idxStart === -1 || idxEnd === -1) {
  console.error('Script start/end markers not found:', idxStart, idxEnd);
  process.exit(1);
}

const replacement = '<script src="assets/js/tools/coordinates-tool.js"></script>\r\n<script>\r\n  window.MathForgeCoordinates.initStandalone(document);\r\n</script>';

content = content.substring(0, idxStart) + replacement + content.substring(idxEnd + scriptEndMarker.length);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Coordinates_graph.html successfully updated to use shared engine.');
