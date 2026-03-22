// ================================================
// WageTheft.live — Government Data Fetchers
// FINAL verified version — March 2026
//
// DOL USA  — apiprod.dol.gov/v4  "Authorization: Token KEY" ✅
// HMRC UK  — XLSX files (xlsx package)                      ✅
// Canada   — HTML scrape canada.ca                          ✅ 232 stored
// FWO AU   — BLOCKED by Vercel network                      ⛔ skipped
// WRC IE   — no public RSS exists                           ⛔ skipped
// NLA NL   — RSS                                            ✅
// ELA EU   — RSS                                            ✅
// ================================================

const UA = 'Mozilla/5.0 (compatible; WageTheft.live/1.0; +https://wagetheft.live)';

export const sanitize = (v) => {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g, ' ');
  return s.length > 0 ? s.slice(0, 500) : null;
};
export const toInt      = (v) => { const n = parseInt(v,10);  return isNaN(n)||n<0?0:n; };
export const toFloat    = (v) => { const n = parseFloat(v);   return isNaN(n)||n<0?0:n; };
export const toFloatStr = (s) => toFloat(String(s??'').replace(/[^0-9.]/g,''));
export const yearFrom   = (d) => {
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return isNaN(y)||y<1990||y>2100?null:y;
};

async function go(url, opts={}, ms=45000) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'User-Agent': UA, ...opts.headers },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res;
}

function extractAmount(text) {
  if (!text) return 0;
  const mM = text.match(/[£$€]?\s*([\d.]+)\s*million/i);
  if (mM) return toFloat(mM[1])*1_000_000;
  const mK = text.match(/[£$€]?\s*([\d.]+)\s*[Kk]\b/);
  if (mK) return toFloat(mK[1])*1_000;
  const m = text.match(/[£$€]\s*([\d,]+(?:\.\d{1,2})?)/);
  return m ? toFloatStr(m[1]) : 0;
}

function parseRSS(xml) {
  const items = [];
  for (const [,ix] of [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]) {
    const g = tag => {
      const m = ix.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
             || ix.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'i'));
      return m?.[1]?.trim()??'';
    };
    items.push({ title:g('title'), desc:g('description'), link:g('link'), pubDate:g('pubDate') });
  }
  return items;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇺🇸 USA — DOL apiprod.dol.gov/v4
// Auth: "Authorization: Token YOUR_API_KEY"
// ══════════════════════════════════════════════════════════════════════════
export async function fetchDOL(apiKey) {
  if (!apiKey) { console.error('[DOL] Missing DOL_API_KEY'); return []; }
  const rows = [];

  for (let offset = 0; offset < 2500; offset += 500) {
    try {
      const res = await fetch(
        `https://apiprod.dol.gov/v4/get/WHD/whd_whisard?limit=500&offset=${offset}`,
        {
          headers: {
            'Authorization': `Token ${apiKey}`,
            'User-Agent': UA,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(45000),
        }
      );

      if (!res.ok) {
        const errText = await res.text().catch(()=>'');
        console.warn(`[DOL] HTTP ${res.status} offset=${offset}: ${errText.slice(0,100)}`);
        break;
      }

      const json    = await res.json();
      const records = Array.isArray(json) ? json : (json?.data ?? json?.results ?? json?.d?.results ?? []);

      if (!records.length) { console.log(`[DOL] No more records at offset ${offset}`); break; }

      for (const r of records) {
        const bw = toFloat(r.bw_atp_amt ?? r.backWagesAmt ?? r.back_wages ?? 0);
        if (bw <= 0) continue;
        const name = sanitize(r.legal_name ?? r.legalName ?? r.trade_name ?? r.tradeName ?? r.employer_name ?? '');
        if (!name) continue;
        rows.push({
          company_name:       name,
          trade_name:         sanitize(r.trade_name ?? r.tradeName ?? null),
          industry:           sanitize(r.naic_description ?? r.naicDescription ?? r.industry ?? null),
          violation_type:     dolType(r),
          employees_affected: toInt(r.cmp_ee_atp_cnt ?? r.employeeCount ?? 0),
          amount_back_wages:  bw,
          amount_penalties:   toFloat(r.ee_atp_amt ?? r.penalties ?? 0),
          city:               sanitize(r.city_nm ?? r.city ?? null),
          state_province:     sanitize(r.st_cd ?? r.state ?? null),
          country:            'USA',
          year:               yearFrom(r.findings_end_date ?? r.findingsEndDate ?? null),
          case_id:            sanitize(r.case_id ?? r.caseId ?? null),
          source_agency:      'US Department of Labor — Wage and Hour Division',
          source_url:         'https://enforcedata.dol.gov',
        });
      }
      console.log(`[DOL] offset=${offset} parsed=${records.length} total=${rows.length}`);
      if (records.length < 500) break;
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
// 🇬🇧 UK — HMRC NMW XLSX files
// Round 21: May 2025, 518 employers
// Round 22: Oct 2025, ~491 employers
// Files are XLSX (not CSV) — use xlsx package to parse
// ══════════════════════════════════════════════════════════════════════════
export async function fetchUKHMRC() {
  const rows = [];

  const XLSX_URLS = [
    // Round 22 — Oct 2025 (most recent)
    'https://assets.publishing.service.gov.uk/media/68f268662f0fc56403a3d096/Round_22_NMW_Naming_Scheme__List_of_employers_as_of_16_October.xlsx',
    // Round 21 — May 2025
    'https://assets.publishing.service.gov.uk/media/68384e1ce0f10eed80aafad6/table-employers-named-round-21-national-minimum-wage-naming-scheme.xlsx',
  ];

  let XLSX;
  try {
    XLSX = await import('xlsx');
  } catch(e) {
    console.error('[HMRC] xlsx package not available:', e.message);
    return rows;
  }

  for (const url of XLSX_URLS) {
    try {
      const res  = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) { console.warn(`[HMRC] ${url.split('/').pop()} → HTTP ${res.status}`); continue; }

      const buffer   = await res.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const sheet    = workbook.Sheets[workbook.SheetNames[0]];
      const data     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      console.log(`[HMRC] XLSX parsed: ${data.length} rows, headers: ${data[0]?.join(', ').slice(0,100)}`);

      // Find column indices from header row
      const headers = (data[0] ?? []).map(h => String(h).toLowerCase().trim());
      const colIdx  = (term) => headers.findIndex(h => h.includes(term));
      
      const nameCol    = colIdx('employer') !== -1 ? colIdx('employer') : 0;
      const yearCol    = colIdx('year')     !== -1 ? colIdx('year')     : 1;
      const sectorCol  = colIdx('sector')   !== -1 ? colIdx('sector')   : (colIdx('industry') !== -1 ? colIdx('industry') : 2);
      const amountCol  = colIdx('amount')   !== -1 ? colIdx('amount')   : 3;
      const workerCol  = colIdx('worker')   !== -1 ? colIdx('worker')   : 4;
      const penaltyCol = colIdx('penalty')  !== -1 ? colIdx('penalty')  : 5;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 2) continue;
        const nm = sanitize(String(row[nameCol] ?? ''));
        const bw = toFloatStr(String(row[amountCol] ?? ''));
        if (!nm || nm.length < 2 || bw <= 0) continue;

        rows.push({
          company_name:       nm,
          industry:           sanitize(String(row[sectorCol] ?? '')),
          violation_type:     'National Minimum Wage Underpayment',
          employees_affected: toInt(String(row[workerCol] ?? '').replace(/\D/g,'')),
          amount_back_wages:  bw,
          amount_penalties:   toFloatStr(String(row[penaltyCol] ?? '')),
          country:            'UK',
          year:               toInt(String(row[yearCol] ?? '').replace(/\D/g,'')) || new Date().getFullYear(),
          case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g,'-').slice(0,20)}-${i}`,
          source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
          source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
        });
      }

      console.log(`[HMRC] ${url.split('/').pop()} → ${rows.length} valid rows`);
      if (rows.length > 0) break; // Stop after first successful file
    } catch(e) {
      console.error('[HMRC]', e.message);
    }
  }

  console.log(`[HMRC] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇦🇺 Australia — SKIPPED (fairwork.gov.au blocked by Vercel)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchAustralia() {
  console.log('[FWO] Skipped — fairwork.gov.au is blocked by Vercel network egress');
  return [];
}

// ══════════════════════════════════════════════════════════════════════════
// 🇨🇦 Canada — HTML scrape (confirmed 200 OK, 232 records stored)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchCanada() {
  const rows = [];
  try {
    const res = await go(
      'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
      {}, 45000
    );
    const html = await res.text();

    // Parse HTML table rows
    const tableMatch = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
    let found = 0;

    for (const table of tableMatch) {
      const trMatches = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const [,tr] of trMatches) {
        const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(([,c]) => c.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim());
        if (cells.length < 2) continue;
        const name = sanitize(cells[0]);
        if (!name || name.length < 2) continue;
        const province = cells.find(c => /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/.test(c.trim())) ?? null;
        const amountCell = cells.find(c => /\$[\d,]+/.test(c) || /^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(c.trim()));
        const amount = amountCell ? extractAmount(amountCell) : 0;
        const yearCell = cells.find(c => /^(202[0-9]|201[5-9])$/.test(c.trim()));
        rows.push({
          company_name:       name,
          state_province:     sanitize(province),
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  amount,
          employees_affected: 0,
          country:            'Canada',
          year:               yearCell ? toInt(yearCell) : new Date().getFullYear(),
          case_id:            `CA-NAM-${name.replace(/[^a-zA-Z0-9]/g,'-').slice(0,25)}-${found}`,
          source_agency:      'Employment and Social Development Canada',
          source_url:         'https://www.canada.ca/en/employment-social-development/corporate/portfolio/labour/public-naming-employers-code-regulations.html',
        });
        found++;
      }
    }

    // Fallback to list items
    if (rows.length === 0) {
      const liMatches = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
      for (const [,li] of liMatches) {
        const text = li.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
        if (text.length < 5 || text.length > 300) continue;
        if (!/^[A-Z]/.test(text)) continue;
        if (/privacy|terms|contact|menu|home|search|français|english/i.test(text)) continue;
        const name = sanitize(text.split(/[,;(]/)[0].trim());
        if (!name || name.length < 3) continue;
        const province = text.match(/\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/)?.[1] ?? null;
        rows.push({
          company_name:       name,
          state_province:     province,
          violation_type:     'Canada Labour Code Violation',
          amount_back_wages:  extractAmount(text),
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
// 🇮🇪 Ireland — SKIPPED (WRC has no public RSS feed)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchIreland() {
  console.log('[WRC-IE] Skipped — workplacerelations.ie has no public RSS feed');
  return [];
}

// ══════════════════════════════════════════════════════════════════════════
// 🇳🇱 Netherlands — NLA RSS
// ══════════════════════════════════════════════════════════════════════════
export async function fetchNetherlands() {
  const rows = [];
  const urls = [
    'https://www.nlarbeidsinspectie.nl/actueel/nieuws/rss',
    'https://www.nlarbeidsinspectie.nl/actueel/publicaties/rss',
  ];
  for (const url of urls) {
    try {
      const res   = await go(url, {}, 30000);
      const items = parseRSS(await res.text());
      for (const { title, desc, link, pubDate } of items) {
        const combined = `${title} ${desc}`.toLowerCase();
        if (!combined.includes('boete')&&!combined.includes('minimumloon')&&
            !combined.includes('loon')&&!combined.includes('fine')&&!combined.includes('wage')) continue;
        const name = sanitize(title.replace(/\s*[-–|:].*/,'').trim());
        if (!name||name.length<3) continue;
        const slug = link.split('/').filter(Boolean).pop()?.slice(0,40)??'';
        rows.push({
          company_name:      name,
          violation_type:    'Minimum Wage Violation (WML)',
          amount_back_wages: extractAmount(`${title} ${desc}`),
          country:           'Netherlands',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `NL-NLA-${slug}`,
          source_agency:     'Nederlandse Arbeidsinspectie — Netherlands Labour Authority',
          source_url:        link || 'https://www.nlarbeidsinspectie.nl',
        });
      }
    } catch(e) { console.warn('[NLA-NL]', e.message); }
  }
  console.log(`[NLA-NL] ✓ ${rows.length} rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇪🇺 Europe — ELA RSS
// ══════════════════════════════════════════════════════════════════════════
export async function fetchEurope() {
  const rows = [];
  const urls = [
    'https://www.ela.europa.eu/en/rss/news',
    'https://www.ela.europa.eu/en/rss/press-releases',
  ];
  for (const url of urls) {
    try {
      const res   = await go(url, {}, 30000);
      const items = parseRSS(await res.text());
      for (const { title, desc, link, pubDate } of items) {
        const combined = `${title} ${desc}`.toLowerCase();
        if (!combined.includes('inspection')&&!combined.includes('underpaid')&&
            !combined.includes('wage')&&!combined.includes('undeclared')&&
            !combined.includes('enforcement')) continue;
        const name = sanitize(title.slice(0,120)) || 'EU Inspection';
        const slug = link.split('/').filter(Boolean).pop()?.slice(0,40)??'';
        rows.push({
          company_name:      name,
          violation_type:    'EU Cross-Border Labour Inspection',
          amount_back_wages: extractAmount(`${title} ${desc}`),
          country:           'EU',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `EU-ELA-${slug}`,
          source_agency:     'European Labour Authority (ELA)',
          source_url:        link || 'https://www.ela.europa.eu',
        });
      }
    } catch(e) { console.warn('[ELA]', e.message); }
  }
  console.log(`[ELA] ✓ ${rows.length} rows`);
  return rows;
}
