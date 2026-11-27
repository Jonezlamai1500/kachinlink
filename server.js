const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const path = require("path");

const app = express();
const pub = path.join(__dirname, "public");

const APP_ID = process.env.FB_APP_ID;
const APP_SECRET = process.env.FB_APP_SECRET;
const BASE_URL = process.env.BASE_URL;
const REDIRECT = BASE_URL + "/auth/facebook/callback";

app.set("trust proxy", 1);
app.use(session({
  secret: process.env.SESSION_SECRET || "change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 * 1000 }
}));

app.get("/auth/facebook", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.state = state;
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&state=${state}&scope=public_profile`;
  res.redirect(url);
});
