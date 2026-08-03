// common.js - shared helpers for storefront pages (header, footer, cart)

const CART_KEY = "qabas_cart";

function fmtPrice(n) {
  return Number(n || 0).toLocaleString("en-US") + " د.ع";
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}
function cartCount() {
  return getCart().reduce((s, i) => s + i.qty, 0);
}
function addToCart(product, qty = 1) {
  const cart = getCart();
  const existing = cart.find((i) => i.id === product.id);
  const price = product.discountPrice || product.price;
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price,
      image: product.image,
      qty,
    });
  }
  saveCart(cart);
  showToast("تمت إضافة المنتج إلى السلة ✅");
}
function removeFromCart(id) {
  saveCart(getCart().filter((i) => i.id !== id));
}
function setQty(id, qty) {
  const cart = getCart();
  const item = cart.find((i) => i.id === id);
  if (item) {
    item.qty = Math.max(1, qty);
    saveCart(cart);
  }
}
function cartSubtotal() {
  return getCart().reduce((s, i) => s + i.price * i.qty, 0);
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
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function updateCartBadge() {
  const badge = document.getElementById("cart-badge");
  if (badge) badge.textContent = cartCount();
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error("API error: " + path);
  return res.json();
}

function renderHeader(settings) {
  const header = document.getElementById("site-header");
  if (!header) return;
  header.innerHTML = `
    <div class="topbar">
      <div class="container">
        <span>مرحباً بك في متجر ${settings.storeName || "القبس"} 👋</span>
        <span>📞 ${settings.phone || ""} | ${settings.address || ""}</span>
      </div>
    </div>
    <div class="header-inner container">
      <a class="logo" href="/index.html">
        <img src="/images/logo.svg" alt="القبس" />
        <span>${settings.storeName || "القبس"}</span>
      </a>
      <form class="search-box" onsubmit="return doSearch(event)">
        <span>🔍</span>
        <input id="search-input" type="text" placeholder="ابحث عن طابعة، حبر، ورق..." />
      </form>
      <div class="header-actions">
        <a class="icon-link" href="/cart.html">
          🛒 <span>السلة</span>
          <span class="cart-badge" id="cart-badge">0</span>
        </a>
      </div>
    </div>
    <nav class="main-nav">
      <div class="container" id="nav-categories">
        <a href="/index.html">الرئيسية</a>
      </div>
    </nav>
  `;
  updateCartBadge();
}

function renderFooter(settings) {
  const footer = document.getElementById("site-footer");
  if (!footer) return;
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <h4>القبس</h4>
          <p>${settings.about || ""}</p>
        </div>
        <div>
          <h4>📍 موقعنا</h4>
          <p>${settings.address || ""}</p>
        </div>
        <div>
          <h4>سياسات الاستخدام</h4>
          <a href="#">التوصيل</a>
          <a href="#">طرق الدفع</a>
          <a href="#">سياسة الاسترجاع والاستبدال</a>
        </div>
        <div>
          <h4>تواصل معنا</h4>
          <p>📞 ${settings.phone || ""}</p>
        </div>
      </div>
      <div class="footer-bottom">© ${new Date().getFullYear()} القبس — جميع الحقوق محفوظة</div>
    </div>
  `;
}

function doSearch(e) {
  e.preventDefault();
  const q = document.getElementById("search-input").value.trim();
  window.location.href = "/index.html?q=" + encodeURIComponent(q);
  return false;
}

async function loadNavCategories() {
  const nav = document.getElementById("nav-categories");
  if (!nav) return;
  const categories = await api("/api/categories");
  categories
    .sort((a, b) => a.order - b.order)
    .forEach((c) => {
      const a = document.createElement("a");
      a.href = `/index.html?cat=${c.id}`;
      a.textContent = c.name;
      nav.appendChild(a);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await api("/api/settings");
  renderHeader(settings);
  renderFooter(settings);
  await loadNavCategories();
});
