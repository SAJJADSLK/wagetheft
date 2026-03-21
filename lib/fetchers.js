// ================================================
// WageTheft.live — All Government Data Fetchers
// Verified March 2026
//
// SOURCES & STATUS:
//   USA    — api.dol.gov/V1/WHD/whd_whisard       ✅ VERIFIED (OData V1, KEY in URL)
//   UK     — gov.uk Content API → CSV attachment   ✅ VERIFIED (OG Licence v3.0)
//   AU     — fairwork.gov.au RSS feeds             ✅ VERIFIED (no JSON API exists)
//   CA     — open.canada.ca CKAN                  ✅ VERIFIED (resource ID confirmed)
//   IE     — workplacerelations.ie decisions       ✅ VERIFIED (WRC public decisions)
//   NL     — nlarbeidsinspectie.nl RSS             ✅ VERIFIED (public press releases)
//   EU/ELA — ela.europa.eu news RSS                ✅ VERIFIED (cross-border inspections)
//
// NOTE: No single EU-wide wage violation database exists.
// Germany, France, Spain etc. do NOT publish searchable
// employer fine records as open data. We use ELA cross-border
// inspection results + Ireland WRC + Netherlands NLA.
// ================================================

const UA = 'WageTheft.live/1.0 (public data aggregator; data@wagetheft.live)';

// ── Helpers ────────────────────────────────────────────────────────────────
export const sanitize = (v) => {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g, ' ');
  return s.length > 0 ? s.slice(0, 500) : null;
};
export const toInt      = (v) => { const n = parseInt(v, 10);  return isNaN(n) || n < 0 ? 0 : n; };
export const toFloat    = (v) => { const n = parseFloat(v);     return isNaN(n) || n < 0 ? 0 : n; };
export const toFloatStr = (s) => toFloat(String(s ?? '').replace(/[^0-9.]/g, ''));
export const yearFrom   = (d) => {
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return isNaN(y) || y < 1990 || y > 2100 ? null : y;
};

async function fetchWithRetry(url, opts = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers: { 'User-Agent': UA, ...opts.headers },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
      return res;
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`[fetch] Retry ${i+1} for ${url}: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

function parseCSVLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (const ch of line) {
    if (ch === '"')              inQ = !inQ;
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else                          cur += ch;
  }
  result.push(cur.trim());
  return result;
}

// Extract £/$€ amounts from free text
function extractAmount(text) {
  const mM = text.match(/[£$€]?\s*([\d.]+)\s*million/i);
  if (mM) return toFloat(mM[1]) * 1_000_000;
  const mK = text.match(/[£$€]?\s*([\d.]+)\s*[Kk]/);
  if (mK) return toFloat(mK[1]) * 1_000;
  const m = text.match(/[£$€]\s*([\d,]+(?:\.\d{1,2})?)/);
  return m ? toFloatStr(m[1]) : 0;
}

// Extract employer name from news headline patterns
function extractEmployer(title) {
  if (!title) return null;
  const patterns = [
    /^([A-Z][^(,]+?)(?:\s+(?:penalised|fined|ordered|convicted|pays|back-pays|underpaid|to pay|faces|back pays|sentenced))/i,
    /^([A-Z][^(,]+?)\s+(?:Pty Ltd|Ltd|LLC|Inc|Corp|GmbH|BV|NV|SAS|SRL|SpA)\b/i,
  ];
  for (const p of patterns) {
    const m = title.match(p);
    if (m?.[1]?.trim().length > 2) return m[1].trim();
  }
  return null;
}

// Parse RSS XML into item array
function parseRSS(xml) {
  const items = [];
  for (const [, itemXml] of [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]) {
    const get = (tag) => {
      const m = itemXml.match(new RegExp(`<${tag}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
             || itemXml.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`, 'i'));
      return m?.[1]?.trim() ?? '';
    };
    items.push({
      title:   get('title'),
      desc:    get('description'),
      link:    get('link'),
      pubDate: get('pubDate'),
    });
  }
  return items;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇺🇸 USA — Department of Labor Wage & Hour Division
// API:  https://api.dol.gov/V1/WHD/whd_whisard?KEY=YOUR_KEY
// Auth: KEY param in URL (DOL V1 OData convention)
// JSON: Accept: application/json header
// Pages: $top / $skip OData params
// Response: { d: { results: [...] } }
// ~200,000 records since FY 2005 · quarterly updated
// Fetch time: ~60–120 seconds (5 pages)
// ══════════════════════════════════════════════════════════════════════════
export async function fetchDOL(apiKey) {
  if (!apiKey) {
    console.error('[DOL] Missing DOL_API_KEY env var. Free registration: https://devtools.dol.gov/developer');
    return [];
  }

  const rows   = [];
  const TOP    = 500;
  let   skip   = 0;
  let   page   = 0;
  const MAX    = 5; // 2,500 records per cron run — prevents 300s timeout

  while (page < MAX) {
    const url = `https://api.dol.gov/V1/WHD/whd_whisard?KEY=${apiKey}&$top=${TOP}&$skip=${skip}`;
    try {
      const res     = await fetchWithRetry(url, { headers: { Accept: 'application/json' } });
      const json    = await res.json();
      // DOL V1 wraps in d.results; fallback for other shapes
      const records = json?.d?.results ?? json?.value ?? (Array.isArray(json) ? json : []);

      if (!records.length) { console.log(`[DOL] No more records at skip=${skip}`); break; }

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

      console.log(`[DOL] page=${page} skip=${skip} parsed=${records.length} total=${rows.length}`);
      if (records.length < TOP) break;
      skip += TOP;
      page++;
    } catch (err) {
      console.error(`[DOL page=${page}]`, err.message);
      break;
    }
  }

  console.log(`[DOL] ✓ finished — ${rows.length} valid rows`);
  return rows;
}

function dolType(r) {
  const t = [];
  if (toFloat(r.flsa_bw_atp_amt) > 0) t.push('Minimum Wage / Overtime (FLSA)');
  if (toFloat(r.mspa_bw_atp_amt) > 0) t.push('Migrant & Seasonal Worker Protection');
  if (toFloat(r.dbra_bw_atp_amt) > 0) t.push('Davis-Bacon Act');
  if (toFloat(r.sca_bw_atp_amt)  > 0) t.push('Service Contract Act');
  if (toInt(r.fmla_violtn_cnt)   > 0) t.push('Family & Medical Leave Act');
  if (toInt(r.cl_minor_cnt)      > 0) t.push('Child Labour Provisions');
  return t.length ? t.join(' · ') : 'Wage Violation';
}

// ══════════════════════════════════════════════════════════════════════════
// 🇬🇧 UK — HMRC National Minimum Wage
// Primary: gov.uk Content API → CSV attachment URL
// Fallback: direct 2024 CSV (update URL each year)
// Licence: Open Government Licence v3.0 — no key
// ~524 employers per annual naming round
// Fetch time: ~8–15 seconds
// ══════════════════════════════════════════════════════════════════════════
export async function fetchUKHMRC() {
  const rows    = [];
  const csvUrls = [];

  // Step 1: resolve current CSV URL from gov.uk Content API
  try {
    const res  = await fetchWithRetry(
      'https://www.gov.uk/api/content/government/publications/named-employers-who-have-not-paid-national-minimum-wage',
      { headers: { Accept: 'application/json' } }
    );
    const page = await res.json();
    for (const att of page?.details?.attachments ?? []) {
      const u = att.url ?? att.asset_manager_url ?? '';
      if (u.toLowerCase().endsWith('.csv')) csvUrls.push(u);
    }
    console.log(`[HMRC] Found ${csvUrls.length} CSV attachment(s)`);
  } catch (err) {
    console.warn('[HMRC] Content API failed:', err.message);
  }

  // Step 2: fallback to known 2024 direct URL (update annually after new round)
  if (!csvUrls.length) {
    csvUrls.push('https://assets.publishing.service.gov.uk/media/65d4a4c61419100011f45316/2024_publication_of_NMW_named_employers.csv');
    console.log('[HMRC] Using fallback CSV URL');
  }

  // Step 3: download + parse each CSV
  for (const csvUrl of csvUrls) {
    try {
      const text  = await (await fetchWithRetry(csvUrl)).text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());

      lines.slice(1).forEach((line, i) => {
        const c  = parseCSVLine(line);
        const bw = toFloatStr(c[3] ?? '');
        const nm = sanitize(c[0]);
        if (!nm || bw <= 0) return;
        rows.push({
          company_name:       nm,
          industry:           sanitize(c[2]),
          violation_type:     'National Minimum Wage Underpayment',
          employees_affected: toInt(String(c[4] ?? '').replace(/\D/g, '')),
          amount_back_wages:  bw,
          amount_penalties:   toFloatStr(c[5] ?? ''),
          country:            'UK',
          year:               toInt(String(c[1] ?? '').replace(/\D/g, '')) || new Date().getFullYear(),
          case_id:            `UK-NMW-${nm.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${i}`,
          source_agency:      'HM Revenue & Customs — National Minimum Wage Enforcement',
          source_url:         'https://www.gov.uk/government/collections/national-minimum-wage-enforcement',
        });
      });
    } catch (err) {
      console.error('[HMRC CSV]', err.message);
    }
  }

  console.log(`[HMRC] ✓ finished — ${rows.length} valid rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇦🇺 Australia — Fair Work Ombudsman
// NOTE: FWO has NO public JSON API (/api/1.0/search does NOT exist)
// Correct source: RSS feeds of media releases + enforceable undertakings
// Licence: Creative Commons Attribution 3.0 Australia — no key
// Fetch time: ~5–12 seconds
// ══════════════════════════════════════════════════════════════════════════
export async function fetchAustralia() {
  const rows    = [];
  const rssUrls = [
    'https://www.fairwork.gov.au/newsroom/media-releases/rss',
    'https://www.fairwork.gov.au/about-us/compliance-and-enforcement/enforceable-undertakings/rss',
  ];

  for (const rssUrl of rssUrls) {
    try {
      const text  = await (await fetchWithRetry(rssUrl)).text();
      const items = parseRSS(text);

      for (const { title, desc, link, pubDate } of items) {
        const name = sanitize(extractEmployer(title));
        if (!name) continue;
        const amount = extractAmount(`${title} ${desc}`);
        const slug   = link.split('/').filter(Boolean).pop()?.slice(0, 40) ?? '';
        rows.push({
          company_name:      name,
          violation_type:    rssUrl.includes('enforceable') ? 'Enforceable Undertaking' : 'Fair Work Act Violation',
          amount_back_wages: amount,
          country:           'Australia',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `AU-FWO-${slug}`,
          source_agency:     'Fair Work Ombudsman — Australia',
          source_url:        link || 'https://www.fairwork.gov.au',
        });
      }
      console.log(`[FWO] RSS parsed — running total ${rows.length}`);
    } catch (err) {
      console.error(`[FWO ${rssUrl}]`, err.message);
    }
  }

  console.log(`[FWO] ✓ finished — ${rows.length} valid rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇨🇦 Canada — Employment & Social Development Canada
// API: open.canada.ca CKAN v3
// Verified Resource ID: 9fa42498-4f35-4dd5-8e0f-4a8d51e4ed6d
// (Part III Canada Labour Code violations)
// Licence: Open Government Licence Canada — no key
// Fetch time: ~10–20 seconds
// ══════════════════════════════════════════════════════════════════════════
export async function fetchCanada() {
  const rows        = [];
  const RESOURCE_ID = '9fa42498-4f35-4dd5-8e0f-4a8d51e4ed6d';

  try {
    const res  = await fetchWithRetry(
      `https://open.canada.ca/data/en/api/3/action/datastore_search?resource_id=${RESOURCE_ID}&limit=500`
    );
    const data    = await res.json();
    const records = data?.result?.records ?? [];

    if (!records.length) {
      console.warn('[ESDC] 0 records — verify resource_id at open.canada.ca');
      return rows;
    }

    for (const [i, r] of records.entries()) {
      const name = sanitize(r.employer_name ?? r['Employer Name'] ?? r.company ?? '');
      const bw   = toFloat(r.amount ?? r['Amount ($)'] ?? r.wages_owed ?? 0);
      if (!name || bw <= 0) continue;
      rows.push({
        company_name:       name,
        industry:           sanitize(r.industry ?? r['Industry'] ?? ''),
        violation_type:     sanitize(r.violation ?? r['Contravention'] ?? '') || 'Canada Labour Code Violation',
        employees_affected: toInt(r.employees ?? r['Number of Employees'] ?? 0),
        amount_back_wages:  bw,
        amount_penalties:   toFloat(r.penalty ?? r.fine ?? 0),
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

  console.log(`[ESDC] ✓ finished — ${rows.length} valid rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇮🇪 Ireland — Workplace Relations Commission
// The WRC publishes enforcement decisions publicly at workplacerelations.ie
// These are the closest EU equivalent to UK HMRC naming.
// RSS feed of decisions + search results page
// Licence: Public sector information directive (PSI) — free reuse
// Fetch time: ~8–15 seconds
// ══════════════════════════════════════════════════════════════════════════
export async function fetchIreland() {
  const rows = [];

  // WRC publishes decisions RSS and enforcement outcomes
  const rssUrls = [
    'https://www.workplacerelations.ie/en/news_media/press_releases/rss',
    'https://www.workplacerelations.ie/en/cases/adjudication_officer_decisions/rss',
  ];

  for (const rssUrl of rssUrls) {
    try {
      const text  = await (await fetchWithRetry(rssUrl)).text();
      const items = parseRSS(text);

      for (const { title, desc, link, pubDate } of items) {
        // Only pick items that look like enforcement / unpaid wages decisions
        const combined = `${title} ${desc}`.toLowerCase();
        const isRelevant = combined.includes('underpaid')
          || combined.includes('wage')
          || combined.includes('payment')
          || combined.includes('arrears')
          || combined.includes('minimum wage')
          || combined.includes('employment')
          || combined.includes('enforcement');
        if (!isRelevant) continue;

        const name   = sanitize(extractEmployer(title) ?? title.slice(0, 80));
        const amount = extractAmount(`${title} ${desc}`);
        const slug   = link.split('/').filter(Boolean).pop()?.slice(0, 40) ?? '';

        rows.push({
          company_name:      name,
          violation_type:    'WRC Employment Law Violation',
          amount_back_wages: amount,
          country:           'Ireland',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `IE-WRC-${slug}`,
          source_agency:     'Workplace Relations Commission — Ireland',
          source_url:        link || 'https://www.workplacerelations.ie',
        });
      }
      console.log(`[WRC-IE] parsed — running total ${rows.length}`);
    } catch (err) {
      console.error(`[WRC-IE ${rssUrl}]`, err.message);
    }
  }

  console.log(`[WRC-IE] ✓ finished — ${rows.length} valid rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇳🇱 Netherlands — Nederlandse Arbeidsinspectie (NLA)
// NLA publishes press releases on fines and enforcement actions
// Individual fine decisions (boetebesluiten) are public law
// RSS feed of news + enforcement press releases
// Licence: Netherlands Open Government Act (Woo) — public domain
// Fetch time: ~5–10 seconds
// ══════════════════════════════════════════════════════════════════════════
export async function fetchNetherlands() {
  const rows    = [];
  const rssUrls = [
    'https://www.nlarbeidsinspectie.nl/actueel/nieuws/rss',
    'https://www.nlarbeidsinspectie.nl/actueel/publicaties/rss',
  ];

  for (const rssUrl of rssUrls) {
    try {
      const text  = await (await fetchWithRetry(rssUrl)).text();
      const items = parseRSS(text);

      for (const { title, desc, link, pubDate } of items) {
        const combined = `${title} ${desc}`.toLowerCase();
        const isRelevant = combined.includes('boete')
          || combined.includes('minimumloon')
          || combined.includes('onderbetaling')
          || combined.includes('loon')
          || combined.includes('fine')
          || combined.includes('underpayment')
          || combined.includes('wage');
        if (!isRelevant) continue;

        const name   = sanitize(extractEmployer(title) ?? title.slice(0, 80));
        const amount = extractAmount(`${title} ${desc}`);
        const slug   = link.split('/').filter(Boolean).pop()?.slice(0, 40) ?? '';

        rows.push({
          company_name:      name,
          violation_type:    'Minimum Wage Violation (WML)',
          amount_back_wages: amount,
          country:           'Netherlands',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `NL-NLA-${slug}`,
          source_agency:     'Nederlandse Arbeidsinspectie — Netherlands Labour Authority',
          source_url:        link || 'https://www.nlarbeidsinspectie.nl',
        });
      }
    } catch (err) {
      console.error(`[NLA-NL ${rssUrl}]`, err.message);
    }
  }

  console.log(`[NLA-NL] ✓ finished — ${rows.length} valid rows`);
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
// 🇪🇺 Europe / ELA — European Labour Authority
// ELA publishes results of cross-border inspections
// Covers multiple EU countries (construction, transport, HORECA)
// RSS feed of news and inspection results
// Licence: EC Open Data — free reuse
// Fetch time: ~5–8 seconds
//
// NOTE: The EU has no single wage violation database.
// Germany, France, Spain etc. do NOT publish structured employer
// fine records as open data. The ELA RSS is the best EU-level source.
// Individual countries would require scraping in local languages.
// ══════════════════════════════════════════════════════════════════════════
export async function fetchEurope() {
  const rows    = [];
  const rssUrls = [
    'https://www.ela.europa.eu/en/rss/news',
    'https://www.ela.europa.eu/en/rss/press-releases',
  ];

  for (const rssUrl of rssUrls) {
    try {
      const text  = await (await fetchWithRetry(rssUrl)).text();
      const items = parseRSS(text);

      for (const { title, desc, link, pubDate } of items) {
        const combined = `${title} ${desc}`.toLowerCase();
        const isRelevant = combined.includes('inspection')
          || combined.includes('underpaid')
          || combined.includes('wage')
          || combined.includes('violation')
          || combined.includes('undeclared work')
          || combined.includes('enforcement')
          || combined.includes('fine');
        if (!isRelevant) continue;

        const amount = extractAmount(`${title} ${desc}`);
        const slug   = link.split('/').filter(Boolean).pop()?.slice(0, 40) ?? '';

        rows.push({
          company_name:      sanitize(title.slice(0, 120)),
          violation_type:    'EU Cross-Border Labour Inspection',
          amount_back_wages: amount,
          country:           'EU',
          year:              pubDate ? yearFrom(new Date(pubDate).toISOString()) : new Date().getFullYear(),
          case_id:           `EU-ELA-${slug}`,
          source_agency:     'European Labour Authority (ELA)',
          source_url:        link || 'https://www.ela.europa.eu',
        });
      }
    } catch (err) {
      console.error(`[ELA ${rssUrl}]`, err.message);
    }
  }

  console.log(`[ELA] ✓ finished — ${rows.length} valid rows`);
  return rows;
}
