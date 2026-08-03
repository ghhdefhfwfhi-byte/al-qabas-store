// cart.js - cart & checkout page logic

let SETTINGS = {};

function computeShipping(itemCount) {
  if (itemCount <= 1) return SETTINGS.shippingSmall || 0;
  if (itemCount <= 3) return SETTINGS.shippingMedium || 0;
  return SETTINGS.shippingLarge || 0;
}

function renderCart() {
  const cart = getCart();
  const itemsWrap = document.getElementById("cart-items");
  const page = document.getElementById("cart-page");

  if (!cart.length) {
    itemsWrap.innerHTML = `<div class="empty-state">سلتك فارغة 🛒<br/><a href="/index.html">تسوّق الآن</a></div>`;
    document.querySelector(".summary-box").style.display = "none";
    return;
  }
  document.querySelector(".summary-box").style.display = "block";

  itemsWrap.innerHTML = "";
  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="thumb"><img src="${item.image}" alt="${item.name}" /></div>
      <div class="info">
        <div class="name">${item.name}</div>
        <div class="price">${fmtPrice(item.price)}</div>
      </div>
      <div class="qty-row" style="margin:0;">
        <button class="q-minus">−</button>
        <input type="number" min="1" value="${item.qty}" class="q-input" />
        <button class="q-plus">+</button>
      </div>
      <span class="remove">حذف ✕</span>
    `;
    row.querySelector(".q-minus").onclick = () => {
      setQty(item.id, item.qty - 1);
      renderCart();
    };
    row.querySelector(".q-plus").onclick = () => {
      setQty(item.id, item.qty + 1);
      renderCart();
    };
    row.querySelector(".q-input").onchange = (e) => {
      setQty(item.id, Number(e.target.value) || 1);
      renderCart();
    };
    row.querySelector(".remove").onclick = () => {
      removeFromCart(item.id);
      renderCart();
    };
    itemsWrap.appendChild(row);
  });

  const subtotal = cartSubtotal();
  const shipping = computeShipping(cartCount());
  document.getElementById("subtotal").textContent = fmtPrice(subtotal);
  document.getElementById("shipping-fee").textContent = fmtPrice(shipping);
  document.getElementById("grand-total").textContent = fmtPrice(subtotal + shipping);
}

document.getElementById("checkout-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cart = getCart();
  if (!cart.length) return;

  const payload = {
    customerName: document.getElementById("c-name").value.trim(),
    phone: document.getElementById("c-phone").value.trim(),
    address: document.getElementById("c-address").value.trim(),
    items: cart.map((i) => ({
      productId: i.id,
      name: i.name,
      price: i.price,
      qty: i.qty,
    })),
    shipping: computeShipping(cartCount()),
  };

  try {
    const order = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    localStorage.removeItem(CART_KEY);
    document.getElementById("cart-page").innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        ✅ <strong>تم استلام طلبك بنجاح!</strong><br/>
        رقم الطلب: <strong>#${order.id}</strong><br/><br/>
        سيتم التواصل معك قريباً لتأكيد التوصيل.<br/><br/>
        <a href="/index.html">متابعة التسوق</a>
      </div>`;
  } catch (err) {
    showToast("حدث خطأ، حاول مرة أخرى");
  }
});

(async () => {
  SETTINGS = await api("/api/settings");
  renderCart();
})();
