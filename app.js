// Turso HTTPS Endpoint & Token
const TURSO_HTTP_URL = "https://mpmandi-govindaala.aws-ap-south-1.turso.io/v2/pipeline";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk2MTQwMzksImlkIjoiMDFhMGFkNGUtZDEwMS03M2ViLTlhMjEtZDA3MWIyNDU1MmJiIiwia2lkIjoiV0JkNlJ2dHFndUYtOHV1R2tnT0xSWWREU0lCaGVOem8xVy1QNXhBWkNVVSIsInJpZCI6IjdjY2JmYTI2LWNiYTgtNGUxOS04Njc3LWU0YTdlMGVhYTRmMyJ9.rtHnUY5poOSfygQDiQnHUDYNMZXpaMZoqEJnwy6YmIbWeAVdvIZbhfOXLgAPhS4kMEuGWtFL2Smpgo5rt6VXAQ";

// 1. सुपरफास्ट Native Fetch Engine (बिना किसी हैंग के)
async function executeSQL(sql) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000); // 9 sec timeout

  try {
    const response = await fetch(TURSO_HTTP_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${TURSO_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql } },
          { type: "close" }
        ]
      })
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    if (data.results && data.results[0] && data.results[0].type === "ok") {
      const resObj = data.results[0].response.result;
      const cols = resObj.cols.map(c => c.name);
      const rows = resObj.rows.map(row => {
        const item = {};
        row.forEach((cell, idx) => {
          item[cols[idx]] = cell.value !== undefined ? cell.value : null;
        });
        return item;
      });
      return rows;
    } else if (data.results && data.results[0] && data.results[0].type === "error") {
      throw new Error(data.results[0].error.message);
    }
    return [];
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Global App State
let mandisList = [
  { id: 1, name: "शामगढ़", district: "मंदसौर" },
  { id: 2, name: "मंदसौर", district: "मंदसौर" },
  { id: 3, name: "भवानीमंडी", district: "झालावाड़" },
  { id: 4, name: "नीमच", district: "नीमच" },
  { id: 5, name: "रतलाम", district: "रतलाम" },
  { id: 6, name: "कोटा", district: "कोटा" }
];

let cropsList = [
  { id: 1, name_hi: "सोयाबीन", category: "तिलहन" },
  { id: 2, name_hi: "गेहूं", category: "अनाज" },
  { id: 3, name_hi: "लहसुन", category: "मसाला" },
  { id: 4, name_hi: "चना", category: "दलहन" },
  { id: 5, name_hi: "सरसों", category: "तिलहन" },
  { id: 6, name_hi: "प्याज", category: "सब्जी" }
];

let allRatesCache = [];
let activeMandiFilter = "all";
let chartInstance = null;

const globalDate = document.getElementById("globalDate");
if (globalDate) {
  globalDate.value = new Date().toISOString().split("T")[0];
  globalDate.addEventListener("change", () => loadLiveRates());
}

// -------------------------------------------------------------
// 2. Master Data Load
// -------------------------------------------------------------
async function initAppData() {
  populateDropdowns();
  renderMandiPills();

  try {
    const [mRows, cRows] = await Promise.all([
      executeSQL("SELECT id, name, district FROM mandis WHERE is_active = 1 ORDER BY name ASC;"),
      executeSQL("SELECT id, name_hi, category FROM commodities ORDER BY name_hi ASC;")
    ]);

    if (mRows.length > 0) mandisList = mRows;
    if (cRows.length > 0) cropsList = cRows;

    populateDropdowns();
    renderMandiPills();
  } catch (e) {
    console.warn("Using offline master cache:", e.message);
  }

  await loadLiveRates();
  loadMarketNews();
}

function populateDropdowns() {
  const mSelectors = ["opMandi", "traderMandi", "repMandi", "trendMandiSelect"];
  const cSelectors = ["opCrop", "traderCrop", "trendCropSelect"];

  mSelectors.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = mandisList.map(m => `<option value="${m.id}">${m.name} (${m.district || ''})</option>`).join("");
    }
  });

  cSelectors.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = cropsList.map(c => `<option value="${c.id}">${c.name_hi} [${c.category || ''}]</option>`).join("");
    }
  });

  document.getElementById("trendMandiSelect")?.addEventListener("change", () => window.loadTrendData(7));
  document.getElementById("trendCropSelect")?.addEventListener("change", () => window.loadTrendData(7));
}

function renderMandiPills() {
  const bar = document.getElementById("dynamicMandiPills");
  if (!bar) return;

  let html = `<button onclick="window.selectFilter('all')" class="mandi-pill bg-emerald-700 text-white font-bold px-3 py-1 rounded-full shadow-sm whitespace-nowrap" data-id="all">सभी मंडियां</button>`;
  mandisList.forEach(m => {
    html += `<button onclick="window.selectFilter(${m.id})" class="mandi-pill bg-white text-gray-700 px-3 py-1 rounded-full shadow-sm whitespace-nowrap" data-id="${m.id}">${m.name}</button>`;
  });
  bar.innerHTML = html;
}

window.selectFilter = function(id) {
  activeMandiFilter = id;
  document.querySelectorAll(".mandi-pill").forEach(p => {
    if (p.getAttribute("data-id") == id) {
      p.className = "mandi-pill bg-emerald-700 text-white font-bold px-3 py-1 rounded-full shadow-sm whitespace-nowrap";
    } else {
      p.className = "mandi-pill bg-white text-gray-700 px-3 py-1 rounded-full shadow-sm whitespace-nowrap";
    }
  });
  renderRatesCards();
};

// -------------------------------------------------------------
// 3. Home Rates Fetch
// -------------------------------------------------------------
async function loadLiveRates() {
  const container = document.getElementById("homeCardContainer");
  container.innerHTML = `<div class="text-center py-10 text-gray-400 text-xs animate-pulse">डेटा लोड हो रहा है...</div>`;

  try {
    const query = `
      SELECT 
        p.id, p.mandi_id, p.commodity_id, p.source_type, p.firm_name, p.quality_grade,
        p.price_min, p.price_max, p.price_modal, p.arrival_quantity, p.price_date,
        m.name as mandi_name, c.name_hi as crop_name
      FROM price_records p
      JOIN mandis m ON p.mandi_id = m.id
      JOIN commodities c ON p.commodity_id = c.id
      WHERE p.status = 'approved'
      ORDER BY p.id DESC LIMIT 60;
    `;
    const rows = await executeSQL(query);
    allRatesCache = rows;
    renderRatesCards();
  } catch (err) {
    container.innerHTML = `
      <div class="p-4 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">
        <strong>लोड नहीं हो सका:</strong> ${err.message}
        <button onclick="loadLiveRates()" class="mt-2 block w-full bg-red-600 text-white py-1.5 rounded font-bold">पुनः प्रयास करें</button>
      </div>`;
  }
}

function renderRatesCards() {
  const container = document.getElementById("homeCardContainer");
  const searchVal = document.getElementById("mandiSearchInput")?.value.trim().toLowerCase() || "";

  const filtered = allRatesCache.filter(r => {
    const matchMandi = activeMandiFilter === "all" ? true : r.mandi_id == activeMandiFilter;
    const matchSearch = searchVal === "" || 
      (r.crop_name && r.crop_name.toLowerCase().includes(searchVal)) || 
      (r.mandi_name && r.mandi_name.toLowerCase().includes(searchVal)) ||
      (r.firm_name && r.firm_name.toLowerCase().includes(searchVal));
    return matchMandi && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-white p-8 rounded-xl text-center shadow-sm">
        <span class="text-3xl">🌾</span>
        <p class="text-gray-600 font-bold text-xs mt-2">कोई भाव उपलब्ध नहीं है</p>
        <p class="text-gray-400 text-[11px] mt-1">नीचे 'एंट्री पैनल' से नया भाव दर्ज करें</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(r => `
    <div class="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100">
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="text-base font-bold text-gray-900 leading-tight">${r.crop_name}</h3>
          <p class="text-xs text-emerald-700 font-medium">📍 ${r.mandi_name} मंडी | आवक: ${r.arrival_quantity || '0'} बोरी</p>
          ${r.firm_name ? `<p class="text-[11px] text-blue-800 font-semibold mt-0.5">🏪 ${r.firm_name} (${r.quality_grade || 'कोटेशन'})</p>` : ''}
        </div>
        <div class="text-right">
          <span class="text-[9px] px-2 py-0.5 rounded-full font-bold ${r.source_type === 'MANDI_OPERATOR' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
            ${r.source_type === 'MANDI_OPERATOR' ? 'सरकारी नीलामी' : 'व्यापारी खरीद'}
          </span>
          <span class="text-[9px] text-gray-400 block mt-1">${r.price_date || ''}</span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-1.5 bg-gray-50 p-2 rounded-lg text-center">
        <div>
          <span class="text-[9px] text-gray-400 block">न्यूनतम</span>
          <span class="text-xs font-bold text-gray-700">₹${r.price_min}</span>
        </div>
        <div class="border-x border-gray-200">
          <span class="text-[9px] text-emerald-700 font-bold block">मॉडल (औसत)</span>
          <span class="text-sm font-extrabold text-emerald-700">₹${r.price_modal || r.price_min}</span>
        </div>
        <div>
          <span class="text-[9px] text-gray-400 block">अधिकतम</span>
          <span class="text-xs font-bold text-gray-700">₹${r.price_max}</span>
        </div>
      </div>
    </div>
  `).join("");
}

document.getElementById("mandiSearchInput")?.addEventListener("input", renderRatesCards);

// -------------------------------------------------------------
// 4. Trend & Graph Engine
// -------------------------------------------------------------
window.loadTrendData = async function(days = 7) {
  const mandiId = document.getElementById("trendMandiSelect")?.value;
  const cropId = document.getElementById("trendCropSelect")?.value;
  if (!mandiId || !cropId) return;

  document.querySelectorAll(".trend-btn").forEach(btn => {
    if (btn.getAttribute("onclick")?.includes(`(${days})`)) {
      btn.className = "trend-btn bg-emerald-700 text-white px-3 py-1 rounded-md font-bold";
    } else {
      btn.className = "trend-btn bg-gray-100 text-gray-700 px-3 py-1 rounded-md font-medium";
    }
  });

  try {
    const query = `
      SELECT price_date, price_min, price_modal, price_max, arrival_quantity 
      FROM price_records 
      WHERE mandi_id = ${mandiId} AND commodity_id = ${cropId}
      ORDER BY price_date DESC LIMIT ${days};
    `;
    const rawRows = await executeSQL(query);
    const rows = [...rawRows].reverse();

    const labels = rows.map(r => String(r.price_date).slice(5));
    const values = rows.map(r => r.price_modal || r.price_min);

    const ctx = document.getElementById("trendCanvas")?.getContext("2d");
    if (chartInstance) chartInstance.destroy();

    if (window.Chart && ctx) {
      chartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels.length ? labels : ["डेटा नहीं"],
          datasets: [{
            label: "मॉडल भाव (₹)",
            data: values.length ? values : [0],
            borderColor: "#047857",
            backgroundColor: "rgba(4, 120, 87, 0.1)",
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: "#047857"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: "#f3f4f6" } }
          }
        }
      });
    }

    const tbody = document.getElementById("historyTableBody");
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-gray-400">कोई पुराना रिकॉर्ड नहीं मिला</td></tr>`;
    } else {
      tbody.innerHTML = [...rows].reverse().map(r => `
        <tr class="hover:bg-gray-50">
          <td class="p-2 font-medium">${r.price_date}</td>
          <td class="p-2 text-gray-600">₹${r.price_min}</td>
          <td class="p-2 font-bold text-emerald-700">₹${r.price_modal || '-'}</td>
          <td class="p-2 text-gray-600">₹${r.price_max}</td>
          <td class="p-2 text-gray-500">${r.arrival_quantity || '0'}</td>
        </tr>
      `).join("");
    }
  } catch (err) {
    console.error("Trend Query Error:", err);
  }
};

// -------------------------------------------------------------
// 5. Market News Engine
// -------------------------------------------------------------
async function loadMarketNews() {
  const container = document.getElementById("newsContainer");
  try {
    const rows = await executeSQL(`
      SELECT n.*, m.name as mandi_name 
      FROM market_news n 
      JOIN mandis m ON n.mandi_id = m.id 
      ORDER BY n.id DESC LIMIT 30;
    `);

    if (!rows || rows.length === 0) {
      container.innerHTML = `<div class="bg-white p-6 rounded-xl text-center text-xs text-gray-400">अभी कोई समाचार उपलब्ध नहीं है।</div>`;
      return;
    }

    container.innerHTML = rows.map(n => `
      <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div class="flex justify-between items-start mb-1">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded ${n.sentiment === 'तेजी' ? 'bg-green-100 text-green-800' : n.sentiment === 'मंदी' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}">
            ${n.sentiment}
          </span>
          <span class="text-[10px] text-gray-400">📍 ${n.mandi_name} | ${String(n.created_at).slice(0, 10)}</span>
        </div>
        <h3 class="font-bold text-sm text-gray-900 mt-1">${n.title}</h3>
        <p class="text-xs text-gray-600 mt-1 leading-relaxed">${n.report_text}</p>
        <p class="text-[10px] text-gray-400 mt-2 text-right">रिपोर्टर: <strong class="text-gray-600">${n.reporter_name}</strong></p>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-red-500">न्यूज़ लोड नहीं हो सकी</div>`;
  }
}

// -------------------------------------------------------------
// 6. Submissions (Operator, Trader, Reporter, Master)
// -------------------------------------------------------------
window.submitOperatorRate = async function(e) {
  e.preventDefault();
  const mId = document.getElementById("opMandi").value;
  const cId = document.getElementById("opCrop").value;
  const pMin = document.getElementById("opMin").value;
  const pModal = document.getElementById("opModal").value;
  const pMax = document.getElementById("opMax").value;
  const arr = document.getElementById("opArrival").value || 0;
  const dateVal = globalDate.value;

  try {
    await executeSQL(`
      INSERT INTO price_records (mandi_id, commodity_id, source_type, price_min, price_max, price_modal, arrival_quantity, price_date, status)
      VALUES (${mId}, ${cId}, 'MANDI_OPERATOR', ${pMin}, ${pMax}, ${pModal}, ${arr}, '${dateVal}', 'approved');
    `);
    alert("✅ मंडी नीलामी भाव दर्ज हो गया!");
    document.getElementById("operatorForm").reset();
    window.switchTab("view-home");
    loadLiveRates();
  } catch (err) {
    alert("त्रुटि: " + err.message);
  }
};

window.submitTraderRate = async function(e) {
  e.preventDefault();
  const firm = document.getElementById("traderFirm").value;
  const mId = document.getElementById("traderMandi").value;
  const cId = document.getElementById("traderCrop").value;
  const qGrade = document.getElementById("traderQuality").value;
  const pMin = document.getElementById("traderMin").value;
  const pMax = document.getElementById("traderMax").value;
  const pModal = (parseFloat(pMin) + parseFloat(pMax)) / 2;
  const dateVal = globalDate.value;

  try {
    await executeSQL(`
      INSERT INTO price_records (mandi_id, commodity_id, source_type, firm_name, quality_grade, price_min, price_max, price_modal, price_date, status)
      VALUES (${mId}, ${cId}, 'TRADER', '${firm}', '${qGrade}', ${pMin}, ${pMax}, ${pModal}, '${dateVal}', 'approved');
    `);
    alert("✅ व्यापारी खरीद भाव दर्ज हो गया!");
    document.getElementById("traderForm").reset();
    window.switchTab("view-home");
    loadLiveRates();
  } catch (err) {
    alert("त्रुटि: " + err.message);
  }
};

window.submitNewsReport = async function(e) {
  e.preventDefault();
  const rep = document.getElementById("repName").value;
  const mId = document.getElementById("repMandi").value;
  const sent = document.getElementById("repSentiment").value;
  const title = document.getElementById("repTitle").value;
  const content = document.getElementById("repContent").value;

  try {
    await executeSQL(`
      INSERT INTO market_news (mandi_id, title, report_text, reporter_name, sentiment)
      VALUES (${mId}, '${title}', '${content}', '${rep}', '${sent}');
    `);
    alert("✅ समाचार प्रकाशित हो गया!");
    document.getElementById("reporterForm").reset();
    window.switchTab("view-news");
    loadMarketNews();
  } catch (err) {
    alert("त्रुटि: " + err.message);
  }
};

window.addNewMandi = async function(e) {
  e.preventDefault();
  const name = document.getElementById("newMandiName").value.trim();
  const dist = document.getElementById("newMandiDistrict").value.trim();
  try {
    await executeSQL(`INSERT INTO mandis (name, district) VALUES ('${name}', '${dist}');`);
    alert(`✅ मंडी '${name}' जुड़ गई!`);
    document.getElementById("newMandiName").value = "";
    document.getElementById("newMandiDistrict").value = "";
    initAppData();
  } catch (err) {
    alert("त्रुटि: " + err.message);
  }
};

window.addNewCommodity = async function(e) {
  e.preventDefault();
  const name = document.getElementById("newCropName").value.trim();
  const cat = document.getElementById("newCropCat").value;
  try {
    await executeSQL(`INSERT INTO commodities (name_hi, category) VALUES ('${name}', '${cat}');`);
    alert(`✅ फसल '${name}' जुड़ गई!`);
    document.getElementById("newCropName").value = "";
    initAppData();
  } catch (err) {
    alert("त्रुटि: " + err.message);
  }
};

// -------------------------------------------------------------
// 7. Navigation Tabs
// -------------------------------------------------------------
window.switchTab = function(viewId) {
  document.querySelectorAll(".page-view").forEach(el => el.classList.add("hidden"));
  document.getElementById(viewId)?.classList.remove("hidden");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.remove("text-emerald-800");
    btn.classList.add("text-gray-400");
    btn.querySelector("span:last-child").classList.remove("font-bold");
  });

  const activeBtn = document.getElementById("tab-btn-" + viewId.replace("view-", ""));
  if (activeBtn) {
    activeBtn.classList.add("text-emerald-800");
    activeBtn.classList.remove("text-gray-400");
    activeBtn.querySelector("span:last-child").classList.add("font-bold");
  }

  const searchSec = document.getElementById("searchSection");
  if (viewId === "view-home") {
    searchSec?.classList.remove("hidden");
  } else {
    searchSec?.classList.add("hidden");
  }

  if (viewId === "view-trend") window.loadTrendData(7);
  if (viewId === "view-news") loadMarketNews();
};

window.switchEntryPanel = function(type) {
  document.querySelectorAll(".entry-subpanel").forEach(el => el.classList.add("hidden"));
  document.getElementById(`subpanel-${type}`)?.classList.remove("hidden");

  ['operator', 'trader', 'reporter', 'master'].forEach(t => {
    const btn = document.getElementById(`p-tab-${t}`);
    if (t === type) {
      btn.className = "flex-1 py-1.5 rounded-lg bg-white text-emerald-800 shadow-sm text-center font-bold";
    } else {
      btn.className = "flex-1 py-1.5 rounded-lg text-center font-medium text-gray-600";
    }
  });
};

// Start
initAppData();
