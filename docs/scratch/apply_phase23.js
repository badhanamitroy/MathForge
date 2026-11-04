const fs = require('fs');
const path = require('path');

const filePath = path.resolve('Coordinates_graph.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update HTML controls section
const oldControlsRegex = /<div class="row">\s*<label>Margin \(units\)<\/label>[\s\S]*?<div class="row">\s*<label><input id="showLabels" type="checkbox" checked \/> Show point labels<\/label>\s*<\/div>/;

const newControls = `<div class="row">
          <label>Margin (units)</label>
          <input id="marginUnits" type="number" value="2" min="0" step="1" />
        </div>

        <div class="sectionTitle">Polygon controls (active set)</div>
        <div class="row">
          <label><input id="polygonVisible" type="checkbox" checked /> Show polygon</label>
        </div>
        <div class="row">
          <label><input id="polygonFillVisible" type="checkbox" checked /> Show fill</label>
        </div>
        <div class="styleRow">
          <span>Fill color</span>
          <input id="polygonFillColor" type="color" value="#5b8def" />
        </div>
        <div class="row">
          <label>Fill opacity</label>
          <input id="polygonFillOpacity" type="range" min="0" max="100" value="18" />
          <div class="val" id="polygonFillOpacityVal">18%</div>
        </div>
        <div class="row">
          <label><input id="polygonBorderVisible" type="checkbox" checked /> Show border</label>
        </div>
        <div class="styleRow">
          <span>Border color</span>
          <input id="polygonBorderColor" type="color" value="#111827" />
        </div>
        <div class="row">
          <label>Border width</label>
          <input id="polygonBorderWidth" type="range" min="1" max="12" value="3" />
          <div class="val" id="polygonBorderWidthVal">3</div>
        </div>

        <div class="sectionTitle">Diagonal controls (active set)</div>
        <div class="row">
          <label><input id="showDiagonals" type="checkbox" /> Show diagonals</label>
        </div>
        <div class="styleRow">
          <span>Color</span>
          <input id="diagonalColor" type="color" value="#475569" />
        </div>
        <div class="row">
          <label>Width</label>
          <input id="diagonalWidth" type="range" min="1" max="10" value="2" />
          <div class="val" id="diagonalWidthVal">2</div>
        </div>
        <div class="row">
          <label>Style</label>
          <select id="diagonalStyle">
            <option value="solid">Solid</option>
            <option value="dashed" selected>Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>

        <div class="row">
          <label><input id="showLabels" type="checkbox" checked /> Show point labels</label>
        </div>`;

if (!oldControlsRegex.test(content)) {
  console.error('Failed to match old controls section');
  process.exit(1);
}
content = content.replace(oldControlsRegex, newControls);

// 2. Add polygonFillVisibleEl reference in script
const oldPolygonElDecl = 'const polygonVisibleEl = document.getElementById("polygonVisible");';
const newPolygonElDecl = 'const polygonVisibleEl = document.getElementById("polygonVisible");\n  const polygonFillVisibleEl = document.getElementById("polygonFillVisible");';
if (!content.includes(oldPolygonElDecl)) {
  console.error('Failed to match polygonVisibleEl declaration');
  process.exit(1);
}
content = content.replace(oldPolygonElDecl, newPolygonElDecl);

// 3. Update defaultRenderOptions to include fillVisible
const oldDefaultRenderOptions = `  function defaultRenderOptions() {
    return {
      polygon: {
        visible: true,
        fillColor: DEFAULT_FILL_COLOR,
        fillOpacity: 0.18,
        borderVisible: true,
        borderColor: DEFAULT_BORDER_COLOR,
        borderWidth: 3,
        borderStyle: "solid"
      },
      diagonals: {
        visible: false,
        color: DEFAULT_DIAGONAL_COLOR,
        width: 2,
        style: "dashed"
      }
    };
  }`;

const newDefaultRenderOptions = `  function defaultRenderOptions() {
    return {
      polygon: {
        visible: true,
        fillVisible: true,
        fillColor: DEFAULT_FILL_COLOR,
        fillOpacity: 0.18,
        borderVisible: true,
        borderColor: DEFAULT_BORDER_COLOR,
        borderWidth: 3,
        borderStyle: "solid"
      },
      diagonals: {
        visible: false,
        color: DEFAULT_DIAGONAL_COLOR,
        width: 2,
        style: "dashed"
      }
    };
  }`;

content = content.replace(oldDefaultRenderOptions, newDefaultRenderOptions);

// 4. Update getSetRenderOptions
const oldGetSetRenderOptions = `    next.polygon.fillOpacity = Math.max(0, Math.min(1, Number(next.polygon.fillOpacity) || 0));
    next.diagonals.width = Math.max(1, Number(next.diagonals.width) || 2);
    next.polygon.borderWidth = Math.max(1, Number(next.polygon.borderWidth) || 3);`;

const newGetSetRenderOptions = `    next.polygon.visible = Boolean(next.polygon.visible);
    next.polygon.fillVisible = next.polygon.fillVisible !== false;
    next.polygon.fillOpacity = Math.max(0, Math.min(1, Number(next.polygon.fillOpacity) || 0));
    next.polygon.borderVisible = Boolean(next.polygon.borderVisible);
    next.polygon.borderWidth = Math.max(1, Number(next.polygon.borderWidth) || 3);
    next.diagonals.visible = Boolean(next.diagonals.visible);
    next.diagonals.width = Math.max(1, Number(next.diagonals.width) || 2);
    next.diagonals.style = normalizeLineStyle(next.diagonals.style);`;

content = content.replace(oldGetSetRenderOptions, newGetSetRenderOptions);

// 5. Update syncSetStyleControlsFromActiveSet
const oldSyncControls = `    if (document.getElementById("polygonVisible")) document.getElementById("polygonVisible").checked = Boolean(polygon.visible);
    if (document.getElementById("polygonFillColor")) document.getElementById("polygonFillColor").value = polygon.fillColor || DEFAULT_FILL_COLOR;`;

const newSyncControls = `    if (document.getElementById("polygonVisible")) document.getElementById("polygonVisible").checked = Boolean(polygon.visible);
    if (document.getElementById("polygonFillVisible")) document.getElementById("polygonFillVisible").checked = Boolean(polygon.fillVisible !== false);
    if (document.getElementById("polygonFillColor")) document.getElementById("polygonFillColor").value = polygon.fillColor || DEFAULT_FILL_COLOR;`;

content = content.replace(oldSyncControls, newSyncControls);

// 6. Update applyActiveSetStyleControls
const oldApplyControls = `    const polygonVisibleEl = document.getElementById("polygonVisible");
    const polygonFillColorEl = document.getElementById("polygonFillColor");`;

const newApplyControls = `    const polygonVisibleEl = document.getElementById("polygonVisible");
    const polygonFillVisibleEl = document.getElementById("polygonFillVisible");
    const polygonFillColorEl = document.getElementById("polygonFillColor");`;

content = content.replace(oldApplyControls, newApplyControls);

const oldApplyAssign = `    if (polygonVisibleEl) options.polygon.visible = polygonVisibleEl.checked;
    if (polygonFillColorEl) options.polygon.fillColor = polygonFillColorEl.value;`;

const newApplyAssign = `    if (polygonVisibleEl) options.polygon.visible = polygonVisibleEl.checked;
    if (polygonFillVisibleEl) options.polygon.fillVisible = polygonFillVisibleEl.checked;
    if (polygonFillColorEl) options.polygon.fillColor = polygonFillColorEl.value;`;

content = content.replace(oldApplyAssign, newApplyAssign);

// 7. Update selectBtn & removeBtn in refreshSetManager
const oldSelectBtnAction = `      selectBtn.addEventListener("click", () => {
        activeSetId = set.id;
        pointsInput.value = set.inputText;
        renderSetManager();
        rebuildPointControls(getActiveSet().points);
        drawFromUI();
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "setBtn";
      removeBtn.textContent = "Remove";
      removeBtn.disabled = pointSets.length <= 1;
      removeBtn.addEventListener("click", () => {
        if (pointSets.length <= 1) return;
        const removeIndex = pointSets.findIndex(s => s.id === set.id);
        pointSets.splice(removeIndex, 1);
        activeSetId = pointSets[Math.max(0, removeIndex - 1)].id;
        pointsInput.value = getActiveSet().inputText;
        renderSetManager();
        rebuildPointControls(getActiveSet().points);
        drawFromUI();
      });`;

const newSelectBtnAction = `      selectBtn.addEventListener("click", () => {
        activeSetId = set.id;
        renderSetListAndControls();
        drawFromUI();
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "setBtn";
      removeBtn.textContent = "Remove";
      removeBtn.disabled = pointSets.length <= 1;
      removeBtn.addEventListener("click", () => {
        if (pointSets.length <= 1) return;
        const removeIndex = pointSets.findIndex(s => s.id === set.id);
        pointSets.splice(removeIndex, 1);
        activeSetId = pointSets[Math.max(0, removeIndex - 1)].id;
        renderSetListAndControls();
        drawFromUI();
      });`;

content = content.replace(oldSelectBtnAction, newSelectBtnAction);

// 8. Update drawSetPolygon
const oldDrawSetPolygon = `  function drawSetPolygon(set, tf) {
    const renderOptions = getSetRenderOptions(set);
    if (!renderOptions.polygon.visible || set.points.length < 3) return;

    const { xToPx, yToPx } = tf;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xToPx(set.points[0].x), yToPx(set.points[0].y));
    for (let i = 1; i < set.points.length; i++) ctx.lineTo(xToPx(set.points[i].x), yToPx(set.points[i].y));
    ctx.closePath();

    if (renderOptions.polygon.fillOpacity > 0) {
      ctx.globalAlpha = Math.max(0, Math.min(1, Number(renderOptions.polygon.fillOpacity) || 0));
      ctx.fillStyle = renderOptions.polygon.fillColor || DEFAULT_FILL_COLOR;
      ctx.fill();
    }

    if (renderOptions.polygon.borderVisible) {
      ctx.globalAlpha = 1;
      ctx.setLineDash(resolveDashPattern(renderOptions.polygon.borderStyle));
      ctx.strokeStyle = renderOptions.polygon.borderColor || DEFAULT_BORDER_COLOR;
      ctx.lineWidth = Math.max(1, Number(renderOptions.polygon.borderWidth) || 3);
      ctx.stroke();
    }
    ctx.restore();
  }`;

const newDrawSetPolygon = `  function drawSetPolygon(set, tf) {
    const renderOptions = getSetRenderOptions(set);
    if (!renderOptions.polygon.visible || set.points.length < 3) return;

    const { xToPx, yToPx } = tf;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xToPx(set.points[0].x), yToPx(set.points[0].y));
    for (let i = 1; i < set.points.length; i++) ctx.lineTo(xToPx(set.points[i].x), yToPx(set.points[i].y));
    ctx.closePath();

    if (renderOptions.polygon.fillVisible && renderOptions.polygon.fillOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, Number(renderOptions.polygon.fillOpacity) || 0));
      ctx.fillStyle = renderOptions.polygon.fillColor || DEFAULT_FILL_COLOR;
      ctx.fill();
      ctx.restore();
    }

    if (renderOptions.polygon.borderVisible) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.setLineDash(resolveDashPattern(renderOptions.polygon.borderStyle));
      ctx.strokeStyle = renderOptions.polygon.borderColor || DEFAULT_BORDER_COLOR;
      ctx.lineWidth = Math.max(1, Number(renderOptions.polygon.borderWidth) || 3);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }`;

content = content.replace(oldDrawSetPolygon, newDrawSetPolygon);

// 9. Add event listener for polygonFillVisibleEl
const oldListeners = `  polygonVisibleEl.addEventListener("change", () => {
    applyActiveSetStyleControls();
    drawFromUI();
  });`;

const newListeners = `  polygonVisibleEl.addEventListener("change", () => {
    applyActiveSetStyleControls();
    drawFromUI();
  });
  if (polygonFillVisibleEl) {
    polygonFillVisibleEl.addEventListener("change", () => {
      applyActiveSetStyleControls();
      drawFromUI();
    });
  }`;

content = content.replace(oldListeners, newListeners);

// 10. Update resetBtn
const oldResetRenderOptions = `    activeSet.renderOptions = defaultRenderOptions();
    setRenderOptionsMap.set(activeSet.id, activeSet.renderOptions);
    marginUnitsEl.value = 2;
    showDiagonalsEl.checked = false;
    showLabelsEl.checked = true;`;

const newResetRenderOptions = `    activeSet.renderOptions = defaultRenderOptions();
    setRenderOptionsMap.set(activeSet.id, activeSet.renderOptions);
    marginUnitsEl.value = 2;
    showDiagonalsEl.checked = false;
    showLabelsEl.checked = true;
    if (polygonFillVisibleEl) polygonFillVisibleEl.checked = true;`;

content = content.replace(oldResetRenderOptions, newResetRenderOptions);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Coordinates_graph.html successfully updated for Phase 2.3!');
