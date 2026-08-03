// store.js - home page logic (hero slider, categories, product grid + filters)

function productCard(p, categoriesById, brandsById) {
  const brand = p.brandId ? brandsById[p.brandId]?.name : "";
  const hasDiscount = p.discountPrice && p.discountPrice < p.price;
  const shownPrice = hasDiscount ? p.discountPrice : p.price;
  const pct = hasDiscount
    ? Math.round(100 - (p.discountPrice / p.price) * 100)
    : 0;

  const card = document.createElement("div");
  card.className = "product-card";
  card.innerHTML = `
    ${hasDiscount ? `<span class="discount-badge">خصم ${pct}%</span>` : ""}
    <span class="wish-btn">♡</span>
    <a href="/product.html?id=${p.id}" class="thumb">
      <img src="${p.image}" alt="${p.name}" />
    </a>
    <div class="brand-tag">${brand || ""}</div>
    <a href="/product.html?id=${p.id}" class="name">${p.name}</a>
    <div class="price-row">
      <span class="price">${fmtPrice(shownPrice)}</span>
      ${hasDiscount ? `<span class="old-price">${fmtPrice(p.price)}</span>` : ""}
    </div>
    <button class="add-cart-btn">أضف للسلة 🛒</button>
  `;
  card.querySelector(".add-cart-btn").addEventListener("click", () =>
    addToCart(p, 1)
  );
  return card;
}

async function renderHero() {
  const banners = (await api("/api/banners")).filter(
    (b) => b.active && b.type === "Slider"
  ).sort((a, b) => a.order - b.order);
  const slider = document.getElementById("hero-slider");
  if (!banners.length) return;

  slider.innerHTML =
    banners
      .map(
        (b, i) => `
      <div class="hero-slide ${i === 0 ? "active" : ""}" data-i="${i}">
        <img src="${b.image}" alt="${b.title}" />
      </div>`
      )
      .join("") +
    `<div class="hero-dots">${banners
      .map(
        (b, i) =>
          `<span class="${i === 0 ? "active" : ""}" data-i="${i}"></span>`
      )
      .join("")}</div>`;

  let idx = 0;
  const slides = slider.querySelectorAll(".hero-slide");
  const dots = slider.querySelectorAll(".hero-dots span");
  function show(i) {
    slides.forEach((s) => s.classList.remove("active"));
    dots.forEach((d) => d.classList.remove("active"));
    slides[i].classList.add("active");
    dots[i].classList.add("active");
    idx = i;
  }
  dots.forEach((d) =>
    d.addEventListener("click", () => show(Number(d.dataset.i)))
  );
  setInterval(() => show((idx + 1) % slides.length), 4500);
}

async function renderCategoryStrip(categories) {
  const wrap = document.getElementById("category-icons");
  wrap.innerHTML = "";
  wrap.style.display = "flex";
  wrap.style.gap = "26px";
  wrap.style.overflowX = "auto";
  categories
    .sort((a, b) => a.order - b.order)
    .forEach((c) => {
      const a = document.createElement("a");
      a.className = "cat-item";
      a.href = `/index.html?cat=${c.id}`;
      a.innerHTML = `<span class="cat-icon">${c.icon}</span><span>${c.name}</span>`;
      wrap.appendChild(a);
    });
}

async function renderProducts() {
  const params = new URLSearchParams(window.location.search);
  const catId = params.get("cat");
  const q = (params.get("q") || "").trim().toLowerCase();

  const [products, categories, brands] = await Promise.all([
    api("/api/products"),
    api("/api/categories"),
    api("/api/brands"),
  ]);
  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const brandsById = Object.fromEntries(brands.map((b) => [b.id, b]));

  let list = products.filter((p) => p.active !== false);
  const title = document.getElementById("products-title");
  const clearBtn = document.getElementById("clear-filter");

  if (catId) {
    list = list.filter((p) => String(p.categoryId) === String(catId));
    title.textContent = categoriesById[catId]
      ? categoriesById[catId].name
      : "المنتجات";
    clearBtn.style.display = "inline";
  } else if (q) {
    list = list.filter((p) => p.name.toLowerCase().includes(q));
    title.textContent = `نتائج البحث عن: "${q}"`;
    clearBtn.style.display = "inline";
  } else {
    title.textContent = "جميع المنتجات";
    clearBtn.style.display = "none";
  }

  clearBtn.onclick = () => (window.location.href = "/index.html");

  const grid = document.getElementById("product-grid");
  grid.innerHTML = "";
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state">لا توجد منتجات مطابقة 🙁</div>`;
    return;
  }
  list.forEach((p) => grid.appendChild(productCard(p, categoriesById, brandsById)));

  renderCategoryStrip(categories);
}

renderHero();
renderProducts();
