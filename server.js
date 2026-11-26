const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

let db = { users: [], sessions: {}, messages: [] };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

function hash(pw, salt) {
  return crypto.scryptSync(pw, salt, 64).toString('hex');
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 20000) { reject(new Error('big')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
    });
  });
}

function authUser(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const name = db.sessions[t];
  return name ? db.users.find(u => u.username === name) : null;
}

async function api(req, res, url) {
  const p = url.pathname;

  if (p === '/api/register' && req.method === 'POST') {
    const b = await readBody(req);
    const username = String(b.username || '').trim();
    const password = String(b.password || '');
    if (username.length < 3 || username.length > 20)
      return send(res, 400, { error: 'နာမည် ၃ လုံးမှ ၂၀ လုံးကြား ထည့်ပါ' });
    if (password.length < 6)
      return send(res, 400, { error: 'Password အနည်းဆုံး ၆ လုံးထည့်ပါ' });
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase()))
      return send(res, 400, { error: 'ဒီနာမည် အသုံးပြုပြီးသားပါ' });
    const salt = crypto.randomBytes(16).toString('hex');
    db.users.push({ username, salt, hash: hash(password, salt), created: Date.now() });
    const token = crypto.randomBytes(32).toString('hex');
    db.sessions[token] = username;
    save();
    return send(res, 200, { token, username });
  }

  if (p === '/api/login' && req.method === 'POST') {
    const b = await readBody(req);
    const username = String(b.username || '').trim();
    const password = String(b.password || '');
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return send(res, 401, { error: 'နာမည် သို့မဟုတ် Password မှားနေပါတယ်' });
    const a = Buffer.from(hash(password, user.salt), 'hex');
    const c = Buffer.from(user.hash, 'hex');
    if (!crypto.timingSafeEqual(a, c))
      return send(res, 401, { error: 'နာမည် သို့မဟုတ် Password မှားနေပါတယ်' });
    const token = crypto.randomBytes(32).toString('hex');
    db.sessions[token] = user.username;
    save();
    return send(res, 200, { token, username: user.username });
  }

  const user = authUser(req);
  if (!user) return send(res, 401, { error: 'ပြန်ဝင်ပါ' });

  if (p === '/api/me') return send(res, 200, { username: user.username });

  if (p === '/api/logout' && req.method === 'POST') {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    delete db.sessions[t];
    save();
    return send(res, 200, { ok: true });
  }

  if (p === '/api/messages' && req.method === 'GET')
    return send(res, 200, { messages: db.messages.slice(-100) });

  if (p === '/api/messages' && req.method === 'POST') {
    const b = await readBody(req);
    const text = String(b.text || '').trim().slice(0, 500);
    if (!text) return send(res, 400, { error: 'စာရိုက်ပါ' });
    db.messages.push({ user: user.username, text, time: Date.now() });
    if (db.messages.length > 500) db.messages = db.messages.slice(-500);
    save();
    return send(res, 200, { ok: true });
  }

  send(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log('Kachin Link running on port ' + PORT));
