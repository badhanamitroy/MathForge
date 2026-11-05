(function (window) {
  "use strict";

  var BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

  function normalizeNumeralInput(raw) {
    return String(raw == null ? "" : raw)
      .replace(/[০-৯]/g, function (digit) { return String(BENGALI_DIGITS.indexOf(digit)); })
      .replace(/[٫।]/g, ".")
      .replace(/−/g, "-")
      .trim();
  }

  function parseValue(raw) {
    var normalized = normalizeNumeralInput(raw);
    if (!normalized) return { status: "empty", value: 0 };
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) {
      return { status: "invalid", value: null, message: "Enter a valid number using Bengali or English digits." };
    }
    var value = Number(normalized);
    if (!Number.isFinite(value)) return { status: "invalid", value: null, message: "Enter a finite number." };
    if (value < 0) return { status: "negative", value: value, message: "Values cannot be negative." };
    if (value === 0) return { status: "zero", value: 0 };
    return { status: "positive", value: value };
  }

  function allocateWholeDegrees(angles) {
    if (!Array.isArray(angles) || !angles.length) return [];
    var values = angles.map(Number);
    if (values.some(function (angle) { return !Number.isFinite(angle) || angle < 0; })) return [];
    var total = values.reduce(function (sum, angle) { return sum + angle; }, 0);
    if (!Number.isFinite(total) || total <= 0) return [];
    values = values.map(function (angle) { return angle / total * 360; });
    var floors = values.map(function (angle) { return Math.floor(angle); });
    var allocated = floors.slice();
    var remaining = 360 - floors.reduce(function (sum, angle) { return sum + angle; }, 0);
    var remainders = values.map(function (angle, index) {
      return { index: index, fraction: angle - floors[index] };
    });
    remainders.sort(function (a, b) {
      return b.fraction - a.fraction || a.index - b.index;
    });
    for (var i = 0; i < remaining; i++) allocated[remainders[i].index] += 1;
    return allocated;
  }

  function calculate(categories) {
    categories = Array.isArray(categories) ? categories : [];
    var parsed = [];
    for (var i = 0; i < categories.length; i++) {
      var row = categories[i] || {};
      var result = parseValue(row.value);
      if (result.status === "invalid" || result.status === "negative") {
        return { valid: false, reason: result.status, message: result.message, rowIndex: i };
      }
      if (result.status === "positive") {
        parsed.push({
          id: String(row.id == null ? "category-" + i : row.id),
          name: String(row.name == null ? "" : row.name),
          label: String(row.name == null || !String(row.name).trim() ? "Category " + (i + 1) : row.name),
          value: result.value,
          color: String(row.color || "")
        });
      }
    }

    if (parsed.length < 2) {
      return {
        valid: false,
        reason: "insufficient",
        message: "Enter at least two positive category values to draw a chart.",
        categories: parsed
      };
    }

    var total = parsed.reduce(function (sum, category) { return sum + category.value; }, 0);
    if (!Number.isFinite(total) || total <= 0) {
      return { valid: false, reason: "invalid", message: "The category total must be a finite positive number." };
    }
    var exactAngles = parsed.map(function (category) { return category.value / total * 360; });
    var wholeAngles = allocateWholeDegrees(exactAngles);
    var rows = parsed.map(function (category, index) {
      return {
        id: category.id,
        name: category.name,
        label: category.label,
        value: category.value,
        color: category.color,
        percentage: category.value / total * 100,
        exactAngle: exactAngles[index],
        wholeAngle: wholeAngles[index]
      };
    });
    return {
      valid: true,
      categories: rows,
      total: total,
      percentageTotal: rows.reduce(function (sum, row) { return sum + row.percentage; }, 0),
      exactAngleTotal: rows.reduce(function (sum, row) { return sum + row.exactAngle; }, 0),
      wholeAngleTotal: wholeAngles.reduce(function (sum, angle) { return sum + angle; }, 0)
    };
  }

  window.MathForgePieCalculations = {
    normalizeNumeralInput: normalizeNumeralInput,
    parseValue: parseValue,
    allocateWholeDegrees: allocateWholeDegrees,
    calculate: calculate
  };
})(window);
