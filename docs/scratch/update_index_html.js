const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../index.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add coordinates-tool.css in head
const targetCss = '  <link rel="stylesheet" href="assets/css/workspace.css">';
if (!content.includes(targetCss)) {
  console.error('Target CSS tag not found');
  process.exit(1);
}
content = content.replace(
  targetCss,
  targetCss + '\r\n\r\n  <!-- Tool Stylesheets -->\r\n  <link rel="stylesheet" href="assets/css/tools/coordinates-tool.css">'
);

// 2. Add coordinates-tool.js after workspace-core.js
const targetJs = '<script src="assets/js/workspace-core.js"></script>';
if (!content.includes(targetJs)) {
  console.error('Target JS tag not found');
  process.exit(1);
}
content = content.replace(
  targetJs,
  targetJs + '\r\n\r\n<!-- MathForge Tool Adapters -->\r\n<script src="assets/js/tools/coordinates-tool.js"></script>'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('index.html successfully updated to include coordinates-tool.');
