const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "public/games/hero-quest/index.html"), "utf8");

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  url: "http://localhost/",
});

dom.window.console.log = function(...args) { console.log("LOG:", ...args); };
dom.window.console.error = function(...args) { console.error("ERROR:", ...args); };

dom.window.addEventListener("error", (event) => {
    console.error("DOM ERROR:", event.error);
});
