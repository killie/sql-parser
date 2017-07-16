
var Lexer = function () {
var self = this;

// Grammar

var eq = "=";
var ne = "!=";
var lt = "<";
var le = "<=";
var bt = ">";
var be = ">=";
var li = "LIKE";
var nl = "NOT LIKE";
var im = "IN"; // in is reserved in JavaScript
var ni = "NOT IN";
var bw = "BETWEEN";
var nb = "NOT BETWEEN";

var operators = [eq, ne, lt, le, bt, be, li, nl];

var in_oper = [im, ni];

var between_oper = [bw, nb];

var separators = {
  "OR": "||",
  "AND": "&&",
  "(": "(",
  ")": ")"
};

var comparators = {
  "=": "==",
  "!=": "!=",
  ">": ">",
  ">=": ">=",
  "<": "<",
  "<=": "<="
};

self.tokenize = function tokenize(s, caps) {
  var inside = false, count = 0, i, prev, start = 0, tokens = [], token;

  function addToken(ch) {
    var token = s.substring(start, i).trim();
    if (token.length) {
      if (token[0] !== "\"") token = token.replace(",", "");
      if (ch) token = ch + token + ch;
      if (token.length) tokens.push(caps ? token.toUpperCase() : token); 
    }
  }

  function collapseNots(t) {
    var not = false, i, tokens = [];
    for (i = 0; i < t.length; i++) {
      if (t[i] === "NOT") {
        not = true;
      } else if (not) {
        if (t[i] === "BETWEEN" || t[i] === "IN" || t[i] === "LIKE") {
          tokens.push("NOT " + t[i]);
        } else {
          tokens.push(t[i]);
        }
        not = false;
      } else {
        tokens.push(t[i]);
      }
    }
    return tokens;
  }

  for (i = 0; i < s.length; i++) {
    if (s[i] === "(") {
      count++;
      tokens.push("(");
      start = i + 1;
    }
    if (s[i] === ")") {
      count--;
      addToken();
      tokens.push(")");
      start = i + 1;
    }
    if (count < 0) return {error: "Unmatching parentheses"};
    if (s[i] === "\"") {
      // TODO: Support both " and ' strings
      inside = !inside;
      if (!inside) addToken("'"); // TODO: Keep string characters
      start = i + 1;
    }
    if (s[i] === " " && !inside) {
      addToken();
      start = i + 1;
    }
    prev = s[i]; // prev is for escaping string \' and \"
  }

  if (inside) return {error: "Unclosed string"};
  if (count !== 0) return {error: "Unmatching parentheses"};
  addToken();
  return {success: true, tokens: collapseNots(tokens)};
};

self.parseTokens = function parseTokens(tokens) {
  var i, expressions = [], expression = "", in_flag = false, between_flag = false;
  var rules = [
    "EXPRESSION OPERATOR EXPRESSION",
    "EXPRESSION IN ( EXPRESSIONS )",
    "EXPRESSION NOT IN ( EXPRESSIONS )",
    "EXPRESSION BETWEEN EXPRESSION AND EXPRESSION",
    "EXPRESSION NOT BETWEEN EXPRESSION AND EXPRESSION"
  ];
  var words = [], sentence = [];

  function validRule(expr) {
    return rules.includes(expr.replace(/_/g, " ").trim());
  }

  function validLike(words) {
    var i, s;
    if (words[1] !== li && words[1] !== nl) return true;
    for (i = 0, s = words[2]; i < s.length; i++) {
      if (s[i] === "%" && (i !== 1 && i !== s.length - 2)) return false;
    }
    return true;
  }

  for (i = 0; i < tokens.length; i++) {
    if (!between_flag && (tokens[i] === "AND" || tokens[i] === "OR")) {
      if (validRule(expression) && validLike(words)) {
        expressions.push(expression);
        sentence.push(words, tokens[i]);
      } else {
        if (!validRule(expression)) {
          return {error: "Unknown expression: " + expression};
        }
        return {error: "Illegal LIKE comparator: " + words[2]};
      }
      in_flag = between_flag = false;
      expression = "";
      words = [];
    } else {
      if (operators.includes(tokens[i])) {
        expression += "OPERATOR_";
      } else if (in_oper.includes(tokens[i])) {
        expression += "IN_";
        in_flag = true;
      } else if (between_oper.includes(tokens[i])) {
        expression += "BETWEEN_";
        between_flag = true;
      } else if ("NOT" === tokens[i]) {
        expression += "NOT_";
      } else if (between_flag && "AND" === tokens[i]) {
        expression += "AND_";
      } else if ("(" === tokens[i]) {
        expression += "(_";
      } else if (in_flag && ")" === tokens[i]) {
        expression += "EXPRESSIONS_)_";
      } else if (")" === tokens[i]) {
        expression += ")_";
      } else if (in_flag) {
        // Added in other in_flag check
      } else {
        expression += "EXPRESSION_";
      }
      words.push(tokens[i]);
    }
  }

  if (validRule(expression) && validLike(words)) {
    expressions.push(expression);
    sentence.push(words);
  } else {
    if (!validRule(expression)) {
      return {error: "Unknown expression: " + expression};
    }
    return {error: "Illegal LIKE comparator: " + words[2]};
  }

  return {success: true, expressions: expressions, sentence: sentence};
};

self.evaluate = function evaluate(s) {
  var i, operator, expr = "";

  function likeFn(s, not) {
    var stm, comp;
    if (s[2].indexOf("%") === -1) {
      return s[0] + " == " + s[2];
    }
    comp = s[2].replace(/%/g, "");
    if (s[2][1] === "%" && s[2][s[2].length - 2] === "%") {
      stm = s[0] + ".indexOf(" + comp + ") !== -1";
    } else if (s[2][1] === "%") {
      stm = s[0] + ".endsWith(" + comp + ")";
    } else {
      stm = s[0] + ".indexOf(" + comp + ") === 0";
    }
    return not ? stm = "(" + stm + ") === false" : stm;
  }

  function operFn(s) {
    return s[0] + " " + comparators[s[1]] + " " + s[2];
  }

  function inFn(s, not) {
    var arr = s.splice(3, s.length - 4), stm;
    stm = "[" + arr.join(", ") + "].includes(" + s[0] + ")";
    return not ? stm = "(" + stm + ") === false" : stm;
  }

  function betweenFn(s, not) {
    var stm = s[0] + " >= " + s[2] + " && " + s[0] + " <= " + s[4];
    return not ? stm = "(" + stm + ") === false" : stm;
  }

  for (i = 0; i < s.length; i++) {
    if (s[i] instanceof Array) {
      operator = s[i][1];
      if (operator === li || operator === nl) {
        expr += likeFn(s[i], operator === nl);
      } else if (in_oper.includes(operator)) {
        expr += inFn(s[i], operator === ni);
      } else if (between_oper.includes(operator)) {
        expr += betweenFn(s[i], operator === nb);
      } else {
        expr += operFn(s[i]);
      }
    } else if (typeof s[i] === "string") {
      expr += " " + separators[s[i]] + " ";
    }
  }

  return expr;
};

self.parseString = function parseString(s) {
  var result = this.tokenize(s, true), result2;
  if (result.success) {
    result2 = this.parseTokens(result.tokens);
    if (result2.success) {
      return {success: true, expr: this.evaluate(result2.sentence)};
    } else if (result2.error) {
      return result2;
    }
  }
  if (result.error) return result;
};

return self;
};
