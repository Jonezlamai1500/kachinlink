const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const app = express();
const pub = path.join(__dirname, "public");

// ===== ဒီ ၂ ခုကို ကိုယ့်ဟာကိုယ် ပြင်ပါ (သို့) Railway Variables ထဲ ထည့်ပါ =====
const APP_ID = process.env.APP_ID || "2676497966100916";
const APP_SECRET = process.env.APP_SECRET || "a91610deacecb4e4f6910668b1f5ae3";
const SESSION_KEY = process.env.SESSION_KEY || "ကိုယ်ဘာသာရေးထားတဲ့ရှည်တဲ့random စာလုံး";
// =====================================================================
const BASE_URL = "https://kachinlink-production.up.railway.app";
const REDIRECT = BASE_URL + "/auth/facebook/callback";

app.set("trust proxy", 1);
app.use(
  session({
    secret: SESSION_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, httpOnly: true, sameSite: "lax", maxAge: 604800000 }
  })
);

app.get("/auth/facebook", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.state = state;
  const url =
    "https://www.facebook.com/v19.0/dialog/oauth?client_id=" + APP_ID +
    "&redirect_uri=" + encodeURIComponent(REDIRECT) +
    "&state=" + state +
    "&scope=public_profile";
  req.session.save(() => res.redirect(url));
});

app.get("/auth/facebook/callback", async (req, res) => {
  try {
    if (!req.query.code || req.query.state !== req.session.state) {
      console.log("STATE CHECK FAILED", {
        hasCode: !!req.query.code,
        queryState: req.query.state,
        sessionState: req.session.state,
        fbError: req.query.error_description || req.query.error
      });
      return res.redirect("/?login=failed");
    }

    const tokenUrl =
      "https://graph.facebook.com/v19.0/oauth/access_token?client_id=" + APP_ID +
      "&redirect_uri=" + encodeURIComponent(REDIRECT) +
      "&client_secret=" + encodeURIComponent(APP_SECRET) +
      "&code=" + encodeURIComponent(req.query.code);
    const token = await (await fetch(tokenUrl)).json();
    console.log("FB token response:", JSON.stringify(token).slice(0, 300));
    if (!token.access_token) return res.redirect("/?login=failed");

    const meUrl =
      "https://graph.facebook.com/me?fields=id,name,picture.type(large)&access_token=" +
      encodeURIComponent(token.access_token);
    const me = await (await fetch(meUrl)).json();
    if (!me.id) {
      console.log("FB me response:", JSON.stringify(me).slice(0, 300));
      return res.redirect("/?login=failed");
    }

    req.session.user = {
      id: me.id,
      name: me.name,
      picture: me.picture && me.picture.data ? me.picture.data.url : null
    };
    req.session.save(() => res.redirect("/"));
  } catch (e) {
    console.error(e);
    res.redirect("/?login=failed");
  }
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.get("/sw.js", (req, res) => {
  const f = path.join(pub, "sw.js");
  res.set("Cache-Control", "no-cache");
  if (fs.existsSync(f)) res.type("application/javascript").sendFile(f);
  else res.status(404).end();
});

app.use(express.static(pub));

app.use((req, res) => {
  res.sendFile(path.join(pub, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Running on " + PORT);
});
