(function (window) {
  "use strict";

  function validScale(k, n) {
    var squares = Number(k);
    var units = Number(n);
    var rate = squares / units;
    return Number.isSafeInteger(squares) && squares > 0 && Number.isFinite(units) && units > 0 && Number.isFinite(rate) && rate > 0;
  }

  function valueToSquares(value, k, n) {
    if (!validScale(k, n) || !Number.isFinite(Number(value))) return NaN;
    return (Number(value) / Number(n)) * Number(k);
  }

  function squaresToValue(squares, k, n) {
    if (!validScale(k, n) || !Number.isFinite(Number(squares))) return NaN;
    return (Number(squares) / Number(k)) * Number(n);
  }

  function valueToPixels(value, k, n, minorPx, zoom) {
    return valueToSquares(value, k, n) * Number(minorPx) * Number(zoom || 1);
  }

  function pixelsToValue(pixels, k, n, minorPx, zoom) {
    var squarePx = Number(minorPx) * Number(zoom || 1);
    return squarePx > 0 ? squaresToValue(Number(pixels) / squarePx, k, n) : NaN;
  }

  function effectiveRate(axis, fallback) {
    var settings = window.MathForgeGraphDesignSettings && window.MathForgeGraphDesignSettings.getState
      ? window.MathForgeGraphDesignSettings.getState() : null;
    var scale = settings && settings.axisScale && settings.axisScale[axis];
    return scale && validScale(scale.k, scale.n) ? Number(scale.k) / Number(scale.n) : Number(fallback);
  }

  window.MathForgeGraphScale = {
    validScale: validScale,
    valueToSquares: valueToSquares,
    squaresToValue: squaresToValue,
    valueToPixels: valueToPixels,
    pixelsToValue: pixelsToValue,
    effectiveRate: effectiveRate
  };
})(window);
