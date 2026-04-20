import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import AdSlot from '../components/AdSlot';
import ErrorState from '../components/ErrorState';
import { searchViolations } from '../lib/supabase';
import { fmtFull, fmtInt } from '../lib/format';

export default function Search({ initialResults, initialQuery, initialError }) {
  const router  = useRouter();
  const didMount = useRef(false);

  const [q,        setQ]        = useState(initialQuery ?? '');
  const [country,  setCountry]  = useState('');
  const [results,  setResults]  = useState(initialResults ?? []);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(initialError ?? false);
  const [page,     setPage]     = useState(0);
  const [hasMore,  setHasMore]  = useState((initialResults?.length ?? 0) === 20);

  // ── FIX: sync input when browser back/forward changes URL query ───────────
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    const urlQ = router.query.q ?? '';
    if (urlQ !== q) {
      setQ(urlQ);
      doSearch(urlQ, country, 0);
    }
  }, [router.query.q]);

  const doSearch = useCallback(async (query, ctry, pg = 0) => {
    setLoading(true);
    setError(false);
    try {
      const data = await searchViolations(query, { country: ctry || '', page: pg, limit: 20 });
      setResults(pg === 0 ? data : prev => [...prev, ...data]);
      setHasMore(data.length === 20);
      setPage(pg);
    } catch (err) {
      console.error('[search]', err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(q)}`, undefined, { shallow: true });
    doSearch(q, country, 0);
  };

  const handleCountry = (e) => {
    setCountry(e.target.value);
    doSearch(q, e.target.value, 0);
  };

  const title = initialQuery
    ? `"${initialQuery}" wage violations — WageTheft.live`
    : 'Search wage violations — WageTheft.live';

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={`Government-verified wage theft records${initialQuery ? ` for "${initialQuery}"` : ''} — US Dept of Labor, HMRC, Fair Work Australia.`} />
        <meta name="robots" content="index, follow" />
        {initialQuery && <link rel="canonical" href={`https://wagetheft.live/search?q=${encodeURIComponent(initialQuery)}`} />}
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <main style={{ flex: 1 }}>

          {/* Search bar */}
          <form
            onSubmit={handleSubmit}
            style={{ background: '#f8f6f1', borderBottom: '1px solid #e0dbd0', padding: '16px 40px', display: 'flex', gap: '12px', alignItems: 'center' }}
          >
            <span style={{ fontSize: '10px', letterSpacing: '.16em', textTransform: 'uppercase', color: '#9a9488', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
              Search records
            </span>
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Enter company name..."
              style={{ flex: 1, background: '#fff', border: '1px solid #e0dbd0', color: '#1a1814', fontSize: '14px', padding: '11px 18px', fontFamily: 'var(--sans)', outline: 'none', fontWeight: 300, transition: 'border-color .2s' }}
              onFocus={e => e.target.style.borderColor = '#8b6914'}
              onBlur={e  => e.target.style.borderColor = '#e0dbd0'}
            />
            <select
              value={country}
              onChange={handleCountry}
              style={{ background: '#fff', border: '1px solid #e0dbd0', color: '#9a9488', fontSize: '12px', padding: '11px 16px', fontFamily: 'var(--sans)', outline: 'none', letterSpacing: '.04em' }}
            >
              <option value="">All countries</option>
              <option value="USA">🇺🇸 United States</option>
              <option value="UK">🇬🇧 United Kingdom</option>
              <option value="Canada">🇨🇦 Canada</option>
              <option value="Australia">🇦🇺 Australia</option>
              <option value="Ireland">🇮🇪 Ireland</option>
              <option value="Netherlands">🇳🇱 Netherlands</option>
              <option value="Germany">🇩🇪 Germany</option>
              <option value="France">🇫🇷 France</option>
              <option value="Italy">🇮🇹 Italy</option>
              <option value="Spain">🇪🇸 Spain</option>
              <option value="Europe">🇪🇺 EU (Cross-border)</option>
            </select>
            <button
              type="submit"
              style={{ background: '#1a1814', border: 'none', color: '#f8f6f1', fontSize: '10px', fontWeight: 500, padding: '11px 24px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', transition: 'background .2s', whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.background = '#8b6914'}
              onMouseLeave={e => e.currentTarget.style.background = '#1a1814'}
            >
              Search
            </button>
          </form>

          <AdSlot slot="leaderboard" />

          <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '32px 40px' }}>

            {/* Error state */}
            {error && <ErrorState message="Search is temporarily unavailable. Please try again in a moment." onRetry={() => doSearch(q, country, 0)} />}

            {/* Loading state */}
            {loading && !error && (
              <p style={{ fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#c9a84c', fontFamily: 'var(--mono)', marginBottom: '20px' }}>
                Searching records…
              </p>
            )}

            {/* Results */}
            {!loading && !error && (
              <>
                <p style={{ fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#9a9488', fontFamily: 'var(--mono)', marginBottom: '20px' }}>
                  {results.length > 0
                    ? `${results.length}${hasMore ? '+' : ''} record${results.length !== 1 ? 's' : ''} found${q ? ` — "${q}"` : ''} — sorted by amount`
                    : q ? `No records found for "${q}"` : 'Enter a company name to search'}
                </p>

                {/* Bridge page — keeps users on site when no results */}
                {results.length === 0 && q && (
                  <div style={{ maxWidth: '720px' }}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '28px', fontWeight: 300, color: '#1a1814', marginBottom: '8px' }}>
                      No records found for <em style={{ color: '#8b6914' }}>{q}</em>
                    </div>
                    <p style={{ fontSize: '14px', color: '#6b6560', fontWeight: 300, lineHeight: 1.8, marginBottom: '32px' }}>
                      This company doesn't appear in our current enforcement database. That doesn't mean everything is fine — government data lags by months. Here's what you can do:
                    </p>
                    <div style={{ display: 'grid', gap: '12px', marginBottom: '32px' }}>
                      {[
                        { icon: '🧮', label: 'Calculate if your pay is correct', href: '/tools/calculator' },
                        { icon: '📋', label: 'Check our wage theft red flags guide', href: '/red-flags' },
                        { icon: '⚖️', label: 'Find your country\'s complaint agency', href: '/rights' },
                        { icon: '🔍', label: 'Try searching a partial name or parent company', href: null },
                      ].map(({ icon, label, href }) => href ? (
                        <a key={label} href={href} style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '16px 20px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px', transition: 'border-color .2s', color: '#1a1814' }} onMouseEnter={e => e.currentTarget.style.borderColor='#c9a84c'} onMouseLeave={e => e.currentTarget.style.borderColor='#e0dbd0'}>
                          <span style={{ fontSize: '20px' }}>{icon}</span>
                          <span style={{ fontSize: '13px', fontWeight: 400 }}>{label} →</span>
                        </a>
                      ) : (
                        <div key={label} style={{ background: '#f8f6f1', border: '1px solid #e0dbd0', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <span style={{ fontSize: '20px' }}>{icon}</span>
                          <span style={{ fontSize: '13px', color: '#9a9488', fontWeight: 300 }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.map((v, i) => (
                  <div key={v.id ?? i}>
                    {/* Result card */}
                    <div
                      style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '28px', marginBottom: '12px', transition: 'border-color .2s', cursor: 'default' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#c9a84c'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#e0dbd0'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: '16px' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 500, color: '#1a1814', letterSpacing: '-.01em', marginBottom: '4px' }}>
                            <Link href={`/company/${v.company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`} style={{ color: '#1a1814', textDecoration: 'none', transition: 'color .2s' }} onMouseEnter={e => e.currentTarget.style.color='#8b6914'} onMouseLeave={e => e.currentTarget.style.color='#1a1814'}>
                              {v.company_name}
                            </Link>
                          </div>
                          {v.trade_name && v.trade_name !== v.company_name && (
                            <div style={{ fontSize: '10px', color: '#9a9488', fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>
                              Trading as: {v.trade_name}
                            </div>
                          )}
                        </div>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: '36px', fontWeight: 300, color: '#8b6914', letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>
                          {fmtFull(v.amount_back_wages, v.country)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {[v.city && v.state_province ? `${v.city}, ${v.state_province}` : v.city, v.country, v.year, v.industry].filter(Boolean).map((tag, ti) => (
                          <span key={ti} style={{ fontSize: '10px', padding: '3px 9px', border: '1px solid #e0dbd0', color: '#9a9488', fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>
                            {tag}
                          </span>
                        ))}
                      </div>

                      {v.violation_type && (
                        <div style={{ fontSize: '13px', color: '#6b6560', marginBottom: '18px', fontWeight: 300, lineHeight: 1.7 }}>
                          {v.violation_type}
                        </div>
                      )}

                      <div style={{ borderTop: '1px solid #ece8e0', paddingTop: '14px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {v.employees_affected > 0 && (
                          <span style={{ fontSize: '11px', color: '#9a9488', fontFamily: 'var(--mono)' }}>
                            <strong style={{ color: '#6b6560' }}>{fmtInt(v.employees_affected)}</strong> workers affected
                          </span>
                        )}
                        {v.amount_penalties > 0 && (
                          <span style={{ fontSize: '11px', color: '#9a9488', fontFamily: 'var(--mono)' }}>
                            <strong style={{ color: '#6b6560' }}>{fmtFull(v.amount_penalties, v.country)}</strong> civil penalties
                          </span>
                        )}
                        {v.source_agency && (
                          <a
                            href={v.source_url ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '11px', color: '#9a9488', fontFamily: 'var(--mono)', marginLeft: 'auto', transition: 'color .2s' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#8b6914'}
                            onMouseLeave={e => e.currentTarget.style.color = '#9a9488'}
                          >
                            {v.source_agency} ↗
                          </a>
                        )}
                      </div>
                    </div>

                    {/* AdSense after every 5th result */}
                    {(i + 1) % 5 === 0 && i < results.length - 1 && (
                      <AdSlot slot="article" style={{ margin: '12px 0' }} />
                    )}
                  </div>
                ))}

                {hasMore && !loading && (
                  <button
                    onClick={() => doSearch(q, country, page + 1)}
                    style={{ display: 'block', width: '100%', marginTop: '20px', padding: '16px', background: 'transparent', border: '1px solid #e0dbd0', color: '#9a9488', fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all .2s', fontFamily: 'var(--mono)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b6914'; e.currentTarget.style.color = '#8b6914'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0dbd0'; e.currentTarget.style.color = '#9a9488'; }}
                  >
                    Load more results
                  </button>
                )}
              </>
            )}
          </div>

          <AdSlot slot="rectangle" />
        </main>
        <Footer />
      </div>
    </>
  );
}

export async function getServerSideProps({ query }) {
  const q = String(query.q ?? '').trim().slice(0, 200);
  try {
    const data = await searchViolations(q, { limit: 20 });
    return { props: { initialResults: data, initialQuery: q, initialError: false } };
  } catch (err) {
    console.error('[search getServerSideProps]', err.message);
    return { props: { initialResults: [], initialQuery: q, initialError: true } };
  }
}
