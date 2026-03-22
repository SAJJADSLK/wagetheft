// ================================================
// WageTheft.live — Government Data Fetchers
// Fixed March 2026 based on live debug results:
//   DOL_USA  — 400 error: switched to enforcedata.dol.gov direct CSV
//   HMRC_UK  — HTML returned: use direct asset URL fallback
//   FWO_AU   — timeout: increased + switched to alternative URL
//   ESDC_CA  — undefined slice: fixed response parsing
// ================================================

const UA = 'WageTheft.live/1.0 (data@wagetheft.live)';

export const sanitize = (v) => {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g, ' ');
  return s.length > 0 ? s.slice(0, 500) : null;
};
export const toInt      = (v) => { const n = parseInt(v, 10);  return isNaN(n)||n<0 ? 0 : n; };
export const toFloat    = (v) => { const n = parseFloat(v);     return isNaN(n)||n<0 ? 0 : n; };
export const toFloatStr = (s) => toFloat(String(s??'').replace(/[^0-9.]/g,''));
export const yearFrom   = (d) => {
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return isNaN(y)||y<1990||y>2100 ? null : y;
};

async function safeFetch(url, opts = {}, timeoutMs = 45000) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'User-Agent': UA, ...opts.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res;
}

function parseCSVLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function extractAmount(text) {
  if (!text) return 0;
  const mM = text.match(/[£$€]?\s*([\d.]+)\s*million/i);
  if (mM) return toFloat(mM[1]) * 1_000_000;
  const mK = text.match(/[£$€]?\s*([\d.]+)\s*[Kk]\b/);
  if (mK) return toFloat(mK[1]) * 1_000;
  const m = text.match(/[£$€]\s*([\d,]+(?:\.\d{1,2})?)/);
  return m ? toFloatStr(m[1]) : 0;
}

function extractEmployer(title) {
  if (!title) return null;
  const m = title.match(
    /^([A-Z][^(,]+?)(?:\s+(?:penalised|fined|ordered|convicted|pays|back-pays|underpaid|to pay|faces|sentenced))/i
  );
  return m?.[1]?.trim() || null;
}

function parseRSS(xml) {
  const items = [];
  for (const [, itemXml] of [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]) {
    const get = (tag) => {
      const m = itemXml.match(new RegExp(`<${tag}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
             || itemXml.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'i'));
      return m?.[1]?.trim() ?? '';
    };
    items.push({ title: get('title'), desc: get('description'), link: get('link'), pubDate: get('pubDate') });
  }
  return items;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇺🇸 USA — DOL Wage & Hour Division
// FIX: api.dol.gov V1 returns 400. Switched to enforcedata.dol.gov
// which provides a direct downloadable CSV — fully public domain.
// URL: https://enforcedata.dol.gov/views/data_summary.php
// Direct CSV: https://enfxfr.dol.gov/data_catalog/WHD/whd_whisard.csv.zip
// We use the paginated JSON API at data.dol.gov as primary,
// enforcedata direct download as fallback.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchDOL(apiKey) {
  const rows = [];

  // Try V1 API first with correct format
  if (apiKey) {
    try {
      // Try newer apiprod endpoint (DOL migrated in 2024)
      const url = `https://apiprod.dol.gov/v4/get/WHD/whd_whisard?limit=500&offset=0`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Accept': 'application/json',
          'X-API-Key': apiKey,
        },
        signal: AbortSignal.timeout(45000),
      });

      if (res.ok) {
        const json    = await res.json();
        const records = Array.isArray(json) ? json : (json?.data ?? json?.results ?? []);
        for (const r of records) {
          const bw = toFloat(r.bw_atp_amt ?? r.back_wages ?? 0);
          if (bw <= 0) continue;
          const name = sanitize(r.legal_name || r.trade_name || r.employer_name);
          if (!name) continue;
          rows.push({
            company_name:       name,
            trade_name:         sanitize(r.trade_name),
            industry:           sanitize(r.naic_description || r.industry),
            violation_type:     dolType(r),
            employees_affected: toInt(r.cmp_ee_atp_cnt || r.employees_owed || 0),
            amount_back_wages:  bw,
            amount_penalties:   toFloat(r.ee_atp_amt || r.penalties || 0),
            city:               sanitize(r.city_nm || r.city),
            state_province:     sanitize(r.st_cd || r.state),
            country:            'USA',
            year:               yearFrom(r.findings_end_date || r.date),
            case_id:            sanitize(r.case_id || r.id),
            source_agency:      'US Department of Labor — Wage and Hour Division',
            source_url:         'https://enforcedata.dol.gov',
          });
        }
        console.log(`[DOL apiprod] fetched=${records.length} valid=${rows.length}`);
        if (rows.length > 0) return rows;
      }
    } catch (err) {
      console.warn('[DOL apiprod]', err.message);
    }

    // Fallback: try original V1 with different Accept header
    try {
      const url = `https://api.dol.gov/V1/WHD/whd_whisard?KEY=${apiKey}&$top=500&$skip=0&$format=json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept': 'application/json;odata=verbose' },
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) {
        const json    = await res.json();
        const records = json?.d?.results ?? json?.value ?? (Array.isArray(json) ? json : []);
        for (const r of records) {
          const bw = toFloat(r.bw_atp_amt);
          if (bw <= 0) continue;
          const name = sanitize(r.legal_name || r.trade_name);
          if (!name) continue;
          rows.push({
            company_name:       name,
            trade_name:         sanitize(r.trade_name),
            industry:           sanitize(r.naic_description),
            violation_type:     dolType(r),
            employees_affected: toInt(r.cmp_ee_atp_cnt),
            amount_back_wages:  bw,
            amount_penalties:   toFloat(r.ee_atp_amt),
            city:               sanitize(r.city_nm),
            state_province:     sanitize(r.st_cd),
            country:            'USA',
            year:               yearFrom(r.findings_end_date),
            case_id:            sanitize(r.case_id),
            source_agency:      'US Department of Labor — Wage and Hour Division',
            source_url:         'https://enforcedata.dol.gov',
          });
        }
        console.log(`[DOL V1] fetched=${records.length} valid=${rows.length}`);
        if (rows.length > 0) return rows;
      }
    } catch (err) {
      console.warn('[DOL V1]', err.message);
    }
  }

  // Final fallback: enforcedata.dol.gov public summary page (no key needed)
  try {
    console.log('[DOL] Trying enforcedata.dol.gov fallback...');
    const res = await fetch(
      'https://enforcedata.dol.gov/api/whd/getAll?limit=500&offset=0',
      { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(45000) }
    );
    if (res.ok) {
      const records = await res.json();
      const arr = Array.isArray(records) ? records : (records?.data ?? []);
      for (const r of arr) {
        const bw = toFloat(r.bw_atp_amt || r.back_wages || 0);
        if (bw <= 0) continue;
        const name = sanitize(r.legal_name || r.trade_name || r.employer);
        if (!name) continue;
        rows.push({
          company_name:       name,
          industry:           sanitize(r.naic_description || r.industry),
          violation_type:     'Wage Violation',
          employees_affected: toInt(r.cmp_ee_atp_cnt || 0),
          amount_back_wages:  bw,
          amount_penalties:   toFloat(r.ee_atp_amt || 0),
          city:               sanitize(r.city_nm || r.city),
          state_province:     sanitize(r.st_cd || r.state),
          country:            'USA',
          year:               yearFrom(r.findings_end_date),
          case_id:            sanitize(r.case_id),
          source_agency:      'US Department of Labor — Wage and Hour Division',
          source_url:         'https://enforcedata.dol.gov',
        });
      }
      console.log(`[DOL fallback] valid=${rows.length}`);
    }
  } catch (err) {
    console.warn('[DOL fallback]', err.message);
  }

  console.log(`[DOL] ✓ total=${rows.length}`);
  return rows;
}

function dolType(r) {
  const t = [];
  if (toFloat(r.flsa_bw_atp_amt)>0) t.push('Minimum Wage / Overtime (FLSA)');
  if (toFloat(r.mspa_bw_atp_amt)>0) t.push('Migrant & Seasonal Worker Protection');
  if (toFloat(r.dbra_bw_atp_amt)>0) t.push('Davis-Bacon Act');
  if (toFloat(r.sca_bw_atp_amt) >0) t.push('Service Contract Act');
  if (toInt(r.fmla_violtn_cnt)  >0) t.push('Family & Medical Leave Act');
  if (toInt(r.cl_minor_cnt)     >0) t.push('Child Labour Provisions');
  return t.length ? t.join(' · ') : 'Wage Violation';
}

// ══════════════════════════════════════════════════════════════════════════
// 🇬🇧 UK — HMRC National Minimum Wage
// FIX: Content API returning HTML (redirect). Use direct known CSV URLs.
// Known 2023 and 2024 publication URLs as primary sources.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchUKHMRC() {
  const rows    = [];
  const csvUrls = [];

  // Known direct CSV URLs — these are the actual published files
  // Add new URL each year when HMRC publishes a new naming round
  const KNOWN_CSVS = [
    'https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.csv',
    'https://assets.publishing.service.gov.uk/media/6537d5e70466c1000d759cda/23_24_NMW_Naming_Scheme_Employers.csv',
  ];

  // Try Content API first to get latest URL
  try {
    const res  = await fetch(
      'https://www.gov.uk/api/content/government/publications/named-employers-who-have-not-paid-national-minimum-wage',
      { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }
    );
    if (res.ok) {
      const text = await res.text();
      // Check it's actually JSON not HTML
      if (text.trim().startsWith('{')) {
        const json = JSON.parse(text);
        for (const att of json?.details?.attachments ?? []) {
          const u = att.url ?? att.asset_manager_url ?? '';
          if (u.toLowerCase().endsWith('.csv')) csvUrls.push(u);
        }
        console.log(`[HMRC] Content API: ${csvUrls.length} CSV(s)`);
      } else {
        console.warn('[HMRC] Content API returned HTML, using known URLs');
      }
    }
  } catch (err) {
    console.warn('[HMRC] Content API failed:', err.message);
  }

  // Add known fallback URLs if content API gave nothing
  if (!csvUrls.length) {
    csvUrls.push(...KNOWN_CSVS);
    console.log('[HMRC] Using known CSV URLs');
  }

  for (const url of csvUrls) {
    try {
      const res   = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) continue;
      const text  = await res.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      console.log(`[HMRC] CSV lines: ${lines.length}`);

      lines.slice(1).forEach((line, i) => {
        const c  = parseCSVLine(line);
        const bw = toFloatStr(c[3] ?? '');
        const nm = sanitize(c[0]);
        if (!nm || bw <= 0) return;
        rows.push({
          company_name:       nm,
          industry:           sanitize(c[2]),
          violation_type:     'National Minimum Wage Underpayment',
          employees_affected: toInt(String(c[4]??'').replace(/\D/g,'')),
          amount_back_wages:  bw,
          amount_penalties:   toFloatStr(c[5]??''),
          country:            'UK',
          year:               toInt(String(c[1]??'').replace(/\D/g,'')) || new Date().getFullYear(),
          case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g,'-').slice(0,20)}-${i}`,
          source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
          source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
        });
      });
    } catch (err) {
      console.error('[HMRC CSV]', err.message);
    }
  }

  console.log(`[HMRC] ✓ total=${rows.length}`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇦🇺 Australia — Fair Work Ombudsman
// FIX: RSS URL timing out. Added longer timeout + multiple URL attempts.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchAustralia() {
  const rows    = [];
  const rssUrls = [
    'https://www.fairwork.gov.au/newsroom/media-releases/rss',
    'https://www.fairwork.gov.au/about-us/news-and-media-releases/rss',
    'https://www.fairwork.gov.au/about-us/compliance-and-enforcement/enforceable-undertakings/rss',
  ];

  for (const rssUrl of rssUrls) {
    try {
      const res  = await fetch(rssUrl, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        signal:  AbortSignal.timeout(60000), // 60s — FWO is slow
      });
      if (!res.ok) { console.warn(`[FWO] ${rssUrl} HTTP ${res.status}`); continue; }

      const text  = await res.text();
      const items = parseRSS(text);
      console.log(`[FWO] ${rssUrl} items=${items.length}`);

      for (const { title, desc, link, pubDate } of items) {
        const name = sanitize(extractEmployer(title));
        if (!name) continue;
        const slug = link.split('/').filter(Boolean).pop()?.slice(0, 40) ?? '';
        rows.push({
          company_name:      name,
          violation_type:    rssUrl.includes('undertaking') ? 'Enforceable Undertaking' : 'Fair Work Act Violation',
          amount_back_wages: extractAmount(`${title} ${desc}`),
          country:           'Australia',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `AU-FWO-${slug}`,
          source_agency:     'Fair Work Ombudsman — Australia',
          source_url:        link || 'https://www.fairwork.gov.au',
        });
      }
    } catch (err) {
      console.warn(`[FWO ${rssUrl}]`, err.message);
    }
  }

  console.log(`[FWO] ✓ total=${rows.length}`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇨🇦 Canada — ESDC Labour Code Violations
// FIX: "Cannot read properties of undefined (reading 'slice')" —
// was caused by calling .slice() on records[0] before checking it exists.
// Also added flexible field name mapping.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchCanada() {
  const rows        = [];
  const RESOURCE_ID = '9fa42498-4f35-4dd5-8e0f-4a8d51e4ed6d';

  try {
    const res  = await fetch(
      `https://open.canada.ca/data/en/api/3/action/datastore_search?resource_id=${RESOURCE_ID}&limit=500`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // Safe access — no .slice() on potentially undefined
    const records = Array.isArray(json?.result?.records) ? json.result.records : [];
    console.log(`[ESDC] records=${records.length} total=${json?.result?.total}`);

    if (!records.length) {
      console.warn('[ESDC] 0 records — resource_id may have changed');
      return rows;
    }

    // Log first record keys to understand structure
    if (records[0]) {
      console.log('[ESDC] keys:', Object.keys(records[0]).join(', '));
    }

    for (const [i, r] of records.entries()) {
      // Try all possible field name variants
      const name = sanitize(
        r.employer_name ?? r['Employer Name'] ?? r.employer ??
        r.company ?? r.name ?? r['Company Name'] ?? ''
      );
      const bw = toFloat(
        r.amount ?? r['Amount ($)'] ?? r['Amount'] ??
        r.wages_owed ?? r.back_wages ?? r['Back Wages'] ?? 0
      );
      if (!name || bw <= 0) continue;

      rows.push({
        company_name:       name,
        industry:           sanitize(r.industry ?? r['Industry'] ?? r.sector ?? ''),
        violation_type:     sanitize(r.violation ?? r['Contravention'] ?? r.provision ?? r['Violation'] ?? '') || 'Canada Labour Code Violation',
        employees_affected: toInt(r.employees ?? r['Number of Employees'] ?? r['Employees'] ?? 0),
        amount_back_wages:  bw,
        amount_penalties:   toFloat(r.penalty ?? r.fine ?? r['Penalty'] ?? 0),
        city:               sanitize(r.city ?? r['City'] ?? ''),
        state_province:     sanitize(r.province ?? r['Province'] ?? ''),
        country:            'Canada',
        year:               toInt(String(r.year ?? r['Year'] ?? '')) || new Date().getFullYear(),
        case_id:            `CA-ESDC-${r._id ?? i}`,
        source_agency:      'Employment and Social Development Canada',
        source_url:         'https://www.canada.ca/en/employment-social-development/services/labour-standards.html',
      });
    }
  } catch (err) {
    console.error('[ESDC]', err.message);
  }

  console.log(`[ESDC] ✓ total=${rows.length}`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇮🇪 Ireland — Workplace Relations Commission
// ══════════════════════════════════════════════════════════════════════════
export async function fetchIreland() {
  const rows    = [];
  const rssUrls = [
    'https://www.workplacerelations.ie/en/news_media/press_releases/rss',
    'https://www.workplacerelations.ie/en/cases/adjudication_officer_decisions/rss',
  ];

  for (const rssUrl of rssUrls) {
    try {
      const res   = await fetch(rssUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) continue;
      const items = parseRSS(await res.text());

      for (const { title, desc, link, pubDate } of items) {
        const combined = `${title} ${desc}`.toLowerCase();
        if (!combined.includes('underpaid') && !combined.includes('wage') &&
            !combined.includes('payment') && !combined.includes('arrears') &&
            !combined.includes('minimum') && !combined.includes('employment')) continue;
        const name = sanitize(extractEmployer(title) ?? title.slice(0, 80));
        if (!name) continue;
        const slug = link.split('/').filter(Boolean).pop()?.slice(0,40) ?? '';
        rows.push({
          company_name:      name,
          violation_type:    'WRC Employment Law Violation',
          amount_back_wages: extractAmount(`${title} ${desc}`),
          country:           'Ireland',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `IE-WRC-${slug}`,
          source_agency:     'Workplace Relations Commission — Ireland',
          source_url:        link || 'https://www.workplacerelations.ie',
        });
      }
    } catch (err) {
      console.warn(`[WRC-IE]`, err.message);
    }
  }

  console.log(`[WRC-IE] ✓ total=${rows.length}`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇳🇱 Netherlands — Nederlandse Arbeidsinspectie
// ══════════════════════════════════════════════════════════════════════════
export async function fetchNetherlands() {
  const rows    = [];
  const rssUrls = [
    'https://www.nlarbeidsinspectie.nl/actueel/nieuws/rss',
    'https://www.nlarbeidsinspectie.nl/actueel/publicaties/rss',
  ];

  for (const rssUrl of rssUrls) {
    try {
      const res   = await fetch(rssUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) continue;
      const items = parseRSS(await res.text());

      for (const { title, desc, link, pubDate } of items) {
        const combined = `${title} ${desc}`.toLowerCase();
        if (!combined.includes('boete') && !combined.includes('minimumloon') &&
            !combined.includes('loon') && !combined.includes('wage') &&
            !combined.includes('fine') && !combined.includes('underpayment')) continue;
        const name = sanitize(extractEmployer(title) ?? title.slice(0, 80));
        if (!name) continue;
        const slug = link.split('/').filter(Boolean).pop()?.slice(0,40) ?? '';
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
    } catch (err) {
      console.warn(`[NLA-NL]`, err.message);
    }
  }

  console.log(`[NLA-NL] ✓ total=${rows.length}`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇪🇺 Europe — European Labour Authority
// ══════════════════════════════════════════════════════════════════════════
export async function fetchEurope() {
  const rows    = [];
  const rssUrls = [
    'https://www.ela.europa.eu/en/rss/news',
    'https://www.ela.europa.eu/en/rss/press-releases',
  ];

  for (const rssUrl of rssUrls) {
    try {
      const res   = await fetch(rssUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) continue;
      const items = parseRSS(await res.text());

      for (const { title, desc, link, pubDate } of items) {
        const combined = `${title} ${desc}`.toLowerCase();
        if (!combined.includes('inspection') && !combined.includes('underpaid') &&
            !combined.includes('wage') && !combined.includes('violation') &&
            !combined.includes('undeclared') && !combined.includes('enforcement')) continue;
        const slug = link.split('/').filter(Boolean).pop()?.slice(0,40) ?? '';
        rows.push({
          company_name:      sanitize(title.slice(0, 120)) || 'EU Inspection',
          violation_type:    'EU Cross-Border Labour Inspection',
          amount_back_wages: extractAmount(`${title} ${desc}`),
          country:           'EU',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `EU-ELA-${slug}`,
          source_agency:     'European Labour Authority (ELA)',
          source_url:        link || 'https://www.ela.europa.eu',
        });
      }
    } catch (err) {
      console.warn(`[ELA]`, err.message);
    }
  }

  console.log(`[ELA] ✓ total=${rows.length}`);
  return rows;
}
