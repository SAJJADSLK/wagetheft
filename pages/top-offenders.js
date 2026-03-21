import Head from 'next/head';
import { useRouter } from 'next/router';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import AdSlot from '../components/AdSlot';
import ErrorState from '../components/ErrorState';
import { getTopOffenders } from '../lib/supabase';
import { fmtFull, fmtInt } from '../lib/format';

export default function TopOffenders({ offenders, error }) {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Largest Wage Theft Violations — WageTheft.live</title>
        <meta name="description" content="The 100 largest government-documented wage theft violations in the US, UK, Canada and Australia, ranked by total back wages owed." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://wagetheft.live/top-offenders" />
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <main style={{ flex: 1 }}>
          <div style={{ background: '#1a1814', padding: '56px 40px 48px' }}>
            <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#8b6914', marginBottom: '18px', fontFamily: 'var(--mono)' }}>
                <span style={{ display: 'block', width: '24px', height: '1px', background: '#8b6914' }} />
                Government Records
              </div>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 300, color: '#f8f6f1', letterSpacing: '-.01em', marginBottom: '14px' }}>
                Largest recorded <em style={{ fontStyle: 'italic', color: '#c9a84c' }}>violations</em>
              </h1>
              <p style={{ fontSize: '14px', color: '#6b6560', fontWeight: 300, maxWidth: '560px', lineHeight: 1.8 }}>
                Government-verified cases ranked by total back wages ordered. All figures sourced from official enforcement agencies.
              </p>
            </div>
          </div>

          <AdSlot slot="leaderboard" />

          <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '40px 40px' }}>
            {error ? (
              <ErrorState message="Unable to load violation data. Please refresh the page." />
            ) : offenders.length === 0 ? (
              <p style={{ color: '#9a9488', fontSize: '14px', fontWeight: 300, padding: '48px 0' }}>
                Data is being loaded from government sources. Check back shortly.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #1a1814' }}>
                      {['Rank','Company','Country','Industry','Workers affected','Civil penalties','Wages stolen'].map((h, i) => (
                        <th key={i} style={{ padding: i === 0 ? '10px 16px 14px 0' : '10px 16px 14px', textAlign: 'left', fontSize: '10px', letterSpacing: '.15em', textTransform: 'uppercase', color: '#9a9488', fontFamily: 'var(--mono)', fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {offenders.map((v, i) => (
                      <tr
                        key={i}
                        style={{ borderBottom: '1px solid #ece8e0', cursor: 'pointer' }}
                        onClick={() => router.push(`/search?q=${encodeURIComponent(v.company_name)}`)}
                        onMouseEnter={e => e.currentTarget.style.background = '#f0ece4'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '20px 16px 20px 0', fontFamily: 'var(--mono)', fontSize: '11px', color: '#c0bab0', width: '40px' }}>{String(i + 1).padStart(2, '0')}</td>
                        <td style={{ padding: '20px 16px', fontWeight: 500, color: '#1a1814', fontSize: '14px', letterSpacing: '-.01em' }}>{v.company_name}</td>
                        <td style={{ padding: '20px 16px' }}><span style={{ fontSize: '10px', padding: '3px 9px', border: '1px solid #e0dbd0', color: '#9a9488', fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>{v.country}</span></td>
                        <td style={{ padding: '20px 16px', fontSize: '12px', color: '#9a9488' }}>{v.industry ?? '—'}</td>
                        <td style={{ padding: '20px 16px', fontFamily: 'var(--mono)', fontSize: '12px', color: '#6b6560' }}>{v.employees_affected > 0 ? fmtInt(v.employees_affected) : '—'}</td>
                        <td style={{ padding: '20px 16px', fontFamily: 'var(--mono)', fontSize: '12px', color: '#6b6560' }}>{v.amount_penalties > 0 ? fmtFull(v.amount_penalties, v.country) : '—'}</td>
                        <td style={{ padding: '20px 16px', fontFamily: 'var(--mono)', color: '#8b6914', fontSize: '14px', fontWeight: 400 }}>{fmtFull(v.amount_back_wages, v.country)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <AdSlot slot="rectangle" />
        </main>
        <Footer />
      </div>
    </>
  );
}

export async function getServerSideProps() {
  try {
    const offenders = await getTopOffenders(100);
    return { props: { offenders, error: false } };
  } catch (err) {
    console.error('[top-offenders]', err.message);
    return { props: { offenders: [], error: true } };
  }
}
