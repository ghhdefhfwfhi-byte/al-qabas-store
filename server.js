// القبس - متجر إلكتروني (Storefront + Admin API)
// Express server + JSON file "database" (db.json)
// Run: npm install && npm start   →  http://localhost:3000

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "db.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- tiny JSON "database" helpers ----------
function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}
function nextId(list) {
  return list.length ? Math.max(...list.map((x) => x.id)) + 1 : 1;
}

// ---------- admin auth guard ----------
// The API had NO server-side check at all — anyone who knew the endpoint
// URLs could add/edit/delete products, banners, orders, etc. without ever
// logging in (the login screen was only a client-side gate). This demo
// token check is lightweight but closes that hole: every write (POST/PUT/
// DELETE) to an admin-only route now requires the token issued at login.
// Before going to production, replace with real hashed-password + session
// auth (see README).
const ADMIN_TOKEN = "qabas-admin-token";
function requireAdmin(req, res, next) {
  if (req.header("x-admin-token") === ADMIN_TOKEN) return next();
  res.status(401).json({ error: "غير مصرح — الرجاء تسجيل الدخول" });
}

// ---------- generic CRUD factory for simple collections ----------
function crud(collectionName) {
  const base = `/api/${collectionName}`;

  app.get(base, (req, res) => {
    const db = readDB();
    res.json(db[collectionName] || []);
  });

  app.get(`${base}/:id`, (req, res) => {
    const db = readDB();
    const item = (db[collectionName] || []).find(
      (x) => String(x.id) === String(req.params.id)
    );
    if (!item) return res.status(404).json({ error: "غير موجود" });
    res.json(item);
  });

  app.post(base, requireAdmin, (req, res) => {
    const db = readDB();
    if (!db[collectionName]) db[collectionName] = [];
    const item = { id: nextId(db[collectionName]), ...req.body };
    db[collectionName].push(item);
    writeDB(db);
    res.status(201).json(item);
  });

  app.put(`${base}/:id`, requireAdmin, (req, res) => {
    const db = readDB();
    const idx = (db[collectionName] || []).findIndex(
      (x) => String(x.id) === String(req.params.id)
    );
    if (idx === -1) return res.status(404).json({ error: "غير موجود" });
    db[collectionName][idx] = {
      ...db[collectionName][idx],
      ...req.body,
      id: db[collectionName][idx].id,
    };
    writeDB(db);
    res.json(db[collectionName][idx]);
  });

  app.delete(`${base}/:id`, requireAdmin, (req, res) => {
    const db = readDB();
    const before = (db[collectionName] || []).length;
    db[collectionName] = (db[collectionName] || []).filter(
      (x) => String(x.id) !== String(req.params.id)
    );
    writeDB(db);
    res.json({ deleted: before !== db[collectionName].length });
  });
}

["products", "categories", "brands", "banners", "notifications", "customers"].forEach(
  crud
);

// ---------- orders (custom: needs status update + creation from cart) ----------
app.get("/api/orders", (req, res) => {
  const db = readDB();
  res.json(db.orders || []);
});

app.post("/api/orders", (req, res) => {
  const db = readDB();
  let { customerName, phone, address, items, shipping } = req.body;

  // ---- basic input validation ----
  customerName = String(customerName || "").trim().slice(0, 120);
  phone = String(phone || "").trim().slice(0, 30);
  address = String(address || "").trim().slice(0, 300);
  if (!customerName || !phone || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "بيانات الطلب ناقصة" });
  }
  if (items.length > 50) {
    return res.status(400).json({ error: "عدد المنتجات بالطلب كبير جداً" });
  }

  // ---- never trust client-supplied prices: re-price every line from the
  // ---- product catalog server-side, so a tampered request can't check out
  // ---- an item for an arbitrary (e.g. negative or zero) price ----
  const safeItems = [];
  for (const raw of items) {
    const product = (db.products || []).find(
      (p) => String(p.id) === String(raw.productId)
    );
    if (!product) {
      return res.status(400).json({ error: `منتج غير موجود: ${raw.productId}` });
    }
    const qty = Math.floor(Number(raw.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 999) {
      return res.status(400).json({ error: `كمية غير صالحة لـ ${product.name}` });
    }
    const price =
      product.discountPrice && product.discountPrice < product.price
        ? product.discountPrice
        : product.price;
    safeItems.push({ productId: product.id, name: product.name, price, qty });
  }

  const shippingFee = Number(shipping);
  const safeShipping =
    Number.isFinite(shippingFee) && shippingFee >= 0 ? shippingFee : 0;

  const total =
    safeItems.reduce((sum, i) => sum + i.price * i.qty, 0) + safeShipping;

  const order = {
    id: nextId(db.orders || []),
    customerName,
    phone,
    address,
    items: safeItems,
    shipping: safeShipping,
    total,
    status: "Pending",
    date: new Date().toISOString(),
  };
  db.orders = db.orders || [];
  db.orders.push(order);

  // upsert customer
  db.customers = db.customers || [];
  const existing = db.customers.find((c) => c.phone === phone);
  if (existing) {
    existing.ordersCount = (existing.ordersCount || 0) + 1;
  } else {
    db.customers.push({
      id: nextId(db.customers),
      name: customerName,
      phone,
      ordersCount: 1,
      joined: new Date().toISOString(),
    });
  }

  writeDB(db);
  res.status(201).json(order);
});

app.put("/api/orders/:id", requireAdmin, (req, res) => {
  const db = readDB();
  const idx = (db.orders || []).findIndex(
    (o) => String(o.id) === String(req.params.id)
  );
  if (idx === -1) return res.status(404).json({ error: "غير موجود" });
  db.orders[idx] = { ...db.orders[idx], ...req.body, id: db.orders[idx].id };
  writeDB(db);
  res.json(db.orders[idx]);
});

app.delete("/api/orders/:id", requireAdmin, (req, res) => {
  const db = readDB();
  db.orders = (db.orders || []).filter(
    (o) => String(o.id) !== String(req.params.id)
  );
  writeDB(db);
  res.json({ deleted: true });
});

// ---------- settings ----------
app.get("/api/settings", (req, res) => {
  const db = readDB();
  res.json(db.settings || {});
});
app.put("/api/settings", requireAdmin, (req, res) => {
  const db = readDB();
  db.settings = { ...db.settings, ...req.body };
  writeDB(db);
  res.json(db.settings);
});

// ---------- admin auth (simple demo login, not production-grade) ----------
app.post("/api/admin/login", (req, res) => {
  const db = readDB();
  const { username, password } = req.body;
  if (
    username === db.admin.username &&
    password === db.admin.password
  ) {
    // demo token — good enough for a single-admin local tool, replace with real auth before going live
    res.json({ token: ADMIN_TOKEN, username });
  } else {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
  }
});

// ---------- dashboard summary ----------
app.get("/api/dashboard-summary", (req, res) => {
  const db = readDB();
  const orders = db.orders || [];
  res.json({
    productsCount: (db.products || []).length,
    ordersCount: orders.length,
    revenue: orders.reduce((s, o) => s + o.total, 0),
    customersCount: (db.customers || []).length,
  });
});

app.listen(PORT, () => {
  console.log(`✅ متجر القبس يعمل على: http://localhost:${PORT}`);
  console.log(`   لوحة التحكم: http://localhost:${PORT}/admin`);
});
