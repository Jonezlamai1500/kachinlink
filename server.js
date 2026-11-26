// Kachin Link server (Login/Register ပါ) — npm install မလိုပါ။  လုပ်ရန်:  node server.js
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, 'data.json');
const DAY30 = 30 * 864e5;

let db = { posts: [], users: {}, sessions: {} };
try { Object.assign(db, JSON.parse(fs.readFileSync(DB, 'utf8'))); } catch (e) {}
if (!db.posts.length) db.posts.push({
  id: 1, uid: 'system', author: 'Kachin Link',
  text: 'Kachin Link မှ ကြိုဆိုပါတယ် 🔴🟢\nPost တင်၊ Like နှိပ်၊ Comment ရေး၊ Share လုပ်ကြည့်ပါ။',
  img: null, time: Date.now(), likes: [], shares: 0, comments: []
});
const save = () => fs.writeFile(DB, JSON.stringify(db), () => {});

const HEAD = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};
const send = (res, code, obj) => { res.writeHead(code, HEAD); res.end(JSON.stringify(obj)); };
const clean = (s, n) => String(s || '').trim().slice(0, n);
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const body = req => new Promise((ok, no) => {
  let d = '';
  req.on('data', c => { d += c; if (d.length > 6e6) { no(new Error('ဖိုင်ကြီးလွန်းပါတယ်')); req.destroy(); } });
  req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { no(e); } });
});
const view = (p, uid) => ({
  id: p.id, uid: p.uid, author: p.author, text: p.text, img: p.img, time: p.time,
  likes: p.likes.length, liked: !!uid && p.likes.includes(uid), shares: p.shares, comments: p.comments
});
function auth(req) {
  const m = (req.headers.authorization || '').match(/^Bearer (\w+)$/);
  const s = m && db.sessions[m[1]];
  if (!s || Date.now() - s.time > DAY30 || !db.users[s.un]) return null;
  const u = db.users[s.un];
  return { uid: u.uid, name: u.name };
}
function login(un) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = { un, time: Date.now() };
  const u = db.users[un]; save();
  return { token, uid: u.uid, name: u.name };
}
const fails = {};   // ip -> {n, t}  (password ခဏခဏ မှားတာကို ကန့်သတ်)

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
    const f = path.join(__dirname, 'kachinlink.html');
    if (fs.existsSync(f)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(f)); }
    return send(res, 200, { ok: true, name: 'Kachin Link API' });
  }

  try {
    // ---- Register / Login ----
    if (req.method === 'POST' && (p === '/api/register' || p === '/api/login')) {
      const b = await body(req), un = clean(b.username, 20).toLowerCase(), pw = String(b.password || '');
      if (p === '/api/register') {
        if (!/^[a-z0-9_.]{3,20}$/.test(un)) return send(res, 400, { error: 'Username က အင်္ဂလိပ်စာလုံး/ဂဏန်း ၃-၂၀ လုံး ဖြစ်ရပါမယ်' });
        if (pw.length < 6 || pw.length > 64) return send(res, 400, { error: 'Password က ၆ လုံးအထက် ဖြစ်ရပါမယ်' });
        if (db.users[un]) return send(res, 409, { error: 'ဒီ Username ရှိပြီးသားပါ' });
        const salt = crypto.randomBytes(16).toString('hex');
        db.users[un] = { uid: 'u' + crypto.randomBytes(6).toString('hex'), name: clean(b.name, 24) || un, salt, hash: hashPw(pw, salt) };
        return send(res, 201, login(un));
      }
      const ip = req.socket.remoteAddress, f = fails[ip] || { n: 0, t: Date.now() };
      if (Date.now() - f.t > 6e4) { f.n = 0; f.t = Date.now(); }
      if (f.n >= 8) return send(res, 429, { error: 'မှားလွန်းပါတယ်၊ ၁ မိနစ်စောင့်ပြီး ပြန်ကြိုးစားပါ' });
      const u = db.users[un];
      const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(pw, u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
      if (!ok) { f.n++; fails[ip] = f; return send(res, 401, { error: 'Username သို့မဟုတ် Password မှားနေပါတယ်' }); }
      delete fails[ip];
      return send(res, 200, login(un));
    }

    const me = auth(req);

    // ---- Posts ----
    if (p === '/api/posts' && req.method === 'GET')
      return send(res, 200, db.posts.map(x => view(x, me && me.uid)));

    if (!me) return send(res, 401, { error: 'ပြန်ဝင်ပါ' });

    if (p === '/api/posts' && req.method === 'POST') {
      const b = await body(req);
      const text = clean(b.text, 2000);
      const img = typeof b.img === 'string' && b.img.startsWith('data:image/') ? b.img : null;
      if (!text && !img) return send(res, 400, { error: 'Post အလွတ်ဖြစ်နေပါတယ်' });
      const post = { id: Date.now(), uid: me.uid, author: me.name, text, img, time: Date.now(), likes: [], shares: 0, comments: [] };
      db.posts.unshift(post); save();
      return send(res, 201, view(post, me.uid));
    }

    const m = p.match(/^\/api\/posts\/(\d+)(?:\/(like|comments|share))?$/);
    if (m) {
      const post = db.posts.find(x => x.id === +m[1]);
      if (!post) return send(res, 404, { error: 'Post မတွေ့ပါ' });
      if (req.method === 'DELETE' && !m[2]) {
        if (post.uid !== me.uid) return send(res, 403, { error: 'ကိုယ့် Post ကိုသာ ဖျက်လို့ရပါတယ်' });
        db.posts = db.posts.filter(x => x !== post); save();
        return send(res, 200, { ok: true });
      }
      if (req.method === 'POST') {
        const b = await body(req);
        if (m[2] === 'like') {
          const i = post.likes.indexOf(me.uid);
          i >= 0 ? post.likes.splice(i, 1) : post.likes.push(me.uid);
        } else if (m[2] === 'comments') {
          const text = clean(b.text, 500); if (!text) return send(res, 400, { error: 'Comment အလွတ်ဖြစ်နေပါတယ်' });
          post.comments.push({ id: Date.now(), uid: me.uid, author: me.name, text, time: Date.now() });
        } else if (m[2] === 'share') post.shares++;
        else return send(res, 404, { error: 'not found' });
        save();
        return send(res, 200, view(post, me.uid));
      }
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 400, { error: String(e.message || e) }); }
}).listen(PORT, '0.0.0.0', () => console.log('Kachin Link server: http://localhost:' + PORT));
