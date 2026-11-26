const express = require("express");
const path = require("path");

const app = express();
const pub = path.join(__dirname, "public");

app.get("/sw.js", (req, res) => {
  res.set("Content-Type", "application/javascript");
  res.set("Cache-Control", "no-cache");
  res.sendFile(path.join(pub, "sw.js"));
});

app.get("/manifest.json", (req, res) => {
  res.set("Content-Type", "application/manifest+json");
  res.sendFile(path.join(pub, "manifest.json"));
});

app.use(express.static(pub));

app.use((req, res) => {
  res.sendFile(path.join(pub, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Running on " + port));