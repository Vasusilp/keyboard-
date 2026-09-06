/* ============================================================
   Ckeyboard — shared script.js
   Used across product.html, order.html and admin.html
   ============================================================ */

/* ------------------------------------------------------------
   ⚠️ CONFIG — replace these two with your own links
   (see ขั้นที่ 3 ในคู่มือ: Google Sheet + Apps Script)
   ------------------------------------------------------------ */
const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
const ORDERS_CSV_URL  = "PASTE_YOUR_PUBLISHED_SHEET_CSV_LINK_HERE";

/* ------------------------------------------------------------
   Category metadata: badge color + icon reused everywhere
   ------------------------------------------------------------ */
const CATEGORY_META = {
  mechanical: {
    label: "Mechanical",
    icon: `<svg viewBox="0 0 46 46" fill="none"><rect x="6" y="6" width="34" height="34" rx="6" stroke="#00fff2" stroke-width="2"/><rect x="16" y="16" width="14" height="14" rx="2" fill="#00fff2" fill-opacity="0.85"/></svg>`
  },
  magnetic: {
    label: "Magnetic",
    icon: `<svg viewBox="0 0 46 46" fill="none"><circle cx="23" cy="23" r="17" stroke="#b026ff" stroke-width="2"/><path d="M23 12v22M12 23h22" stroke="#b026ff" stroke-width="2"/></svg>`
  },
  switches: {
    label: "Switches",
    icon: `<svg viewBox="0 0 46 46" fill="none"><rect x="14" y="6" width="18" height="34" rx="4" stroke="#39ff14" stroke-width="2"/><rect x="19" y="14" width="8" height="8" fill="#39ff14" fill-opacity="0.85"/></svg>`
  }
};

function formatBaht(n) {
  return "฿" + Number(n).toLocaleString("th-TH");
}

/* ============================================================
   PRODUCT.HTML — grid + category filter
   Element ids used: #productGrid, #filterTabs (buttons with
   data-filter="all|mechanical|magnetic|switches")
   ============================================================ */
async function initProductGrid() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  let products = [];
  try {
    const res = await fetch("products.json");
    products = await res.json();
  } catch (err) {
    grid.innerHTML = `<p style="color:#8d8d99">โหลดรายการสินค้าไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>`;
    return;
  }

  function render(filter) {
    const list = filter === "all" ? products : products.filter(p => p.category === filter);
    grid.innerHTML = list.map(p => {
      const meta = CATEGORY_META[p.category];
      const media = p.image
        ? `<img src="${p.image}" alt="${p.name}" loading="lazy">`
        : meta.icon;
      return `
        <div class="p-card ${p.category}" data-cat="${p.category}">
          <div class="p-media">
            <span class="p-badge">${meta.label}</span>
            ${media}
          </div>
          <div class="p-body">
            <h4>${p.name}</h4>
            <p class="desc">${p.description}</p>
            <div class="p-foot">
              <span class="p-price">${formatBaht(p.price)}</span>
              <button class="p-order" data-name="${p.name}" data-price="${p.price}">สั่งซื้อ</button>
            </div>
          </div>
        </div>`;
    }).join("");

    grid.querySelectorAll(".p-order").forEach(btn => {
      btn.addEventListener("click", () => {
        const params = new URLSearchParams({
          item: btn.dataset.name,
          price: btn.dataset.price
        });
        window.location.href = `order.html?${params.toString()}`;
      });
    });
  }

  render("all");

  const tabs = document.querySelectorAll("#filterTabs .filter-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      render(tab.dataset.filter);
    });
  });
}

/* ============================================================
   ORDER.HTML — auto-fill from URL params + submit to Apps Script
   Element ids used: #orderForm, #itemName, #itemPrice,
   #orderTotal, #customerName, #customerContact, #orderNote,
   #formStatus
   ============================================================ */
function initOrderForm() {
  const form = document.getElementById("orderForm");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const item = params.get("item") || "";
  const price = Number(params.get("price") || 0);

  const itemNameEl = document.getElementById("itemName");
  const itemPriceEl = document.getElementById("itemPrice");
  const orderTotalEl = document.getElementById("orderTotal");

  if (itemNameEl) itemNameEl.value = item;
  if (itemPriceEl) itemPriceEl.value = price ? formatBaht(price) : "";
  if (orderTotalEl) orderTotalEl.textContent = price ? formatBaht(price) : "-";

  const statusEl = document.getElementById("formStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      name: document.getElementById("customerName").value.trim(),
      contact: document.getElementById("customerContact").value.trim(),
      items: item,
      total: price,
      note: document.getElementById("orderNote").value.trim()
    };

    if (!payload.name || !payload.contact) {
      if (statusEl) {
        statusEl.textContent = "กรุณากรอกชื่อและช่องทางติดต่อให้ครบ";
        statusEl.className = "form-status error";
      }
      return;
    }

    if (APPS_SCRIPT_URL.startsWith("PASTE_")) {
      if (statusEl) {
        statusEl.textContent = "ยังไม่ได้ตั้งค่า Apps Script URL — ดูขั้นที่ 3 ในคู่มือแล้วแก้ APPS_SCRIPT_URL ใน script.js";
        statusEl.className = "form-status error";
      }
      return;
    }

    if (statusEl) {
      statusEl.textContent = "กำลังส่งคำสั่งซื้อ...";
      statusEl.className = "form-status";
    }

    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload)
        // ห้ามตั้ง header Content-Type และห้ามใช้ mode: 'no-cors'
      });

      if (!res.ok) throw new Error("ส่งข้อมูลไม่สำเร็จ");

      window.location.href = "thankyou.html";
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = "เกิดข้อผิดพลาด: " + err.message;
        statusEl.className = "form-status error";
      }
    }
  });
}

/* ============================================================
   ADMIN.HTML — read published CSV and render as a table
   Element ids used: #adminTable (a <tbody>), #adminStatus,
   #adminHead (a <tr> in <thead>)
   ============================================================ */
function parseCSV(text) {
  return text
    .trim()
    .split("\n")
    .map(row => row.split(",").map(cell => cell.replace(/^"|"$/g, "").trim()));
}

async function initAdminTable() {
  const tbody = document.getElementById("adminTable");
  const statusEl = document.getElementById("adminStatus");
  const headRow = document.getElementById("adminHead");
  if (!tbody) return;

  if (ORDERS_CSV_URL.startsWith("PASTE_")) {
    if (statusEl) statusEl.textContent = "ยังไม่ได้ตั้งค่าลิงก์ CSV — ดูขั้นที่ 3.3 ในคู่มือแล้วแก้ ORDERS_CSV_URL ใน script.js";
    return;
  }

  try {
    if (statusEl) statusEl.textContent = "กำลังโหลดข้อมูลออเดอร์...";
    const res = await fetch(ORDERS_CSV_URL);
    const text = await res.text();
    const rows = parseCSV(text);

    const header = rows[0];
    const dataRows = rows.slice(1).reverse(); // ล่าสุดขึ้นก่อน

    if (headRow) {
      headRow.innerHTML = header.map(h => `<th>${h}</th>`).join("");
    }

    tbody.innerHTML = dataRows.map(row =>
      `<tr>${row.map(cell => `<td>${cell || "-"}</td>`).join("")}</tr>`
    ).join("");

    if (statusEl) statusEl.textContent = `ทั้งหมด ${dataRows.length} ออเดอร์`;
  } catch (err) {
    if (statusEl) statusEl.textContent = "โหลดข้อมูลไม่สำเร็จ: " + err.message;
  }
}

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initProductGrid();
  initOrderForm();
  initAdminTable();
});
