// admin.js - لوحة تحكم القبس (SPA بسيطة بدون فريمورك)

const TOKEN_KEY = "qabas_admin_token";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US") + " د.ع";
}
function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString("ar-IQ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// escape any user-supplied text before it goes into innerHTML — orders,
// customer names/addresses etc. come from the public checkout form and must
// never be trusted as raw HTML (stored-XSS prevention)
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": localStorage.getItem(TOKEN_KEY) || "",
    },
    ...opts,
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
    throw new Error("انتهت الجلسة، الرجاء تسجيل الدخول مجدداً");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "حدث خطأ");
  }
  return res.json();
}

function showToast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__t);
  window.__t = setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------------- auth ----------------
document.getElementById("login-btn").addEventListener("click", doLogin);
document.getElementById("login-password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

async function doLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  try {
    const res = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem(TOKEN_KEY, res.token);
    boot();
  } catch (e) {
    document.getElementById("login-error").style.display = "block";
  }
}

document.getElementById("logout-btn").addEventListener("click", (e) => {
  e.preventDefault();
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
});

// ---------------- tabs ----------------
const TABS = [
  { key: "dashboard", label: "نظرة عامة" },
  { key: "products", label: "المنتجات" },
  { key: "categories", label: "الفئات" },
  { key: "brands", label: "العلامات التجارية" },
  { key: "banners", label: "واجهة التطبيق" },
  { key: "orders", label: "الطلبات" },
  { key: "customers", label: "الزبائن" },
  { key: "notifications", label: "الاشعارات" },
  { key: "settings", label: "الاعدادات" },
];

let CATEGORIES = [];
let BRANDS = [];

function boot() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("admin-shell").style.display = "block";
  const tabsEl = document.getElementById("admin-tabs");
  tabsEl.innerHTML = "";
  TABS.forEach((t, i) => {
    const btn = document.createElement("button");
    btn.textContent = t.label;
    btn.dataset.key = t.key;
    if (i === 0) btn.classList.add("active");
    btn.onclick = () => switchTab(t.key);
    tabsEl.appendChild(btn);
  });
  switchTab("dashboard");
}

async function switchTab(key) {
  document.querySelectorAll(".admin-tabs button").forEach((b) =>
    b.classList.toggle("active", b.dataset.key === key)
  );
  const body = document.getElementById("admin-body");
  body.innerHTML = `<p style="color:#6b7280">جاري التحميل...</p>`;

  [CATEGORIES, BRANDS] = await Promise.all([
    api("/api/categories"),
    api("/api/brands"),
  ]);

  if (key === "dashboard") return renderDashboard();
  if (key === "orders") return renderOrders();
  if (key === "customers") return renderCustomers();
  if (key === "settings") return renderSettings();
  return renderEntity(key);
}

// ---------------- dashboard ----------------
async function renderDashboard() {
  const summary = await api("/api/dashboard-summary");
  const body = document.getElementById("admin-body");
  body.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">عدد المنتجات</div><div class="value">${summary.productsCount}</div></div>
      <div class="stat-card"><div class="label">عدد الطلبات</div><div class="value">${summary.ordersCount}</div></div>
      <div class="stat-card"><div class="label">إجمالي المبيعات</div><div class="value">${fmt(summary.revenue)}</div></div>
      <div class="stat-card"><div class="label">عدد الزبائن</div><div class="value">${summary.customersCount}</div></div>
    </div>
    <p style="color:#6b7280; font-size:14px;">
      👋 أهلاً صالح — هذه لوحة تحكم متجر <strong>القبس</strong>. استخدم التبويبات بالأعلى لإدارة المنتجات، الفئات، البانرات، الطلبات، والإعدادات.
    </p>
  `;
}

// ---------------- generic entity CRUD ----------------
const CONFIGS = {
  products: {
    title: "المنتجات",
    addLabel: "+ إضافة منتج",
    columns: ["صورة", "الاسم", "الفئة", "السعر", "بعد الخصم", "المخزون", "مفعّل", "الإجراءات"],
    fields: [
      { key: "name", label: "اسم المنتج", type: "text", required: true },
      { key: "categoryId", label: "الفئة", type: "select-category", required: true },
      { key: "brandId", label: "العلامة التجارية", type: "select-brand" },
      { key: "price", label: "السعر (د.ع)", type: "number", required: true },
      { key: "discountPrice", label: "السعر بعد الخصم (اختياري)", type: "number" },
      { key: "stock", label: "الكمية بالمخزون", type: "number" },
      { key: "image", label: "رابط الصورة", type: "text", placeholder: "/images/products/laser-1.svg" },
      { key: "description", label: "الوصف", type: "textarea" },
      { key: "active", label: "مفعّل بالمتجر", type: "checkbox" },
    ],
    row(p) {
      const cat = CATEGORIES.find((c) => c.id === p.categoryId);
      return [
        `<img class="thumb" src="${esc(p.image || "")}" onerror="this.style.opacity=0.2" />`,
        `<strong>${esc(p.name)}</strong>`,
        cat ? esc(cat.name) : "-",
        fmt(p.price),
        p.discountPrice ? fmt(p.discountPrice) : "-",
        p.stock ?? "-",
        `<span class="badge ${p.active !== false ? "on" : "off"}">${p.active !== false ? "مفعّل" : "متوقف"}</span>`,
      ];
    },
    defaults: { active: true, price: 0, stock: 0 },
  },
  categories: {
    title: "الفئات",
    addLabel: "+ إضافة فئة",
    columns: ["الأيقونة", "الاسم", "الترتيب", "الإجراءات"],
    fields: [
      { key: "name", label: "اسم الفئة", type: "text", required: true },
      { key: "icon", label: "أيقونة (إيموجي)", type: "text", placeholder: "🖨️" },
      { key: "order", label: "الترتيب", type: "number" },
    ],
    row(c) {
      return [`<span style="font-size:20px">${esc(c.icon || "")}</span>`, `<strong>${esc(c.name)}</strong>`, c.order ?? "-"];
    },
    defaults: { order: 1 },
  },
  brands: {
    title: "العلامات التجارية",
    addLabel: "+ إضافة علامة تجارية",
    columns: ["الشعار", "الاسم", "الترتيب", "الإجراءات"],
    fields: [
      { key: "name", label: "اسم العلامة", type: "text", required: true },
      { key: "logo", label: "رابط الشعار", type: "text", placeholder: "/images/brands/hp.svg" },
      { key: "order", label: "الترتيب", type: "number" },
    ],
    row(b) {
      return [`<img class="thumb" src="${esc(b.logo || "")}" onerror="this.style.opacity=0.2" />`, `<strong>${esc(b.name)}</strong>`, b.order ?? "-"];
    },
    defaults: { order: 1 },
  },
  banners: {
    title: "واجهة التطبيق (البانرات)",
    addLabel: "+ إضافة واجهة جديدة",
    columns: ["صورة", "العنوان", "النوع", "الترتيب", "مفعّل", "الإجراءات"],
    fields: [
      { key: "title", label: "العنوان", type: "text", required: true },
      { key: "subtitle", label: "العنوان الفرعي", type: "text" },
      { key: "type", label: "النوع", type: "select", options: ["Slider", "Single", "List"] },
      { key: "image", label: "رابط الصورة", type: "text", placeholder: "/images/banners/banner-1.svg" },
      { key: "link", label: "رابط عند الضغط (اختياري)", type: "text" },
      { key: "order", label: "الترتيب", type: "number" },
      { key: "active", label: "مفعّل", type: "checkbox" },
    ],
    row(b) {
      return [
        `<img class="thumb" src="${esc(b.image || "")}" onerror="this.style.opacity=0.2" />`,
        `<strong>${esc(b.title)}</strong>`,
        esc(b.type),
        b.order ?? "-",
        `<span class="badge ${b.active !== false ? "on" : "off"}">${b.active !== false ? "مفعّل" : "متوقف"}</span>`,
      ];
    },
    defaults: { type: "Slider", order: 1, active: true },
  },
  notifications: {
    title: "الاشعارات",
    addLabel: "+ إضافة إشعار جديد",
    columns: ["العنوان", "الرسالة", "التاريخ", "الإجراءات"],
    fields: [
      { key: "title", label: "العنوان", type: "text", required: true },
      { key: "message", label: "الرسالة", type: "textarea", required: true },
    ],
    row(n) {
      return [`<strong>${esc(n.title)}</strong>`, esc(n.message), fmtDate(n.date)];
    },
    defaults: {},
    beforeSave(data) {
      if (!data.id) data.date = new Date().toISOString();
      return data;
    },
  },
};

async function renderEntity(key) {
  const cfg = CONFIGS[key];
  const list = await api(`/api/${key}`);
  const body = document.getElementById("admin-body");
  body.innerHTML = `
    <div class="panel-toolbar">
      <h2 style="margin:0">${cfg.title}</h2>
      <button class="btn-primary" id="add-btn">${cfg.addLabel}</button>
    </div>
    <table class="admin-table">
      <thead><tr>${cfg.columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody id="table-body"></tbody>
    </table>
  `;
  document.getElementById("add-btn").onclick = () => openEntityModal(key, null);

  const tbody = document.getElementById("table-body");
  if (!list.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${cfg.columns.length}">لا توجد بيانات بعد</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  list.forEach((item) => {
    const tr = document.createElement("tr");
    const cells = cfg.row(item);
    tr.innerHTML =
      cells.map((c) => `<td>${c}</td>`).join("") +
      `<td class="actions-cell">
         <button class="icon-btn edit" title="تعديل">✏️</button>
         <button class="icon-btn danger" title="حذف">🗑️</button>
       </td>`;
    tr.querySelector(".edit").onclick = () => openEntityModal(key, item);
    tr.querySelector(".danger").onclick = () => deleteEntity(key, item.id);
    tbody.appendChild(tr);
  });
}

async function deleteEntity(key, id) {
  if (!confirm("هل أنت متأكد من الحذف؟")) return;
  await api(`/api/${key}/${id}`, { method: "DELETE" });
  showToast("تم الحذف");
  renderEntity(key);
}

function fieldInput(f, value) {
  const v = value === undefined || value === null ? "" : value;
  if (f.type === "textarea") {
    return `<textarea data-key="${f.key}" rows="3">${v}</textarea>`;
  }
  if (f.type === "checkbox") {
    return `<input type="checkbox" data-key="${f.key}" ${value ? "checked" : ""} style="width:auto" />`;
  }
  if (f.type === "select") {
    return `<select data-key="${f.key}">${f.options
      .map((o) => `<option value="${o}" ${o === value ? "selected" : ""}>${o}</option>`)
      .join("")}</select>`;
  }
  if (f.type === "select-category") {
    return `<select data-key="${f.key}">${CATEGORIES.map(
      (c) => `<option value="${c.id}" ${c.id === value ? "selected" : ""}>${c.name}</option>`
    ).join("")}</select>`;
  }
  if (f.type === "select-brand") {
    return `<select data-key="${f.key}"><option value="">بدون علامة</option>${BRANDS.map(
      (b) => `<option value="${b.id}" ${b.id === value ? "selected" : ""}>${b.name}</option>`
    ).join("")}</select>`;
  }
  return `<input type="${f.type}" data-key="${f.key}" value="${v}" placeholder="${f.placeholder || ""}" />`;
}

function openEntityModal(key, item) {
  const cfg = CONFIGS[key];
  const overlay = document.getElementById("modal-overlay");
  const box = document.getElementById("modal-box");
  const data = item ? { ...item } : { ...cfg.defaults };

  box.innerHTML = `
    <h3>${item ? "تعديل" : cfg.addLabel}</h3>
    <div id="modal-fields">
      ${cfg.fields
        .map(
          (f) => `
        <div class="form-field">
          <label>${f.label}</label>
          ${fieldInput(f, data[f.key])}
        </div>`
        )
        .join("")}
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" id="modal-cancel">إلغاء</button>
      <button class="btn-save" id="modal-save">حفظ</button>
    </div>
  `;
  overlay.classList.remove("hidden");
  document.getElementById("modal-cancel").onclick = () => overlay.classList.add("hidden");

  document.getElementById("modal-save").onclick = async () => {
    const payload = { ...data };
    cfg.fields.forEach((f) => {
      const el = document.querySelector(`#modal-fields [data-key="${f.key}"]`);
      if (!el) return;
      if (f.type === "checkbox") payload[f.key] = el.checked;
      else if (f.type === "number") payload[f.key] = el.value === "" ? null : Number(el.value);
      else if (f.type === "select-category" || f.type === "select-brand")
        payload[f.key] = el.value === "" ? null : Number(el.value);
      else payload[f.key] = el.value;
    });
    const finalPayload = cfg.beforeSave ? cfg.beforeSave(payload) : payload;

    try {
      if (item) {
        await api(`/api/${key}/${item.id}`, { method: "PUT", body: JSON.stringify(finalPayload) });
      } else {
        await api(`/api/${key}`, { method: "POST", body: JSON.stringify(finalPayload) });
      }
      overlay.classList.add("hidden");
      showToast("تم الحفظ ✅");
      renderEntity(key);
    } catch (e) {
      alert(e.message);
    }
  };
}

// ---------------- orders ----------------
const ORDER_STATUSES = ["Pending", "Packaging", "Shipped", "Delivered", "Cancelled"];
const STATUS_LABELS = {
  Pending: "قيد الانتظار",
  Packaging: "تجهيز",
  Shipped: "تم الشحن",
  Delivered: "تم التوصيل",
  Cancelled: "ملغي",
};

async function renderOrders() {
  const orders = (await api("/api/orders")).sort((a, b) => new Date(b.date) - new Date(a.date));
  const body = document.getElementById("admin-body");
  body.innerHTML = `
    <div class="panel-toolbar"><h2 style="margin:0">الطلبات</h2></div>
    <table class="admin-table">
      <thead><tr>
        <th>#</th><th>الزبون</th><th>الهاتف</th><th>العنوان</th><th>المنتجات</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th><th>الإجراءات</th>
      </tr></thead>
      <tbody id="table-body"></tbody>
    </table>
  `;
  const tbody = document.getElementById("table-body");
  if (!orders.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">لا توجد طلبات بعد</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  orders.forEach((o) => {
    const tr = document.createElement("tr");
    const itemsSummary = o.items.map((i) => `${esc(i.name)} ×${Number(i.qty) || 0}`).join("، ");
    const select = document.createElement("select");
    ORDER_STATUSES.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = STATUS_LABELS[s];
      if (s === o.status) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = async () => {
      await api(`/api/orders/${o.id}`, { method: "PUT", body: JSON.stringify({ status: select.value }) });
      showToast("تم تحديث حالة الطلب");
    };

    tr.innerHTML = `
      <td>#${o.id}</td>
      <td>${esc(o.customerName)}</td>
      <td>${esc(o.phone)}</td>
      <td>${esc(o.address) || "-"}</td>
      <td style="max-width:220px; font-size:12px; color:#6b7280;">${itemsSummary}</td>
      <td><strong>${fmt(o.total)}</strong></td>
      <td id="status-cell-${o.id}"></td>
      <td>${fmtDate(o.date)}</td>
      <td class="actions-cell"><button class="icon-btn danger" title="حذف">🗑️</button></td>
    `;
    tr.querySelector(`#status-cell-${o.id}`).appendChild(select);
    tr.querySelector(".danger").onclick = async () => {
      if (!confirm("حذف هذا الطلب؟")) return;
      await api(`/api/orders/${o.id}`, { method: "DELETE" });
      renderOrders();
    };
    tbody.appendChild(tr);
  });
}

// ---------------- customers (read-only) ----------------
async function renderCustomers() {
  const customers = await api("/api/customers");
  const body = document.getElementById("admin-body");
  body.innerHTML = `
    <div class="panel-toolbar"><h2 style="margin:0">الزبائن</h2></div>
    <table class="admin-table">
      <thead><tr><th>الاسم</th><th>الهاتف</th><th>عدد الطلبات</th><th>تاريخ الانضمام</th></tr></thead>
      <tbody id="table-body"></tbody>
    </table>
  `;
  const tbody = document.getElementById("table-body");
  if (!customers.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">لا يوجد زبائن بعد</td></tr>`;
    return;
  }
  tbody.innerHTML = customers
    .map(
      (c) => `<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.phone)}</td><td>${c.ordersCount || 0}</td><td>${fmtDate(c.joined)}</td></tr>`
    )
    .join("");
}

// ---------------- settings ----------------
async function renderSettings() {
  const s = await api("/api/settings");
  const body = document.getElementById("admin-body");
  body.innerHTML = `
    <div class="panel-toolbar"><h2 style="margin:0">الإعدادات العامة</h2></div>
    <div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:22px;max-width:560px;">
      <div class="form-field"><label>اسم المتجر</label><input id="s-storeName" value="${s.storeName || ""}" /></div>
      <div class="form-field"><label>رقم الهاتف</label><input id="s-phone" value="${s.phone || ""}" /></div>
      <div class="form-field"><label>العنوان</label><input id="s-address" value="${s.address || ""}" /></div>
      <div class="form-field"><label>نبذة عن المتجر</label><textarea id="s-about" rows="3">${s.about || ""}</textarea></div>
      <div class="form-field"><label>وقت التوصيل المعروض</label><input id="s-deliveryTimeLabel" value="${s.deliveryTimeLabel || ""}" /></div>
      <div class="form-field row2">
        <div><label>رسوم شحن صغيرة</label><input id="s-shippingSmall" type="number" value="${s.shippingSmall || 0}" /></div>
        <div><label>رسوم شحن متوسطة</label><input id="s-shippingMedium" type="number" value="${s.shippingMedium || 0}" /></div>
        <div><label>رسوم شحن كبيرة</label><input id="s-shippingLarge" type="number" value="${s.shippingLarge || 0}" /></div>
      </div>
      <button class="btn-primary" id="save-settings">حفظ التغييرات 💾</button>
    </div>
  `;
  document.getElementById("save-settings").onclick = async () => {
    const payload = {
      storeName: document.getElementById("s-storeName").value,
      phone: document.getElementById("s-phone").value,
      address: document.getElementById("s-address").value,
      about: document.getElementById("s-about").value,
      deliveryTimeLabel: document.getElementById("s-deliveryTimeLabel").value,
      shippingSmall: Number(document.getElementById("s-shippingSmall").value) || 0,
      shippingMedium: Number(document.getElementById("s-shippingMedium").value) || 0,
      shippingLarge: Number(document.getElementById("s-shippingLarge").value) || 0,
    };
    await api("/api/settings", { method: "PUT", body: JSON.stringify(payload) });
    showToast("تم حفظ الإعدادات ✅");
  };
}

// ---------------- init ----------------
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") e.target.classList.add("hidden");
});

if (localStorage.getItem(TOKEN_KEY)) {
  boot();
}
