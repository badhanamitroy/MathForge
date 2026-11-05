(function (window) {
  "use strict";

  var FUNCTIONS = {
    abs: { fn: Math.abs, min: 1, max: 1 }, acos: { fn: Math.acos, min: 1, max: 1 },
    asin: { fn: Math.asin, min: 1, max: 1 }, atan: { fn: Math.atan, min: 1, max: 1 },
    ceil: { fn: Math.ceil, min: 1, max: 1 }, cos: { fn: Math.cos, min: 1, max: 1 },
    exp: { fn: Math.exp, min: 1, max: 1 }, floor: { fn: Math.floor, min: 1, max: 1 },
    ln: { fn: Math.log, min: 1, max: 1 }, log: { fn: Math.log, min: 1, max: 1 },
    log10: { fn: Math.log10, min: 1, max: 1 }, max: { fn: Math.max, min: 2, max: 8 },
    min: { fn: Math.min, min: 2, max: 8 }, pow: { fn: Math.pow, min: 2, max: 2 },
    round: { fn: Math.round, min: 1, max: 1 }, sin: { fn: Math.sin, min: 1, max: 1 },
    sqrt: { fn: Math.sqrt, min: 1, max: 1 }, tan: { fn: Math.tan, min: 1, max: 1 }
  };

  function relationParts(source) {
    var depth = 0, found = null;
    for (var i = 0; i < source.length; i++) {
      var ch = source[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (depth === 0 && (ch === "=" || ch === "<" || ch === ">")) {
        if (found) throw new Error("Use one relation sign per equation.");
        var operator = ch;
        if ((ch === "<" || ch === ">") && source[i + 1] === "=") operator += "=";
        found = { operator: operator, index: i, length: operator.length };
        if (operator.length === 2) i++;
      }
    }
    if (depth !== 0) throw new Error("Check the parentheses in this expression.");
    if (!found) return null;
    var left = source.slice(0, found.index).trim();
    var right = source.slice(found.index + found.length).trim();
    if (!left || !right) throw new Error("Enter an expression on both sides of the relation.");
    return { operator: found.operator, left: left, right: right };
  }

  function tokenize(source) {
    var tokens = [], i = 0;
    while (i < source.length) {
      if (/\s/.test(source[i])) { i++; continue; }
      var rest = source.slice(i);
      var number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      var name = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (number) { tokens.push({ type: "number", value: Number(number[0]) }); i += number[0].length; continue; }
      if (name) { tokens.push({ type: "name", value: name[0].toLowerCase() }); i += name[0].length; continue; }
      var two = source.slice(i, i + 2);
      if (two === "**") { tokens.push({ type: "operator", value: "^" }); i += 2; continue; }
      if ("+-*/%^(),".indexOf(source[i]) !== -1) { tokens.push({ type: "operator", value: source[i++] }); continue; }
      throw new Error("Unsupported character at position " + (i + 1) + ".");
    }
    var expanded = [];
    function endsAtom(token) { return token && (token.type === "number" || token.value === ")" || (token.type === "name" && !FUNCTIONS[token.value])); }
    function startsAtom(token) { return token && (token.type === "number" || token.type === "name" || token.value === "("); }
    tokens.forEach(function (token, index) {
      var previous = tokens[index - 1];
      if (endsAtom(previous) && startsAtom(token) && !(previous.type === "name" && FUNCTIONS[previous.value] && token.value === "(")) {
        expanded.push({ type: "operator", value: "*" });
      }
      expanded.push(token);
    });
    return expanded;
  }

  function parseExpression(source) {
    var tokens = tokenize(source), cursor = 0;
    if (!tokens.length) throw new Error("Enter a mathematical expression.");
    function peek() { return tokens[cursor]; }
    function take() { return tokens[cursor++]; }
    function expect(value) {
      if (!peek() || peek().value !== value) throw new Error("Expected '" + value + "'.");
      take();
    }
    function primary() {
      var token = take();
      if (!token) throw new Error("Expression ended unexpectedly.");
      if (token.type === "number") return { type: "number", value: token.value };
      if (token.value === "(") { var inner = expression(0); expect(")"); return inner; }
      if (token.value === "+" || token.value === "-") return { type: "unary", op: token.value, operand: expression(3) };
      if (token.type !== "name") throw new Error("Expected a number, x, y, constant, or math function.");
      if (token.value === "x" || token.value === "y") return { type: "variable", name: token.value };
      if (token.value === "pi") return { type: "number", value: Math.PI };
      if (token.value === "e") return { type: "number", value: Math.E };
      var callable = FUNCTIONS[token.value];
      if (!callable) throw new Error("Unsupported name '" + token.value + "'.");
      expect("(");
      var args = [];
      if (!peek() || peek().value !== ")") {
        args.push(expression(0));
        while (peek() && peek().value === ",") { take(); args.push(expression(0)); }
      }
      expect(")");
      if (args.length < callable.min || args.length > callable.max) throw new Error("Invalid number of arguments for " + token.value + "().");
      return { type: "call", fn: callable.fn, args: args };
    }
    function precedence(operator) { return operator === "+" || operator === "-" ? 1 : ["*", "/", "%"].indexOf(operator) !== -1 ? 2 : operator === "^" ? 4 : -1; }
    function expression(minimum) {
      var left = primary();
      while (peek()) {
        var p = precedence(peek().value);
        if (p < minimum) break;
        var operator = take().value;
        var right = expression(operator === "^" ? p : p + 1);
        left = { type: "binary", op: operator, left: left, right: right };
      }
      return left;
    }
    var ast = expression(0);
    if (cursor !== tokens.length) throw new Error("Unexpected token '" + tokens[cursor].value + "'.");
    return ast;
  }

  function evaluate(ast, x, y) {
    switch (ast.type) {
      case "number": return ast.value;
      case "variable": return ast.name === "x" ? x : y;
      case "unary": return ast.op === "-" ? -evaluate(ast.operand, x, y) : evaluate(ast.operand, x, y);
      case "call": return ast.fn.apply(Math, ast.args.map(function (arg) { return evaluate(arg, x, y); }));
      case "binary":
        var a = evaluate(ast.left, x, y), b = evaluate(ast.right, x, y);
        if (ast.op === "+") return a + b;
        if (ast.op === "-") return a - b;
        if (ast.op === "*") return a * b;
        if (ast.op === "/") return a / b;
        if (ast.op === "%") return a % b;
        return Math.pow(a, b);
      default: return NaN;
    }
  }

  function depends(ast, variable) {
    if (ast.type === "variable") return ast.name === variable;
    if (ast.type === "unary") return depends(ast.operand, variable);
    if (ast.type === "binary") return depends(ast.left, variable) || depends(ast.right, variable);
    return ast.type === "call" && ast.args.some(function (argument) { return depends(argument, variable); });
  }

  function relationValue(operator, left, right) {
    if (operator === "=") return Math.abs(left - right) <= 1e-9;
    if (operator === "<") return left < right;
    if (operator === "<=") return left <= right;
    if (operator === ">") return left > right;
    return left >= right;
  }

  function compile(source) {
    source = String(source || "").trim();
    if (!source) throw new Error("Enter an equation or function.");
    var relation = relationParts(source);
    if (!relation) {
      var fn = parseExpression(source);
      if (depends(fn, "y")) throw new Error("Use a relation such as y = ... for expressions involving y.");
      return { source: source, kind: "explicit-y", operator: "=", left: null, right: fn,
        evaluate: function (x, y) { return evaluate(fn, x, y); }, containsX: depends(fn, "x"), containsY: false };
    }
    var left = parseExpression(relation.left), right = parseExpression(relation.right);
    var hasX = depends(left, "x") || depends(right, "x"), hasY = depends(left, "y") || depends(right, "y");
    var kind = "implicit";
    if (relation.operator === "=" && left.type === "variable" && left.name === "y" && !depends(right, "y")) kind = "explicit-y";
    else if (relation.operator === "=" && right.type === "variable" && right.name === "y" && !depends(left, "y")) kind = "explicit-y-reversed";
    else if (relation.operator === "=" && left.type === "variable" && left.name === "x" && !depends(right, "x")) kind = "explicit-x";
    else if (relation.operator === "=" && right.type === "variable" && right.name === "x" && !depends(left, "x")) kind = "explicit-x-reversed";
    return { source: source, kind: kind, operator: relation.operator, left: left, right: right, containsX: hasX, containsY: hasY,
      evaluateLeft: function (x, y) { return evaluate(left, x, y); },
      evaluateRight: function (x, y) { return evaluate(right, x, y); },
      evaluate: function (x, y) { return evaluate(left, x, y) - evaluate(right, x, y); },
      test: function (x, y) { return relationValue(relation.operator, evaluate(left, x, y), evaluate(right, x, y)); } };
  }

  window.MathForgeEquationMath = { compile: compile, evaluate: evaluate, parseExpression: parseExpression };
})(window);
