const fs = require("fs");
const parser = require("@babel/parser");
const source = fs.readFileSync("src/screens/HomeScreen.js", "utf8");
try {
  parser.parse(source, {
    sourceType: "module",
    plugins: ["jsx", "classProperties"],
  });
  console.log("parsed OK");
} catch (e) {
  console.error(e.message);
  if (e.loc) console.error("loc", e.loc);
  if (e.codeFrame) console.error(e.codeFrame);
}
