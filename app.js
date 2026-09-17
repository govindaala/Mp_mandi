import { createClient } from "https://esm.sh/@libsql/client/web";

const TURSO_URL = "libsql://mpmandi-govindaala.aws-ap-south-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk2MTQwMzksImlkIjoiMDFhMGFkNGUtZDEwMS03M2ViLTlhMjEtZDA3MWIyNDU1MmJiIiwia2lkIjoiV0JkNlJ2dHFndUYtOHV1R2tnT0xSWWREU0lCaGVOem8xVy1QNXhBWkNVVSIsInJpZCI6IjdjY2JmYTI2LWNiYTgtNGUxOS04Njc3LWU0YTdlMGVhYTRmMyJ9.rtHnUY5poOSfygQDiQnHUDYNMZXpaMZoqEJnwy6YmIbWeAVdvIZbhfOXLgAPhS4kMEuGWtFL2Smpgo5rt6VXAQ";

const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

let allRatesCache = [];
let selectedMandiId = null;
let chartInstance = null;

// आज की तारीख सेट करें
const todayISO = new Date().toISOString().split("T")[0];
const dateFilterInput = document.getElementById("dateFilter");
if (dateFilterInput) {
  dateFilterInput.value = todayISO;
  dateFilterInput.addEventListener("change", () => loadRates(selectedMandiId));
}

// 1. डेटा लोड करना
export async function loadRates(mandiId = null) {
  const container = document.getElementById("ratesContainer");
  container.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm animate-pulse">डेटा लोड हो रहा है...</div>`;

  try {
    const chosenDate = dateFilterInput ? dateFilterInput.value : todayISO;
    let query = `
      SELECT 
        p.id, 
        p.mandi_id,
        p.commodity_id,
        m.name as mandi_name, 
        c.name_hi as crop_name, 
        p.price_min, 
        p.price_max, 
        p.price_modal, 
        p.arrival_quantity, 
        p.source_type,
        p.price_date
      FROM price_records p
      JOIN mandis m ON p.mandi_id = m.id
      JOIN commodities c ON p.commodity_id = c.id
      WHERE p.status = 'approved'
      ORDER BY p.id DESC LIMIT 100;
    `;

    const res = await db.execute(query);
    allRatesCache = res.rows || [];
    renderCards(filterRows(allRatesCache, mandiId));
  } catch (err) {
    container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">एरर: ${err.message}</div>`;
  }
}

// सर्च और फिल्टर
function filterRows(rows, mandiId) {
  const searchVal = document.getElementById("searchInput")?.value.trim().toLowerCase() || "";
  return rows.filter(r => {
    const matchMandi = mandiId ? r.mandi_id == mandiId : true;
    const matchSearch = searchVal === "" || 
      r.crop_name.toLowerCase().includes(searchVal) || 
      r.mandi_name.toLowerCase().includes(searchVal);
    return matchMandi && matchSearch;
  });
}

// कार्ड्स रेंडर करना
function renderCards(rows) {
  const container = document.getElementById("ratesContainer");
  if (!rows || rows.length === 0) {
    container.innerHTML = `
      <div class="bg-white p-8 rounded-2xl text-center shadow-sm border border-gray-100 mt-2">
        <span class="text-4xl">📭</span>
        <p class="text-gray-500 font-medium text-sm mt-2">कोई भाव उपलब्ध नहीं है</p>
        <p class="text-gray-400 text-xs mt-1">अन्य मंडी या तारीख चुनकर देखें</p>
      </div>`;
    return;
  }

  container.innerHTML = rows.map(r => `
    <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition">
      <div class="flex justify-between items-start mb-3">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-bold text-gray-900">${r.crop_name}</h2>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${r.source_type === 'GOVT_MANDI' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
              ${r.source_type === 'GOVT_MANDI' ? 'सरकारी नीलामी' : 'व्यापारी भाव'}
            </span>
          </div>
          <p class="text-xs text-gray-500 font-medium mt-0.5">
            📍 ${r.mandi_name} मंडी | आवक: <strong class="text-gray-700">${r.arrival_quantity || '0'} बोरी</strong>
          </p>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2 bg-emerald-50/50 p-2.5 rounded-xl text-center border border-emerald-100">
        <div>
          <span class="text-[10px] text-gray-500 font-medium block">न्यूनतम</span>
          <span class="text-sm font-bold text-gray-700">₹${r.price_min}</span>
        </div>
        <div class="border-x border-emerald-200">
          <span class="text-[10px] text-emerald-700 font-bold block">मॉडल (औसत)</span>
          <span class="text-base font-extrabold text-emerald-700">₹${r.price_modal || '-'}</span>
        </div>
        <div>
          <span class="text-[10px] text-gray-500 font-medium block">अधिकतम</span>
          <span class="text-sm font-bold text-gray-700">₹${r.price_max}</span>
        </div>
      </div>
    </div>
  `).join("");
}

// 2. टैब स्विचिंग
window.switchTab = function(tabName) {
  const tabs = ['home', 'compare', 'trend', 'entry'];
  tabs.forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.add("hidden");
    const btn = document.getElementById(`nav-${t}`);
    if (btn) {
      btn.classList.remove("text-emerald-700");
      btn.classList.add("text-gray-400");
    }
  });

  document.getElementById(`tab-${tabName}`)?.classList.remove("hidden");
  const activeBtn = document.getElementById(`nav-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove("text-gray-400");
    activeBtn.classList.add("text-emerald-700");
  }

  const searchBox = document.getElementById("searchContainer");
  const filterPills = document.getElementById("filterPills");
  if (tabName === 'home') {
    searchBox?.classList.remove("hidden");
    filterPills?.classList.remove("hidden");
  } else {
    searchBox?.classList.add("hidden");
    filterPills?.classList.add("hidden");
  }

  if (tabName === 'trend') renderTrendChart();
  if (tabName === 'compare') runComparison();
};

// 3. मंडी फिल्टर चिप्स
window.setMandiFilter = function(id) {
  selectedMandiId = id;
  const pills = document.querySelectorAll(".filter-pill");
  pills.forEach((p, index) => {
    if ((id === null && index === 0) || (id !== null && p.getAttribute("onclick")?.includes(`(${id})`))) {
      p.className = "filter-pill bg-white text-emerald-900 font-bold px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap";
    } else {
      p.className = "filter-pill bg-emerald-800 text-white px-3 py-1.5 rounded-full whitespace-nowrap";
    }
  });
  renderCards(filterRows(allRatesCache, selectedMandiId));
};

// सर्च इनपुट लिसनर
document.getElementById("searchInput")?.addEventListener("input", () => {
  renderCards(filterRows(allRatesCache, selectedMandiId));
});

// 4. तुलना फंक्शन (Comparison Logic)
window.runComparison = function() {
  const cropId = document.getElementById("compareCrop").value;
  const m1 = document.getElementById("compareMandi1").value;
  const m2 = document.getElementById("compareMandi2").value;

  const r1 = allRatesCache.find(r => r.commodity_id == cropId && r.mandi_id == m1);
  const r2 = allRatesCache.find(r => r.commodity_id == cropId && r.mandi_id == m2);

  const container = document.getElementById("compareResult");

  container.innerHTML = `
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-white p-4 rounded-xl border border-gray-200 text-center">
        <h3 class="font-bold text-gray-800 text-sm mb-2">${r1 ? r1.mandi_name : 'मंडी 1'}</h3>
        ${r1 ? `
          <p class="text-xs text-emerald-700 font-bold text-lg">₹${r1.price_modal}</p>
          <p class="text-[11px] text-gray-500 mt-1">रेंज: ₹${r1.price_min} - ₹${r1.price_max}</p>
          <p class="text-[11px] text-gray-400 mt-1">आवक: ${r1.arrival_quantity} बोरी</p>
        ` : `<p class="text-xs text-gray-400 py-4">डेटा उपलब्ध नहीं</p>`}
      </div>

      <div class="bg-white p-4 rounded-xl border border-gray-200 text-center">
        <h3 class="font-bold text-gray-800 text-sm mb-2">${r2 ? r2.mandi_name : 'मंडी 2'}</h3>
        ${r2 ? `
          <p class="text-xs text-emerald-700 font-bold text-lg">₹${r2.price_modal}</p>
          <p class="text-[11px] text-gray-500 mt-1">रेंज: ₹${r2.price_min} - ₹${r2.price_max}</p>
          <p class="text-[11px] text-gray-400 mt-1">आवक: ${r2.arrival_quantity} बोरी</p>
        ` : `<p class="text-xs text-gray-400 py-4">डेटा उपलब्ध नहीं</p>`}
      </div>
    </div>
  `;
};

// 5. ट्रेंड और ग्राफ (Chart.js)
window.renderTrendChart = function() {
  const ctx = document.getElementById('priceChart')?.getContext('2d');
  if (!ctx) return;

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['11 सित', '12 सित', '13 सित', '14 सित', '15 सित', '16 सित', '17 सित'],
      datasets: [{
        label: 'मॉडल भाव (₹/क्विंटल)',
        data: [4500, 4550, 4520, 4600, 4680, 4650, 4720],
        borderColor: '#047857',
        backgroundColor: 'rgba(4, 120, 87, 0.1)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#047857'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: '#f3f4f6' } },
        x: { grid: { display: false } }
      }
    }
  });
};

window.updateChart = () => renderTrendChart();

// 6. भाव प्रविष्टि (Submit to Turso)
window.submitNewRate = async function(e) {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.innerText = "दर्ज हो रहा है...";

  const mandi_id = document.getElementById("formMandi").value;
  const commodity_id = document.getElementById("formCommodity").value;
  const source_type = document.getElementById("formSource").value;
  const price_min = parseFloat(document.getElementById("formMin").value);
  const price_modal = parseFloat(document.getElementById("formModal").value);
  const price_max = parseFloat(document.getElementById("formMax").value);
  const arrival = parseFloat(document.getElementById("formArrival").value) || 0;

  try {
    const insertSQL = `
      INSERT INTO price_records 
      (mandi_id, commodity_id, source_type, price_min, price_max, price_modal, arrival_quantity, price_date, status)
      VALUES (${mandi_id}, ${commodity_id}, '${source_type}', ${price_min}, ${price_max}, ${price_modal}, ${arrival}, DATE('now'), 'approved');
    `;
    await db.execute(insertSQL);

    alert("✅ भाव सफलतापूर्वक दर्ज हो गया!");
    document.getElementById("entryForm").reset();
    switchTab('home');
    loadRates();
  } catch (err) {
    alert("त्रुटि: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "भाव दर्ज करें (Submit)";
  }
};

// शुरुआती लोड
loadRates();
