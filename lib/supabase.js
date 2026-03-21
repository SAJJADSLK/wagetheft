import { createClient } from '@supabase/supabase-js';

// ── Client (browser + SSR, anon key — read-only) ───────────────────────────
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.error('[supabase] Missing env vars: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(
  supabaseUrl  ?? '',
  supabaseAnon ?? '',
  { auth: { persistSession: false } }
);

// ── Admin client (server-only, service key — write access) ─────────────────
export function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) throw new Error('[supabase] Missing SUPABASE_SERVICE_KEY env var');
  return createClient(supabaseUrl ?? '', serviceKey, {
    auth: { persistSession: false },
  });
}

// ── Homepage stats ─────────────────────────────────────────────────────────
export async function getStats() {
  try {
    const { data, error } = await supabase
      .from('stats')
      .select('*')
      .eq('id', 1)
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[getStats]', err.message);
    return null;
  }
}

// ── Top offenders ──────────────────────────────────────────────────────────
export async function getTopOffenders(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('violations')
      .select('company_name, country, industry, employees_affected, amount_back_wages, amount_penalties, year')
      .gt('amount_back_wages', 0)
      .order('amount_back_wages', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error('[getTopOffenders]', err.message);
    return [];
  }
}

// ── Recent violations ──────────────────────────────────────────────────────
export async function getRecentViolations(limit = 8) {
  try {
    const { data, error } = await supabase
      .from('violations')
      .select('company_name, city, state_province, country, year, violation_type, amount_back_wages')
      .gt('amount_back_wages', 0)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error('[getRecentViolations]', err.message);
    return [];
  }
}

// ── Search violations ──────────────────────────────────────────────────────
export async function searchViolations(query = '', { country = '', page = 0, limit = 20 } = {}) {
  try {
    let q = supabase
      .from('violations')
      .select('*')
      .order('amount_back_wages', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (query.trim()) q = q.ilike('company_name', `%${query.trim()}%`);
    if (country)       q = q.eq('country', country);

    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error('[searchViolations]', err.message);
    return [];
  }
}

// ── Upsert violations (server-only, used by cron) ──────────────────────────
export async function upsertViolations(rows) {
  if (!rows?.length) return { count: 0 };
  try {
    const admin = getAdminClient();
    const { error, count } = await admin
      .from('violations')
      .upsert(rows, { onConflict: 'case_id', ignoreDuplicates: false })
      .select('id', { count: 'exact' });
    if (error) throw error;
    return { count: count ?? rows.length };
  } catch (err) {
    console.error('[upsertViolations]', err.message);
    throw err;
  }
}

// ── Refresh stats ──────────────────────────────────────────────────────────
export async function refreshStats() {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('violations')
      .select('amount_back_wages, employees_affected');
    if (error) throw error;

    const stats = {
      total_violations:       data.length,
      total_wages_stolen:     data.reduce((s, r) => s + (Number(r.amount_back_wages) || 0), 0),
      total_workers_affected: data.reduce((s, r) => s + (Number(r.employees_affected) || 0), 0),
      last_updated:           new Date().toISOString(),
    };

    const { error: uErr } = await admin
      .from('stats')
      .update(stats)
      .eq('id', 1);
    if (uErr) throw uErr;
    return stats;
  } catch (err) {
    console.error('[refreshStats]', err.message);
    throw err;
  }
}

// ── Log cron run ───────────────────────────────────────────────────────────
export async function logCron(source, recordsIn, status, error = null) {
  try {
    const admin = getAdminClient();
    await admin.from('cron_log').insert({ source, records_in: recordsIn, status, error });
  } catch (err) {
    console.error('[logCron]', err.message);
  }
}
