
var parser = new SqlParser();

function testSearchCondition(text) {
  var result = parser.parseString(text);
  if (result.error) {
    searchCondition.classList = ["error"];
    error(result.error);
  } else if (result.success) {
    searchCondition.classList = ["success"];
    success(result);
  }
}

function replace(expr, values) {
  var result = expr, re;
  for (var k in values) {
    re = new RegExp(k.toUpperCase(), "g");
    if (!isNaN(values[k])) {
      result = result.replace(re, values[k]);
    } else {
      result = result.replace(re, "'" + values[k] + "'");
    }
  }
  return result;
}

function success(result) {
  evaluation.hidden = false;
  errorMessage.hidden = true;
  var expr = result.expr,
    repl = replace(expr, world),
    res;

  document.getElementById("expr").innerText = expr;
  document.getElementById("repl").innerText = repl;

  try {
    res = eval(repl);
    document.getElementById("eval").innerText = res;
  } catch (ex) {
    error(ex.message);
  }
}

function error(text) {
  errorMessage.innerText = text;
  errorMessage.hidden = false;
  evaluation.hidden = true;
}

function getText(event) {
  var text = event.target.value;
  return text.trim();
}

var searchCondition = document.getElementById("searchCondition");

searchCondition.addEventListener("input", function (event) {
  testSearchCondition(getText(event));
});

var errorMessage = document.getElementById("errorMessage");

var evaluation = document.getElementById("evaluation");

var theWorld = document.getElementById("theWorld");

theWorld.addEventListener("input", function (event) {
  try {
    var obj = JSON.parse(getText(event));
    world = obj;
    testSearchCondition(searchCondition.value);
    theWorld.classList = ["success"];
  } catch (ex) {
    theWorld.classList = ["error"];
  }
});

var world = {
  manifold: "M",
  well: "3"
};

theWorld.innerText = JSON.stringify(world).toUpperCase();
theWorld.classList = ["success"];

searchCondition.innerText = 'manifold like "M%" and well in (1, 2, 3)';
searchCondition.classList = ["success"];

testSearchCondition(searchCondition.value);
