(function (window) {
  "use strict";

  var DEFAULT_SIZE_PT = 11;
  var FONT_FAMILY = '"Times New Roman", "Noto Sans Bengali", serif';
  var fontReadyPromise = null;

  function ensureFontLoaded() {
    if (!window.document || !document.fonts || typeof document.fonts.load !== "function") return Promise.resolve([]);
    if (!fontReadyPromise) {
      try {
        fontReadyPromise = document.fonts.load('11px "Noto Sans Bengali"', "বাংলা ০১২৩").catch(function () { return []; });
      } catch (ignore) {
        fontReadyPromise = Promise.resolve([]);
      }
    }
    return fontReadyPromise;
  }

  function familyStack(family) {
    return family === "Noto Sans Bengali"
      ? '"Noto Sans Bengali", "Times New Roman", serif'
      : FONT_FAMILY;
  }

  function read(sizeInput, boldInput, familyInput, colorInput) {
    var shared = window.MathForgeGraphDesignSettings && window.MathForgeGraphDesignSettings.getState
      ? window.MathForgeGraphDesignSettings.getState() : null;
    var size = Number(shared ? shared.fontSizePt : sizeInput && sizeInput.value);
    if (!Number.isFinite(size) || size <= 0) size = DEFAULT_SIZE_PT;
    return {
      fontSizePt: Math.max(6, Math.min(36, size)),
      bold: shared ? Boolean(shared.bold) : Boolean(boldInput && boldInput.checked),
      fontFamily: familyStack(shared ? shared.fontFamily : familyInput && familyInput.value),
      fontColor: shared && /^#[0-9a-f]{6}$/i.test(shared.fontColor) ? shared.fontColor
        : colorInput && /^#[0-9a-f]{6}$/i.test(colorInput.value) ? colorInput.value : "#111827"
    };
  }

  function sizePx(settings) {
    settings = settings || {};
    var size = Number(settings.fontSizePt);
    if (!Number.isFinite(size) || size <= 0) size = DEFAULT_SIZE_PT;
    return size * 96 / 72;
  }

  function scaledSizePx(controlSizePx, defaultControlSizePx, settings) {
    var base = Number(defaultControlSizePx);
    var current = Number(controlSizePx);
    if (!Number.isFinite(base) || base <= 0) base = sizePx(settings);
    if (!Number.isFinite(current) || current <= 0) current = base;
    return sizePx(settings) * current / base;
  }

  function font(size, settings) {
    var px = Number(size);
    if (!Number.isFinite(px) || px <= 0) px = sizePx(settings);
    return (settings && settings.bold ? "bold " : "") + px + "px " + (settings && settings.fontFamily ? settings.fontFamily : FONT_FAMILY);
  }

  function ensureControls(root, prefix, host) {
    var doc = root && root.ownerDocument ? root.ownerDocument : root;
    if (!doc || !doc.createElement) return null;
    var sizeId = prefix + "GraphFontSizePt";
    var boldId = prefix + "GraphBold";
    var sharedSize = doc.getElementById("mfGraphFontSizePt");
    var sharedBold = doc.getElementById("mfGraphBold");
    if (sharedSize && sharedBold) {
      return {
        sizeInput: sharedSize,
        boldInput: sharedBold,
        familyInput: doc.getElementById("mfGraphFontFamily"),
        colorInput: doc.getElementById("mfGraphFontColor")
      };
    }
    var sizeInput = doc.getElementById(sizeId);
    var boldInput = doc.getElementById(boldId);
    if (sizeInput && boldInput) return { sizeInput: sizeInput, boldInput: boldInput };

    var anchor = root.querySelector ? root.querySelector("[data-typography-anchor]") : null;
    host = host || (anchor && anchor.closest && (anchor.closest(".body") || anchor.closest(".card"))) ||
      (root.querySelector && (root.querySelector(".body") || root.querySelector(".card"))) ||
      (root.body || root);
    var section = doc.createElement("section");
    section.className = "mfGraphTypography";
    section.setAttribute("aria-label", "Graph typography");
    section.innerHTML =
      '<div class="mfGraphTypography-title">Graph typography</div>' +
      '<label>Text size <span>(pt)</span>' +
      '<input id="' + sizeId + '" type="number" min="6" max="36" step="0.5" value="11" /></label>' +
      '<label class="mfGraphTypography-bold"><input id="' + boldId + '" type="checkbox" /> Bold</label>';
    host.appendChild(section);
    return { sizeInput: doc.getElementById(sizeId), boldInput: doc.getElementById(boldId), familyInput: null, colorInput: null };
  }

  window.MathForgeGraphTypography = Object.freeze({
    defaultSizePt: DEFAULT_SIZE_PT,
    fontFamily: FONT_FAMILY,
    familyStack: familyStack,
    ensureFontLoaded: ensureFontLoaded,
    read: read,
    sizePx: sizePx,
    scaledSizePx: scaledSizePx,
    font: font,
    ensureControls: ensureControls
  });
  ensureFontLoaded();
})(window);
