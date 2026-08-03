// product.js - product detail page

async function loadProduct() {
  const id = new URLSearchParams(window.location.search).get("id");
  const wrap = document.getElementById("product-detail");
  if (!id) {
    wrap.innerHTML = `<div class="empty-state">منتج غير موجود</div>`;
    return;
  }
  const [product, brands, categories, allProducts] = await Promise.all([
    api(`/api/products/${id}`).catch(() => null),
    api("/api/brands"),
    api("/api/categories"),
    api("/api/products"),
  ]);

  if (!product) {
    wrap.innerHTML = `<div class="empty-state">هذا المنتج غير متوفر حالياً</div>`;
    return;
  }

  const brand = brands.find((b) => b.id === product.brandId);
  const category = categories.find((c) => c.id === product.categoryId);
  const hasDiscount = product.discountPrice && product.discountPrice < product.price;
  const shownPrice = hasDiscount ? product.discountPrice : product.price;

  document.title = `${product.name} | القبس`;

  wrap.innerHTML = `
    <div class="thumb"><img src="${product.image}" alt="${product.name}" /></div>
    <div>
      <div class="pd-brand">${brand ? brand.name + " • " : ""}${category ? category.name : ""}</div>
      <h1 class="pd-title">${product.name}</h1>
      <div>
        <span class="pd-price">${fmtPrice(shownPrice)}</span>
        ${hasDiscount ? `<span class="pd-old-price">${fmtPrice(product.price)}</span>` : ""}
      </div>
      <p class="pd-desc">${product.description || ""}</p>
      <div class="qty-row">
        <button id="qty-minus">−</button>
        <input id="qty-input" type="number" min="1" value="1" />
        <button id="qty-plus">+</button>
        <span style="color:var(--muted); font-size:13px;">${
          product.stock > 0 ? `متوفر (${product.stock} قطعة)` : "غير متوفر حالياً"
        }</span>
      </div>
      <button class="pd-add-btn" id="add-btn" ${product.stock > 0 ? "" : "disabled"}>
        أضف إلى السلة 🛒
      </button>
    </div>
  `;

  document.getElementById("qty-minus").onclick = () => {
    const el = document.getElementById("qty-input");
    el.value = Math.max(1, Number(el.value) - 1);
  };
  document.getElementById("qty-plus").onclick = () => {
    const el = document.getElementById("qty-input");
    el.value = Number(el.value) + 1;
  };
  document.getElementById("add-btn").onclick = (e) => {
    const qty = Number(document.getElementById("qty-input").value) || 1;
    addToCart(product, qty);
    const btn = e.currentTarget;
    btn.classList.remove("pop");
    void btn.offsetWidth;
    btn.classList.add("pop");
  };

  // related products (same category)
  const brandsById = Object.fromEntries(brands.map((b) => [b.id, b]));
  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const related = allProducts
    .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 4);
  const grid = document.getElementById("related-grid");
  grid.innerHTML = "";
  related.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "product-card reveal";
    card.style.transitionDelay = `${i * 45}ms`;
    const rHasDiscount = p.discountPrice && p.discountPrice < p.price;
    card.innerHTML = `
      <a href="/product.html?id=${p.id}" class="thumb"><img src="${p.image}" alt="${p.name}" /></a>
      <div class="name"><a href="/product.html?id=${p.id}">${p.name}</a></div>
      <div class="price-row"><span class="price">${fmtPrice(
        rHasDiscount ? p.discountPrice : p.price
      )}</span></div>
      <button class="add-cart-btn">أضف للسلة 🛒</button>
    `;
    card.querySelector(".add-cart-btn").addEventListener("click", (e) => {
      addToCart(p, 1);
      const btn = e.currentTarget;
      btn.classList.remove("pop");
      void btn.offsetWidth;
      btn.classList.add("pop");
    });
    grid.appendChild(card);
  });

  initScrollReveal();
}

loadProduct();
