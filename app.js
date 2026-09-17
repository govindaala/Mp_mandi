import { createClient } from "https://esm.sh/@libsql/client/web";

// Turso Database Credentials
const TURSO_URL = "libsql://mpmandi-govindaala.aws-ap-south-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk2MTQwMzksImlkIjoiMDFhMGFkNGUtZDEwMS03M2ViLTlhMjEtZDA3MWIyNDU1MmJiIiwia2lkIjoiV0JkNlJ2dHFndUYtOHV1R2tnT0xSWWREU0lCaGVOem8xVy1QNXhBWkNVVSIsInJpZCI6IjdjY2JmYTI2LWNiYTgtNGUxOS04Njc3LWU0YTdlMGVhYTRmMyJ9.rtHnUY5poOSfygQDiQnHUDYNMZXpaMZoqEJnwy6YmIbWeAVdvIZbhfOXLgAPhS4kMEuGWtFL2Smpgo5rt6VXAQ";

// Turso Client Init
const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

const container = document.getElementById("ratesContainer");
const dateElement = document.getElementById("currentDate");

if (dateElement) {
  dateElement.innerText = new Date().toLocaleDateString("hi-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// मंडी भाव लोड करने का मुख्य फंक्शन
export async function loadRates(mandiId = null) {
  if (!container) return;
  container.innerHTML = `<div class="text-center py-8 text-gray-500 font-medium">डेटा लोड हो रहा है...</div>`;

  try {
    let query = `
      SELECT 
        p.id, 
        m.name as mandi_name, 
        c.name_hi as crop_name, 
        p.price_min, 
        p.price_max, 
        p.price_modal, 
        p.arrival_quantity, 
        p.source_type
      FROM price_records p
      JOIN mandis m ON p.mandi_id = m.id
      JOIN commodities c ON p.commodity_id = c.id
      WHERE p.status = 'approved'
    `;

    if (mandiId) {
      query += ` AND p.mandi_id = ${mandiId}`;
    }
    query += ` ORDER BY p.id DESC LIMIT 50;`;

    const res = await db.execute(query);

    if (!res.rows || res.rows.length === 0) {
      container.innerHTML = `
        <div class="p-6 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          आज का कोई भाव दर्ज नहीं है।
        </div>`;
      return;
    }

    container.innerHTML = res.rows.map(r => `
      <div class="bg-white rounded-xl p-4 mb-3 shadow-sm border-l-4 ${r.source_type === 'GOVT_MANDI' ? 'border-emerald-600' : 'border-blue-600'}">
        <div class="flex justify-between items-start mb-2">
          <div>
            <h2 class="text-lg font-bold text-gray-900">${r.crop_name}</h2>
            <p class="text-xs text-gray-500 font-medium">${r.mandi_name} मंडी | आवक: ${r.arrival_quantity || '0'} बोरी</p>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${r.source_type === 'GOVT_MANDI' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
            ${r.source_type === 'GOVT_MANDI' ? 'सरकारी नीलामी' : 'व्यापारी भाव'}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2 bg-gray-50 p-2 rounded-lg text-center mt-2">
          <div>
            <span class="text-[10px] text-gray-400 block">न्यूनतम</span>
            <span class="font-bold text-gray-800">₹${r.price_min}</span>
          </div>
          <div class="border-x border-gray-200">
            <span class="text-[10px] text-gray-400 block">मॉडल (औसत)</span>
            <span class="font-bold text-emerald-700">₹${r.price_modal || '-'}</span>
          </div>
          <div>
            <span class="text-[10px] text-gray-400 block">अधिकतम</span>
            <span class="font-bold text-gray-800">₹${r.price_max}</span>
          </div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `
      <div class="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
        <strong>डेटाबेस एरर:</strong> ${err.message}
        <p class="mt-1 text-[11px] text-red-500">यदि टेबल्स नहीं बनी हैं, तो Turso Shell में SQL स्क्रिप्ट रन करें।</p>
      </div>`;
  }
}

// Global filter access
window.filterMandi = (id) => loadRates(id);

// First load
loadRates();

