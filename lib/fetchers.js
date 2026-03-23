// ================================================
// WageTheft.live — Fetchers FINAL
// ================================================
// SOURCE STATUS (confirmed from live debug tests):
//
// ✅ Canada    — HTML scrape canada.ca — 232 records WORKING
// ✅ DOL USA   — data.dol.gov ?KEY=xxx (old API, key confirmed by user)
// ✅ HMRC UK   — gov.uk JSON Content API → XLSX download
// ⛔ FWO AU    — BLOCKED by Vercel network (fetch failed)
// ⛔ WRC IE    — No public API or RSS exists
// ⛔ NLA NL    — No RSS exists (Next.js site, /rss returns 404)
// ⛔ ELA EU    — No RSS exists (Drupal site, /en/rss/news returns 404)
// ================================================

const UA = 'Mozilla/5.0 (compatible; WageTheft.live/1.0)';

export const sanitize = (v) => {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g,' ');
  return s.length > 0 ? s.slice(0,500) : null;
};
export const toInt      = (v) => { const n=parseInt(v,10);   return isNaN(n)||n<0?0:n; };
export const toFloat    = (v) => { const n=parseFloat(v);    return isNaN(n)||n<0?0:n; };
export const toFloatStr = (s) => toFloat(String(s??'').replace(/[^0-9.]/g,''));
export const yearFrom   = (d) => {
  if (!d) return null;
  const y=new Date(d).getFullYear();
  return isNaN(y)||y<1990||y>2100?null:y;
};

// ══════════════════════════════════════════════════════════════════════════
// 🇺🇸 USA — data.dol.gov (old V1 API, key = query param ?KEY=xxx)
// User confirmed: key sgS7mH... is for data.dol.gov specifically
// URL format: https://data.dol.gov/get/whd_whisard/rows:500/format:json
// ══════════════════════════════════════════════════════════════════════════
export async function fetchDOL(apiKey) {
  const rows = [];
  if (!apiKey) { console.error('[DOL] missing key'); return rows; }

  const PAGE = 500;

  for (let offset = 0; offset < 2500; offset += PAGE) {
    // Old data.dol.gov format uses KEY as query parameter
    const url = `https://data.dol.gov/get/whd_whisard/rows:${PAGE}/offset:${offset}/format:json?KEY=${apiKey}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(45000),
      });

      if (!res.ok) {
        console.warn(`[DOL] HTTP ${res.status} at offset ${offset}`);
        break;
      }

      const text = await res.text();

      // If it returned HTML, the API is redirecting — stop
      if (text.trim().startsWith('<') || text.trim().startsWith('<!')) {
        console.warn(`[DOL] Got HTML instead of JSON at offset ${offset} — API may require different auth`);
        break;
      }

      const json = JSON.parse(text);
      // data.dol.gov returns array directly
      const records = Array.isArray(json) ? json : (json?.whd_whisard ?? json?.data ?? []);
      if (!records.length) { console.log(`[DOL] end at offset ${offset}`); break; }

      for (const r of records) {
        const bw = toFloat(r.bw_atp_amt ?? 0);
        if (bw <= 0) continue;
        const name = sanitize(r.legal_name ?? r.trade_name ?? '');
        if (!name) continue;
        rows.push({
          company_name:       name,
          trade_name:         sanitize(r.trade_name ?? null),
          industry:           sanitize(r.naic_description ?? null),
          violation_type:     dolType(r),
          employees_affected: toInt(r.cmp_ee_atp_cnt ?? 0),
          amount_back_wages:  bw,
          amount_penalties:   toFloat(r.ee_atp_amt ?? 0),
          city:               sanitize(r.city_nm ?? null),
          state_province:     sanitize(r.st_cd ?? null),
          country:            'USA',
          year:               yearFrom(r.findings_end_date ?? null),
          case_id:            sanitize(r.case_id ?? null),
          source_agency:      'US Department of Labor — Wage and Hour Division',
          source_url:         'https://enforcedata.dol.gov',
        });
      }

      console.log(`[DOL] offset=${offset} got=${records.length} total=${rows.length}`);
      if (records.length < PAGE) break;

    } catch(e) {
      console.error(`[DOL offset=${offset}]`, e.message);
      break;
    }
  }

  console.log(`[DOL] ✓ ${rows.length} rows`);
  return rows;
}

function dolType(r) {
  const t=[];
  if (toFloat(r.flsa_bw_atp_amt)>0) t.push('Minimum Wage / Overtime (FLSA)');
  if (toFloat(r.mspa_bw_atp_amt)>0) t.push('Migrant & Seasonal Worker Protection');
  if (toFloat(r.dbra_bw_atp_amt)>0) t.push('Davis-Bacon Act');
  if (toFloat(r.sca_bw_atp_amt) >0) t.push('Service Contract Act');
  if (toInt(r.fmla_violtn_cnt)  >0) t.push('Family & Medical Leave Act');
  if (toInt(r.cl_minor_cnt)     >0) t.push('Child Labour Provisions');
  return t.length ? t.join(' · ') : 'Wage Violation';
}

// ══════════════════════════════════════════════════════════════════════════
// 🇬🇧 UK — HMRC via gov.uk JSON Content API
// Primary: /api/content/... returns JSON with attachment URLs
// Fallback: try known xlsx URL patterns
// ══════════════════════════════════════════════════════════════════════════
export async function fetchUKHMRC() {
  const rows = [];
  let XLSX;
  try { XLSX = await import('xlsx'); } catch(e) {
    console.error('[HMRC] xlsx package not installed:', e.message);
    return rows;
  }

  // Method 1: Use gov.uk JSON Content API (returns JSON not HTML)
  // This is different from the HTML page — it's the REST API
  const fileUrls = [];
  try {
    const apiUrl = 'https://www.gov.uk/api/content/government/publications/named-employers-who-have-not-paid-national-minimum-wage';
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const json = await res.json();
      // Look in details.attachments array
      const attachments = json?.details?.attachments ?? [];
      // Also check body for links
      const body = json?.details?.body ?? '';
      // Extract from attachments
      for (const att of attachments) {
        const u = att.url ?? att.asset_manager_url ?? '';
        if (u.match(/\.(xlsx?|csv)$/i)) fileUrls.push(u);
      }
      // Extract xlsx/csv links from body HTML
      const bodyLinks = [...body.matchAll(/href="([^"]*\.(xlsx?|csv))"/gi)].map(m=>m[1]);
      for (const u of bodyLinks) if (!fileUrls.includes(u)) fileUrls.push(u);
      console.log(`[HMRC] Content API: ${fileUrls.length} files`);
    } else {
      console.warn(`[HMRC] Content API HTTP ${res.status}`);
    }
  } catch(e) {
    console.warn('[HMRC] Content API error:', e.message);
  }

  // Method 2: Fallback known URLs — we try multiple patterns
  const fallbacks = [
    // Round 21 — May 2025 (518 employers) — various URL guesses
    'https://assets.publishing.service.gov.uk/media/68384e1ce0f10eed80aafad6/table-employers-named-round-21-national-minimum-wage-naming-scheme.xlsx',
    'https://assets.publishing.service.gov.uk/media/683841b5e0f10eed80aafad3/table-employers-named-round-21-national-minimum-wage-naming-scheme.xlsx',
    // Round 20 — 2024 (older but known working)
    'https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.csv',
    'https://assets.publishing.service.gov.uk/media/6537d5e70466c1000d759cda/23_24_NMW_Naming_Scheme_Employers.csv',
  ];
  for (const u of fallbacks) if (!fileUrls.includes(u)) fileUrls.push(u);

  // Try each file
  for (const url of fileUrls) {
    if (rows.length > 0) break;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) { console.warn(`[HMRC] ${url.split('/').pop()} → ${res.status}`); continue; }

      const isXlsx = /\.xlsx?$/i.test(url);

      if (isXlsx) {
        const buf  = await res.arrayBuffer();
        const wb   = XLSX.read(new Uint8Array(buf), { type:'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        if (data.length < 2) continue;

        const h   = (data[0]??[]).map(x=>String(x).toLowerCase().trim());
        const col = (...terms) => { for (const t of terms) { const i=h.findIndex(x=>x.includes(t)); if(i!==-1) return i; } return -1; };
        const nc  = col('employer')!=-1 ? col('employer') : 0;
        const yc  = col('year')!=-1     ? col('year')     : 1;
        const sc  = col('sector','industry','sic') !== -1 ? col('sector','industry','sic') : 2;
        const ac  = col('amount','arrears','underpayment') !== -1 ? col('amount','arrears','underpayment') : 3;
        const wc  = col('worker','employee') !== -1 ? col('worker','employee') : 4;
        const pc  = col('penalty','fine') !== -1 ? col('penalty','fine') : 5;

        console.log(`[HMRC] ${url.split('/').pop()} XLSX ${data.length} rows, h=${h.slice(0,6).join('|')}`);

        for (let i=1; i<data.length; i++) {
          const row = data[i]; if (!row||row.length<2) continue;
          const nm  = sanitize(String(row[nc]??''));
          if (!nm||nm.length<2) continue;
          rows.push({
            company_name:       nm,
            industry:           sanitize(String(row[sc]??'')),
            violation_type:     'National Minimum Wage Underpayment',
            employees_affected: toInt(String(row[wc]??'').replace(/\D/g,'')),
            amount_back_wages:  toFloatStr(String(row[ac]??'')),
            amount_penalties:   toFloatStr(String(row[pc]??'')),
            country:            'UK',
            year:               toInt(String(row[yc]??'').replace(/\D/g,'')) || new Date().getFullYear(),
            case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g,'-').slice(0,20)}-${i}`,
            source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
            source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
          });
        }
        console.log(`[HMRC] XLSX → ${rows.length} valid rows`);

      } else {
        // CSV
        const text = await res.text();
        if (text.trim().startsWith('<')||text.trim().startsWith('{')) continue;
        const lines = text.split(/\r?\n/).filter(l=>l.trim());
        lines.slice(1).forEach((line,i) => {
          const cols=[]; let cur=''; let inQ=false;
          for (const ch of line) {
            if (ch==='"') inQ=!inQ;
            else if (ch===','&&!inQ) { cols.push(cur.trim()); cur=''; }
            else cur+=ch;
          }
          cols.push(cur.trim());
          const nm=sanitize(cols[0]); const bw=toFloatStr(cols[3]??'');
          if (!nm||bw<=0) return;
          rows.push({
            company_name:       nm,
            industry:           sanitize(cols[2]),
            violation_type:     'National Minimum Wage Underpayment',
            employees_affected: toInt(String(cols[4]??'').replace(/\D/g,'')),
            amount_back_wages:  bw,
            amount_penalties:   toFloatStr(cols[5]??''),
            country:            'UK',
            year:               toInt(String(cols[1]??'').replace(/\D/g,'')) || new Date().getFullYear(),
            case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g,'-').slice(0,20)}-${i}`,
            source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
            source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
          });
        });
        console.log(`[HMRC] CSV → ${rows.length} valid rows`);
      }
    } catch(e) {
      console.warn(`[HMRC] ${url.split('/').pop()}:`, e.message);
    }
  }

  console.log(`[HMRC] ✓ ${rows.length} total`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇨🇦 Canada — HTML scrape (CONFIRMED WORKING — 232 records)
// 90s timeout — canada.ca is genuinely slow
// ══════════════════════════════════════════════════════════════════════════
export async function fetchCanada() {
  const rows = [];
  try {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 90000);
    const res  = await fetch(
      'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
      { headers:{ 'User-Agent':UA }, signal:ctrl.signal }
    );
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    console.log(`[ESDC] page ${Math.round(html.length/1024)}KB`);

    // Parse table rows
    const tables = [...(html.match(/<table[\s\S]*?<\/table>/gi)??[])];
    let found = 0;
    for (const table of tables) {
      const trs = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const [,tr] of trs) {
        const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(([,c])=>c.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim());
        if (cells.length < 2) continue;
        const name = sanitize(cells[0]);
        if (!name || name.length < 2) continue;
        const province = cells.find(c=>/^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/.test(c.trim()))??null;
        const amCell   = cells.find(c=>/\$[\d,]+/.test(c)||/^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(c.trim()));
        const yrCell   = cells.find(c=>/^(202[0-9]|201[5-9])$/.test(c.trim()));
        rows.push({
          company_name:       name,
          state_province:     sanitize(province),
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  amCell ? toFloatStr(amCell.replace(/[^0-9.]/g,'')) : 0,
          employees_affected: 0,
          country:            'Canada',
          year:               yrCell ? toInt(yrCell) : new Date().getFullYear(),
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g,'-').slice(0,25)}-${found}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
        found++;
      }
    }

    // Fallback: list items
    if (rows.length === 0) {
      for (const [,li] of [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]) {
        const text = li.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
        if (text.length<5||text.length>300||!/^[A-Z]/.test(text)) continue;
        if (/privacy|terms|contact|menu|home|search|français|english/i.test(text)) continue;
        const name = sanitize(text.split(/[,;(]/)[0].trim());
        if (!name||name.length<3) continue;
        rows.push({
          company_name:       name,
          state_province:     text.match(/\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/)?.[1]??null,
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  toFloatStr((text.match(/\$?([\d,]+(?:\.\d{1,2})?)/)?.[1]??'0').replace(/,/g,'')),
          employees_affected: 0,
          country:            'Canada',
          year:               new Date().getFullYear(),
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g,'-').slice(0,25)}-${rows.length}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
      }
    }
  } catch(e) {
    console.error('[ESDC]', e.message);
  }
  console.log(`[ESDC] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// All others — confirmed not available from Vercel
// ══════════════════════════════════════════════════════════════════════════
export async function fetchAustralia()   { return []; } // Vercel blocks fairwork.gov.au
export async function fetchIreland()     { return []; } // No public API
export async function fetchNetherlands() { return []; } // No RSS (/rss returns 404)
export async function fetchEurope()      { return []; } // No RSS (/en/rss/news returns 404)
