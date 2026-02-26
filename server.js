const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SECRET = "supersecretkey";
const db = new sqlite3.Database("./database.db");

/* ================= DATABASE ================= */

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS admin(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS menu(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price INTEGER,
    img TEXT,
    best INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderNumber TEXT,
    customer TEXT,
    type TEXT,
    items TEXT,
    total INTEGER,
    payment TEXT,
    status TEXT DEFAULT 'new',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.get("SELECT * FROM admin", async (err, row) => {
    if (!row) {
      const hash = await bcrypt.hash("admin123", 10);
      db.run("INSERT INTO admin(username,password) VALUES(?,?)", ["admin", hash]);
      console.log("Default Admin: admin / admin123");
    }
  });
});

/* ================= AUTH ================= */

function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ msg: "No token" });
  try {
    jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(400).json({ msg: "Invalid token" });
  }
}

/* ================= ROUTES ================= */

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "customer.html"))
);

app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html"))
);

/* LOGIN */

app.post("/login", (req, res) => {
  db.get(
    "SELECT * FROM admin WHERE username=?",
    [req.body.username],
    async (err, row) => {
      if (!row) return res.json({ msg: "User not found" });

      const valid = await bcrypt.compare(req.body.password, row.password);
      if (!valid) return res.json({ msg: "Wrong password" });

      const token = jwt.sign({ id: row.id }, SECRET);
      res.json({ token });
    }
  );
});

/* MENU */

app.get("/menu", (req, res) => {
  db.all("SELECT * FROM menu", [], (err, rows) => res.json(rows));
});

app.post("/menu", auth, (req, res) => {
  const { name, price, img, best } = req.body;
  db.run(
    "INSERT INTO menu(name,price,img,best) VALUES(?,?,?,?)",
    [name, price, img, best ? 1 : 0],
    () => res.json({ msg: "Added" })
  );
});

app.delete("/menu/:id", auth, (req, res) => {
  db.run("DELETE FROM menu WHERE id=?", [req.params.id], () =>
    res.json({ msg: "Deleted" })
  );
});

/* ORDERS */

app.post("/order", (req, res) => {
  const { customer, type, items, total, payment } = req.body;

  const orderNumber = "GB-" + Date.now();

  db.run(
    "INSERT INTO orders(orderNumber,customer,type,items,total,payment) VALUES(?,?,?,?,?,?)",
    [orderNumber, customer, type, JSON.stringify(items), total, payment],
    () => res.json({ msg: "Order Saved" })
  );
});

app.get("/orders", auth, (req, res) => {
  db.all("SELECT * FROM orders WHERE status='new'", [], (err, rows) => {
    rows.forEach((r) => (r.items = JSON.parse(r.items)));
    res.json(rows);
  });
});

app.post("/order/status/:id", auth, (req, res) => {
  db.run(
    "UPDATE orders SET status=? WHERE id=?",
    [req.body.status, req.params.id],
    () => res.json({ msg: "Updated" })
  );
});

/* STATS */

app.get("/stats", auth, (req, res) => {
  db.get(
    "SELECT COUNT(*) as totalOrders, SUM(total) as totalSales FROM orders",
    [],
    (err, row) => res.json(row)
  );
});

/* START SERVER */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));