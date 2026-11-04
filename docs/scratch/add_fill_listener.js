const fs = require('fs');
let content = fs.readFileSync('Coordinates_graph.html', 'utf8');

const target = 'polygonVisibleEl.addEventListener("change", () => {\r\n    applyActiveSetStyleControls();\r\n    drawFromUI();\r\n  });';
const replacement = 'polygonVisibleEl.addEventListener("change", () => {\r\n    applyActiveSetStyleControls();\r\n    drawFromUI();\r\n  });\r\n  polygonFillVisibleEl.addEventListener("change", () => {\r\n    applyActiveSetStyleControls();\r\n    drawFromUI();\r\n  });';

if (content.includes(target)) {
  content = content.replace(target, replacement);
  console.log('Added polygonFillVisibleEl listener (CRLF)');
} else {
  const targetLF = target.replace(/\r\n/g, '\n');
  const replacementLF = replacement.replace(/\r\n/g, '\n');
  if (content.includes(targetLF)) {
    content = content.replace(targetLF, replacementLF);
    console.log('Added polygonFillVisibleEl listener (LF)');
  } else {
    console.error('Target not found');
    process.exit(1);
  }
}

fs.writeFileSync('Coordinates_graph.html', content, 'utf8');
console.log('Updated Coordinates_graph.html with polygonFillVisibleEl listener');
