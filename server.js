const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const path = require("path");

const app = express();
const pub = path.join(__dirname, "public");

// ===== ဒီ ၃ ခုကို ကိုယ့်တန်ဖိုးနဲ့ ပြင်ပါ =====
const APP_ID = "2676497966100916";
const APP_SECRET = "a91610deacecb4e4f6910668b1f5ae3";
const SESSION_KEY = "ကိုယ်ဘာသာ ရောရိုက်ထားတဲ့ စာလုံးရှည်";
// ==========================================
const BASE_URL = "https://kachinlink-production.up.railway.app";
const REDIRECT = BASE_URL + "/auth/facebook/callback";

app.set("trust proxy", 1);
app.use(session({
  secret: SESSION_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, httpOnly: true, sameSite: "lax", maxAge: 604800000 }
}));

app.get("/auth/facebook", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.state = state;
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&state=${state}&scope=public_profile`;
  res.redirect(url);
});

app.get("/auth/facebook/callback", async (req, res) => {
  try {
    if (!req.query.code || req.query.state !== req.session.state) {
      return res.redirect("/?login=failed");
    }
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&client_secret=${APP_SECRET}&code=${encodeURIComponent(req.query.code)}`;
    const token = await (await fetch(tokenUrl)).json();
    if (!token.access_token) return res.redirect("/?login=failed");

    const meUrl = `https://graph.facebook.com/me?fields=id,name,picture.type(large)&access_token=${token.access_token}`;
    const me = await (await fetch(meUrl)).json();
    if (!me.id) return res.redirect("/?login=failed");

    req.session.user = {
      id: me.id,
      name: me.name,
      picture: me.picture && me.picture.data ? me.picture.data.url : null
    };
    res.redirect("/");
  } catch (e) {
    console.error(e);
    res.redirect("/?login=failed");
  }
});

app.get("/sw.js", (req, res) => {
  res.sendFile(path.join(pub, "sw.js"));
});

app.use(express.static(pub));

app.get("*", (req, res) => {
  res.sendFile(path.join(pub, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Running on " + PORT);
});
