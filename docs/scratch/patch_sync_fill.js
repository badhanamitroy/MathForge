const fs = require('fs');
let content = fs.readFileSync('Coordinates_graph.html', 'utf8');
const target = 'if (document.getElementById("polygonVisible")) document.getElementById("polygonVisible").checked = Boolean(polygon.visible);';
const syncFill = 'if (document.getElementById("polygonFillVisible")) document.getElementById("polygonFillVisible").checked = polygon.fillVisible !== false;';

if (!content.includes(syncFill)) {
  const idx = content.indexOf(target);
  if (idx !== -1) {
    const endOfLine = content.indexOf('\n', idx);
    const indent = '\r\n    ';
    content = content.slice(0, endOfLine) + indent + syncFill + content.slice(endOfLine);
    fs.writeFileSync('Coordinates_graph.html', content, 'utf8');
    console.log('PATCH SUCCESS: polygonFillVisible sync added.');
  } else {
    console.log('ERROR: target not found.');
  }
} else {
  console.log('ALREADY PATCHED');
}
