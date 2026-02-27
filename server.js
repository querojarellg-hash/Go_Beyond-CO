const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const QRCode = require("qrcode");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SECRET = "supersecretkey";

/* ================= DATABASE ================= */

// Always create database in project root (Render writable)
const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database error:", err);
  } else {
    console.log("Database connected");
  }
});

db.serialize(() => {

  db.run(`CREATE TABLE IF NOT EXISTS admin(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS menu(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderNumber TEXT,
    items TEXT,
    total INTEGER,
    status TEXT DEFAULT 'new',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Default Admin
  db.get("SELECT * FROM admin", async (err,row)=>{
    if(!row){
      const hash = await bcrypt.hash("admin123",10);
      db.run("INSERT INTO admin(username,password) VALUES(?,?)",["admin",hash]);
      console.log("Default admin created");
    }
  });

  // Default Menu
  db.get("SELECT * FROM menu",(err,row)=>{
    if(!row){
      db.run("INSERT INTO menu(name,price) VALUES('Caramel Latte',150)");
      db.run("INSERT INTO menu(name,price) VALUES('Cappuccino',140)");
      db.run("INSERT INTO menu(name,price) VALUES('Chocolate Cake',160)");
      console.log("Default menu created");
    }
  });

});

/* ================= AUTH ================= */

function auth(req,res,next){
  const token = req.headers.authorization;
  if(!token) return res.status(401).json({msg:"No token"});
  try{
    jwt.verify(token,SECRET);
    next();
  }catch{
    res.status(400).json({msg:"Invalid token"});
  }
}

/* ================= ROUTES ================= */

app.get("/",(req,res)=>{
  res.sendFile(path.join(__dirname,"public/customer.html"));
});

app.get("/admin",(req,res)=>{
  res.sendFile(path.join(__dirname,"public/admin.html"));
});

app.get("/generate-qr",async(req,res)=>{
  try{
    const url = `${req.protocol}://${req.get("host")}`;
    const qr = await QRCode.toDataURL(url);
    res.json({qr});
  }catch(e){
    res.status(500).json({error:"QR generation failed"});
  }
});

app.post("/login",(req,res)=>{
  db.get("SELECT * FROM admin WHERE username=?",[req.body.username],
  async(err,row)=>{
    if(err) return res.status(500).json({msg:"DB error"});
    if(!row) return res.json({msg:"User not found"});
    const valid = await bcrypt.compare(req.body.password,row.password);
    if(!valid) return res.json({msg:"Wrong password"});
    const token = jwt.sign({id:row.id},SECRET);
    res.json({token});
  });
});

app.get("/menu",(req,res)=>{
  db.all("SELECT * FROM menu",[],(err,rows)=>{
    if(err) return res.status(500).json({msg:"DB error"});
    res.json(rows);
  });
});

app.post("/order",(req,res)=>{
  const orderNumber="GB-"+Date.now();
  db.run(
    "INSERT INTO orders(orderNumber,items,total) VALUES(?,?,?)",
    [orderNumber,JSON.stringify(req.body.items),req.body.total],
    (err)=>{
      if(err) return res.status(500).json({msg:"Insert failed"});
      res.json({msg:"Order saved"});
    }
  );
});

app.get("/orders",auth,(req,res)=>{
  db.all("SELECT * FROM orders ORDER BY id DESC",[],(err,rows)=>{
    if(err) return res.status(500).json({msg:"DB error"});
    rows.forEach(r=>r.items=JSON.parse(r.items));
    res.json(rows);
  });
});

app.post("/order/status/:id",auth,(req,res)=>{
  db.run("UPDATE orders SET status=? WHERE id=?",
  [req.body.status,req.params.id],
  (err)=>{
    if(err) return res.status(500).json({msg:"Update failed"});
    res.json({msg:"Updated"});
  });
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
  console.log("Server running on port " + PORT);
});
