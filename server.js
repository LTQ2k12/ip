const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// session để login
app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: true
}));

// file lưu data
const USERS_FILE = "users.json";
const MAPPING_FILE = "mapping.json";
const LOG_FILE = "logs.json";

// hàm đọc/ghi JSON
function readJSON(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// middleware check login
function isLoggedIn(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

// routes
app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  if (users[username] && users[username].password === password) {
    req.session.user = username;
    res.redirect("/dashboard");
  } else {
    res.send("Sai tài khoản hoặc mật khẩu. <a href='/login'>Thử lại</a>");
  }
});

app.get("/register", (req, res) => res.sendFile(path.join(__dirname, "register.html")));
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  if (users[username]) {
    return res.send("Tên người dùng đã tồn tại. <a href='/register'>Thử lại</a>");
  }
  users[username] = { password };
  writeJSON(USERS_FILE, users);
  res.redirect("/login");
});

app.get("/dashboard", isLoggedIn, (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.post("/create", isLoggedIn, (req, res) => {
  const { url } = req.body;
  const mapping = readJSON(MAPPING_FILE);

  const linkId = Math.random().toString(36).substring(2, 8);
  mapping[linkId] = { url, owner: req.session.user };
  writeJSON(MAPPING_FILE, mapping);

  res.send(`Link của bạn: <a href="/r/${linkId}">${req.headers.host}/r/${linkId}</a><br>
            <a href="/dashboard">Quay lại Dashboard</a>`);
});

app.get("/r/:id", (req, res) => {
  const mapping = readJSON(MAPPING_FILE);
  const logs = readJSON(LOG_FILE);
  const linkId = req.params.id;

  if (!mapping[linkId]) return res.status(404).send("Link không tồn tại");

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  if (!logs[linkId]) logs[linkId] = [];
  logs[linkId].push({ ip, time: new Date().toISOString() });
  writeJSON(LOG_FILE, logs);

  res.redirect(mapping[linkId].url);
});

app.get("/logs/:id", isLoggedIn, (req, res) => {
  const mapping = readJSON(MAPPING_FILE);
  const logs = readJSON(LOG_FILE);
  const linkId = req.params.id;

  if (!mapping[linkId]) return res.status(404).send("Link không tồn tại");
  if (mapping[linkId].owner !== req.session.user) {
    return res.status(403).send("Bạn không có quyền xem log của link này.");
  }

  res.json(logs[linkId] || []);
});

app.listen(PORT, () => console.log(`✅ Server chạy tại http://localhost:${PORT}`));

