import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import AdSlot from '../components/AdSlot';
import { getStats, getTopOffenders, getRecentViolations } from '../lib/supabase';
import { fmtFull, fmtNum, fmtInt } from '../lib/format';

export default function Home({ stats, topOffenders, recent, error }) {
  const router = useRouter();
  const [q, setQ] = useState('');

  const doSearch = (e) => {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const hasData = !error && stats && stats.total_violations > 0;

  return (
    <>
      <Head>
        <title>WageTheft.live — Search Employer Wage Theft Records</title>
        <meta name="description" content="Search government-verified wage theft violations across the US, UK, Canada and Australia. Official data from Dept of Labor, HMRC, Fair Work Australia. Free and updated daily." />
        <meta property="og:title"       content="WageTheft.live — Government Wage Theft Records" />
        <meta property="og:description" content="Search 300,000+ government-verified wage theft violations. Free. Updated daily." />
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content="https://wagetheft.live" />
        <meta name="robots"             content="index, follow" />
        <link rel="canonical"           href="https://wagetheft.live" />
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <main style={{ flex: 1 }}>

          {/* ── Hero ──────────────────────────────────────────── */}
          <section style={{ background: '#1a1814', padding: '72px 40px 64px' }}>
            <div style={{ maxWidth: '1140px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 360px', gap: '80px', alignItems: 'center' }}>

              {/* Left */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10px', letterSpacing: '.22em', textTransform: 'uppercase', color: '#8b6914', marginBottom: '28px', fontFamily: 'var(--mono)' }}>
                  <span style={{ display: 'block', width: '28px', height: '1px', background: '#8b6914' }} />
                  Public Government Enforcement Records
                </div>
                <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(52px, 6vw, 80px)', lineHeight: .92, color: '#f8f6f1', fontWeight: 300, marginBottom: '24px', letterSpacing: '-.01em' }}>
                  Did your employer<br />steal your<br /><em style={{ fontStyle: 'italic', color: '#c9a84c' }}>wages?</em>
                </h1>
                <p style={{ fontSize: '14px', color: '#6b6560', lineHeight: 1.85, fontWeight: 300, marginBottom: '36px', maxWidth: '440px' }}>
                  Search government-verified wage theft violations across the United States, United Kingdom, Canada and Australia. All data sourced directly from official enforcement agencies and updated every 24 hours.
                </p>
                <form onSubmit={doSearch}>
                  <div style={{ display: 'flex', border: '1px solid #3a3228', background: '#251f18', overflow: 'hidden' }}>
                    <input
                      type="text"
                      value={q}
                      onChange={e => setQ(e.target.value)}
                      placeholder="Enter a company name..."
                      aria-label="Search company name"
                      autoComplete="off"
                      style={{ flex: 1, background: 'transparent', border: 'none', color: '#f8f6f1', fontSize: '14px', padding: '15px 20px', fontFamily: 'var(--sans)', outline: 'none', fontWeight: 300 }}
                    />
                    <button
                      type="submit"
                      style={{ background: '#8b6914', border: 'none', color: '#f8f6f1', fontSize: '10px', fontWeight: 500, padding: '15px 24px', letterSpacing: '.16em', textTransform: 'uppercase', cursor: 'pointer', transition: 'background .2s', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#c9a84c'}
                      onMouseLeave={e => e.currentTarget.style.background = '#8b6914'}
                    >
                      Search Records
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                    {['Food service', 'Construction', 'Retail', 'Healthcare', 'Hospitality'].map(term => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => router.push(`/search?q=${encodeURIComponent(term)}`)}
                        style={{ background: 'transparent', border: '1px solid #3a3228', color: '#4a4540', fontSize: '10px', padding: '5px 12px', letterSpacing: '.06em', cursor: 'pointer', transition: 'all .2s', fontFamily: 'var(--mono)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b6914'; e.currentTarget.style.color = '#c9a84c'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a3228'; e.currentTarget.style.color = '#4a4540'; }}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </form>
              </div>

              {/* Right — Stats */}
              <div style={{ borderLeft: '1px solid #2a2520', paddingLeft: '60px' }}>
                {error ? (
                  <p style={{ color: '#4a4540', fontSize: '13px', fontWeight: 300 }}>
                    Statistics temporarily unavailable.
                  </p>
                ) : !hasData ? (
                  <p style={{ color: '#4a4540', fontSize: '13px', fontWeight: 300 }}>
                    Data is being loaded from government sources. Check back shortly.
                  </p>
                ) : (
                  [
                    { val: `$${fmtNum(stats.total_wages_stolen)}`,      lbl: 'Total wages stolen on record'          },
                    { val: `${fmtNum(stats.total_violations)}+`,         lbl: 'Government violations documented'      },
                    { val: `${fmtNum(stats.total_workers_affected)}`,    lbl: 'Workers affected across 4 countries'   },
                    { val: '4 Countries',                                 lbl: 'US · UK · Canada · Australia'          },
                  ].map(({ val, lbl }, i) => (
                    <div key={i} style={{ padding: '22px 0', borderBottom: i < 3 ? '1px solid #2a2520' : 'none' }}>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: '38px', fontWeight: 300, color: '#f8f6f1', letterSpacing: '-.01em', marginBottom: '6px', lineHeight: 1 }}>
                        <em style={{ fontStyle: 'italic', color: '#c9a84c' }}>{val}</em>
                      </div>
                      <div style={{ fontSize: '10px', letterSpacing: '.16em', textTransform: 'uppercase', color: '#4a4540', fontFamily: 'var(--mono)' }}>
                        {lbl}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* ── AdSense leaderboard ────────────────────────────── */}
          <AdSlot slot="leaderboard" />

          {/* ── Top Offenders ─────────────────────────────────── */}
          {topOffenders.length > 0 && (
            <div style={{ borderBottom: '1px solid #e0dbd0' }}>
              <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '52px 40px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '28px' }}>
                  <h2 style={{ fontFamily: 'var(--serif)', fontSize: '34px', fontWeight: 300, color: '#1a1814', letterSpacing: '-.01em' }}>
                    Largest recorded violations
                  </h2>
                  <Link href="/top-offenders" style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)' }}>
                    Full database →
                  </Link>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #1a1814' }}>
                        {['', 'Company', 'Country', 'Industry', 'Workers affected', 'Wages stolen'].map((h, i) => (
                          <th key={i} style={{ padding: i === 0 ? '10px 16px 14px 0' : '10px 16px 14px', textAlign: 'left', fontSize: '10px', letterSpacing: '.15em', textTransform: 'uppercase', color: '#9a9488', fontFamily: 'var(--mono)', fontWeight: 400 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {topOffenders.map((v, i) => (
                        <tr
                          key={i}
                          style={{ borderBottom: '1px solid #ece8e0', cursor: 'pointer' }}
                          onClick={() => router.push(`/search?q=${encodeURIComponent(v.company_name)}`)}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0ece4'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '18px 16px 18px 0', fontFamily: 'var(--mono)', fontSize: '11px', color: '#c0bab0', width: '32px' }}>
                            {String(i + 1).padStart(2, '0')}
                          </td>
                          <td style={{ padding: '18px 16px', fontWeight: 500, color: '#1a1814', fontSize: '14px', letterSpacing: '-.01em' }}>
                            {v.company_name}
                          </td>
                          <td style={{ padding: '18px 16px' }}>
                            <span style={{ fontSize: '10px', padding: '3px 9px', border: '1px solid #e0dbd0', color: '#9a9488', fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>
                              {v.country}
                            </span>
                          </td>
                          <td style={{ padding: '18px 16px', fontSize: '12px', color: '#9a9488' }}>{v.industry ?? '—'}</td>
                          <td style={{ padding: '18px 16px', fontFamily: 'var(--mono)', fontSize: '12px', color: '#6b6560' }}>
                            {v.employees_affected > 0 ? fmtInt(v.employees_affected) : '—'}
                          </td>
                          <td style={{ padding: '18px 16px', fontFamily: 'var(--mono)', color: '#8b6914', fontSize: '13px', fontWeight: 400 }}>
                            {fmtFull(v.amount_back_wages, v.country)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── AdSense rectangle ──────────────────────────────── */}
          <AdSlot slot="rectangle" />

          {/* ── Recently Published ─────────────────────────────── */}
          {recent.length > 0 && (
            <div style={{ background: '#fdfcf8', borderBottom: '1px solid #e0dbd0' }}>
              <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '52px 40px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '28px' }}>
                  <h2 style={{ fontFamily: 'var(--serif)', fontSize: '34px', fontWeight: 300, color: '#1a1814', letterSpacing: '-.01em' }}>
                    Recently published
                  </h2>
                  <Link href="/search" style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)' }}>
                    Browse all records →
                  </Link>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {recent.map((v, i) => (
                    <div
                      key={i}
                      style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '20px', cursor: 'pointer', transition: 'border-color .2s' }}
                      onClick={() => router.push(`/search?q=${encodeURIComponent(v.company_name)}`)}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#8b6914'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#e0dbd0'}
                    >
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1814', marginBottom: '5px', letterSpacing: '-.01em' }}>{v.company_name}</div>
                      <div style={{ fontSize: '10px', color: '#9a9488', fontFamily: 'var(--mono)', marginBottom: '10px', letterSpacing: '.04em' }}>
                        {v.city ? `${v.city}${v.state_province ? `, ${v.state_province}` : ''} · ` : ''}{v.country}{v.year ? ` · ${v.year}` : ''}
                      </div>
                      {v.violation_type && (
                        <div style={{ fontSize: '11px', color: '#9a9488', marginBottom: '14px', lineHeight: 1.6, fontWeight: 300 }}>{v.violation_type}</div>
                      )}
                      <div style={{ height: '1px', background: '#e0dbd0', marginBottom: '12px' }} />
                      <div style={{ fontSize: '15px', color: '#8b6914', fontFamily: 'var(--mono)', fontWeight: 400 }}>
                        {fmtFull(v.amount_back_wages, v.country)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Trust bar ──────────────────────────────────────── */}
          <div style={{ background: '#1a1814', padding: '28px 40px', display: 'flex', borderTop: '1px solid #2a2520', overflowX: 'auto' }}>
            {[
              { agency: 'US Dept of Labor',    desc: 'Wage & Hour Division enforcement records' },
              { agency: 'HMRC United Kingdom', desc: 'National Minimum Wage naming rounds' },
              { agency: 'Fair Work Australia', desc: 'Ombudsman prosecution outcomes' },
              { agency: 'ESDC Canada',         desc: 'Labour Code violation records' },
              { agency: 'WRC Ireland',         desc: 'Workplace Relations Commission' },
              { agency: 'NLA Netherlands',     desc: 'Labour Authority fine decisions' },
              { agency: 'ELA European Union',  desc: 'Cross-border inspection results' },
            ].map(({ agency, desc }, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: '160px', padding: '0 20px', borderRight: i < arr.length - 1 ? '1px solid #2a2520' : 'none' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8b6914', marginTop: '5px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#c9a84c', fontFamily: 'var(--mono)', marginBottom: '4px' }}>{agency}</div>
                  <div style={{ fontSize: '11px', color: '#4a4540', fontWeight: 300, lineHeight: 1.6 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── How it works ───────────────────────────────────── */}
          <div style={{ borderBottom: '1px solid #e0dbd0' }}>
            <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '52px 40px' }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: '34px', fontWeight: 300, color: '#1a1814', letterSpacing: '-.01em', marginBottom: '28px' }}>
                How it works
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#e0dbd0', border: '1px solid #e0dbd0', overflow: 'hidden' }}>
                {[
                  { n: 'I',   h: 'Public government data only',  p: 'Every record comes directly from official enforcement agencies — US Dept of Labor, HMRC, Fair Work Ombudsman, ESDC Canada, Ireland WRC, Netherlands NLA, and the European Labour Authority. No private data, no paywalled sources.' },
                  { n: 'II',  h: 'Refreshed every 24 hours',     p: 'An automated Vercel serverless cron function fetches from all seven government sources daily at 06:00 UTC. New violations appear within one business day of their official government publication.' },
                  { n: 'III', h: 'Always free',                   p: 'No account required. No paywall. No subscription. Workers and job seekers deserve free access to public enforcement records before accepting employment.' },
                ].map(({ n, h, p }) => (
                  <div key={n} style={{ background: '#fdfcf8', padding: '32px 28px' }}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '56px', fontWeight: 300, color: '#e0dbd0', marginBottom: '14px', lineHeight: 1, fontStyle: 'italic' }}>{n}</div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1814', marginBottom: '10px', letterSpacing: '-.01em' }}>{h}</div>
                    <div style={{ fontSize: '12px', color: '#9a9488', lineHeight: 1.85, fontWeight: 300 }}>{p}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </main>
        <Footer />
      </div>
    </>
  );
}

export async function getServerSideProps() {
  try {
    const [stats, topOffenders, recent] = await Promise.all([
      getStats(),
      getTopOffenders(10),
      getRecentViolations(8),
    ]);
    return {
      props: {
        stats:        stats        ?? null,
        topOffenders: topOffenders ?? [],
        recent:       recent       ?? [],
        error:        false,
      },
    };
  } catch (err) {
    console.error('[index getServerSideProps]', err.message);
    return {
      props: { stats: null, topOffenders: [], recent: [], error: true },
    };
  }
}
