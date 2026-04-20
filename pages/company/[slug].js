import Head from 'next/head';
import Link from 'next/link';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import AdSlot from '../../components/AdSlot';
import { supabase } from '../../lib/supabase';
import { fmtFull, fmtInt } from '../../lib/format';

const COMPLAINT_LINKS = {
  USA:         'https://www.dol.gov/agencies/whd/contact/complaints',
  UK:          'https://www.gov.uk/pay-and-work-rights',
  Canada:      'https://www.canada.ca/en/employment-social-development/services/labour-standards/reports/complaint.html',
  Australia:   'https://www.fairwork.gov.au/about-us/contact-us/online-complaints-form',
  Ireland:     'https://www.workplacerelations.ie/en/complaints_disputes/making_a_complaint_/',
  Netherlands: 'https://www.nlarbeidsinspectie.nl/onderwerpen/melding-maken',
  Germany:     'https://www.zoll.de/DE/Privatpersonen/Arbeit/Schwarzarbeit-illegale-Beschaeftigung/Verdacht-melden/verdacht-melden_node.html',
  France:      'https://signalement.travail-emploi.gouv.fr/',
  Italy:       'https://www.ispettorato.gov.it/it-it/segnalazioni/index.html',
  Spain:       'https://www.mites.gob.es/itss/web/Tramites_y_Servicios/Denuncia/index.html',
};

const FLAG = { USA:'🇺🇸', UK:'🇬🇧', Canada:'🇨🇦', Australia:'🇦🇺', Ireland:'🇮🇪', Netherlands:'🇳🇱', Germany:'🇩🇪', France:'🇫🇷', Italy:'🇮🇹', Spain:'🇪🇸', Europe:'🇪🇺' };

export default function CompanyProfile({ company, violations, notFound, slug }) {
  if (notFound) return <NotFoundBridge slug={slug} />;

  const totalBackWages = violations.reduce((s, v) => s + (v.amount_back_wages || 0), 0);
  const totalPenalties = violations.reduce((s, v) => s + (v.amount_penalties  || 0), 0);
  const totalWorkers   = violations.reduce((s, v) => s + (v.employees_affected || 0), 0);
  const countries      = [...new Set(violations.map(v => v.country).filter(Boolean))];
  const latestYear     = Math.max(...violations.map(v => v.year || 0).filter(Boolean));
  const complaintUrl   = COMPLAINT_LINKS[violations[0]?.country] || '#';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${company} — Wage Theft Enforcement Records`,
    description: `${violations.length} government-recorded wage violations for ${company}. Total back wages: ${fmtFull(totalBackWages, violations[0]?.country)}.`,
    url: `https://wagetheft.live/company/${slug}`,
    creator: { '@type': 'Organization', name: 'WageTheft.live' },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    temporalCoverage: `${Math.min(...violations.map(v => v.year || 2020).filter(Boolean))}/${latestYear}`,
  };

  return (
    <>
      <Head>
        <title>{company} Wage Violations — {violations.length} Records | WageTheft.live</title>
        <meta name="description" content={`${violations.length} government-recorded wage theft violations for ${company}. Total back wages owed: ${fmtFull(totalBackWages, violations[0]?.country)}. Source: official enforcement agencies.`} />
        <link rel="canonical" href={`https://wagetheft.live/company/${slug}`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <main style={{ flex: 1, background: '#f8f6f1' }}>

          {/* Header */}
          <div style={{ background: '#1a1814', padding: '48px 40px' }}>
            <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
              <div style={{ fontSize: '10px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)', marginBottom: '14px' }}>
                Company Profile · {countries.map(c => FLAG[c] || '').join(' ')} {countries.join(' / ')}
              </div>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 4vw, 56px)', color: '#f8f6f1', fontWeight: 300, marginBottom: '12px', lineHeight: 1.1 }}>
                {company}
              </h1>
              <p style={{ fontSize: '14px', color: '#6b6560', fontWeight: 300 }}>
                {violations.length} government-verified enforcement record{violations.length !== 1 ? 's' : ''}
                {latestYear ? ` · Most recent: ${latestYear}` : ''}
              </p>
            </div>
          </div>

          <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '40px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '40px' }}>

            {/* Main column */}
            <div>
              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                {[
                  { label: 'Total Back Wages', value: fmtFull(totalBackWages, violations[0]?.country) },
                  { label: 'Civil Penalties',  value: fmtFull(totalPenalties, violations[0]?.country) },
                  { label: 'Workers Affected', value: totalWorkers > 0 ? fmtInt(totalWorkers) : 'N/A' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '20px 24px' }}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '28px', fontWeight: 300, color: '#8b6914', marginBottom: '4px' }}>{stat.value}</div>
                    <div style={{ fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#9a9488', fontFamily: 'var(--mono)' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Violations list */}
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 300, marginBottom: '20px', color: '#1a1814' }}>
                Enforcement Records
              </h2>

              {violations.map((v, i) => (
                <div key={i}>
                  <div style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '24px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontSize: '13px', color: '#1a1814', fontWeight: 500, marginBottom: '4px' }}>{v.violation_type || 'Wage Violation'}</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {[v.city && v.state_province ? `${v.city}, ${v.state_province}` : (v.city || v.state_province), v.country, v.year, v.industry].filter(Boolean).map((tag, ti) => (
                            <span key={ti} style={{ fontSize: '10px', padding: '2px 8px', border: '1px solid #e0dbd0', color: '#9a9488', fontFamily: 'var(--mono)' }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {v.amount_back_wages > 0 && <div style={{ fontFamily: 'var(--serif)', fontSize: '28px', fontWeight: 300, color: '#8b6914' }}>{fmtFull(v.amount_back_wages, v.country)}</div>}
                        {v.amount_penalties > 0  && <div style={{ fontSize: '11px', color: '#9a9488', fontFamily: 'var(--mono)' }}>+{fmtFull(v.amount_penalties, v.country)} penalty</div>}
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid #f0ece4', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {v.employees_affected > 0 && <span style={{ fontSize: '11px', color: '#9a9488', fontFamily: 'var(--mono)' }}>{fmtInt(v.employees_affected)} workers affected</span>}
                      <a href={v.source_url || '#'} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#9a9488', fontFamily: 'var(--mono)', marginLeft: 'auto', transition: 'color .2s' }} onMouseEnter={e => e.currentTarget.style.color='#8b6914'} onMouseLeave={e => e.currentTarget.style.color='#9a9488'}>
                        {v.source_agency} ↗
                      </a>
                    </div>
                  </div>
                  {(i + 1) % 3 === 0 && <AdSlot slot="article" style={{ margin: '12px 0' }} />}
                </div>
              ))}
            </div>

            {/* Sidebar */}
            <aside>
              {/* File a complaint */}
              <div style={{ background: '#fff', border: '2px solid #c9a84c', padding: '24px', marginBottom: '20px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)', marginBottom: '10px' }}>Take Action</div>
                <p style={{ fontSize: '13px', color: '#1a1814', lineHeight: 1.7, marginBottom: '16px', fontWeight: 300 }}>
                  If you believe you have experienced wage theft from {company}, you can file an official complaint with the government.
                </p>
                <a href={complaintUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: '#1a1814', color: '#f8f6f1', textAlign: 'center', padding: '12px', fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'var(--mono)', transition: 'background .2s' }} onMouseEnter={e => e.currentTarget.style.background='#8b6914'} onMouseLeave={e => e.currentTarget.style.background='#1a1814'}>
                  File a Complaint ↗
                </a>
              </div>

              {/* Know your rights */}
              <div style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '24px', marginBottom: '20px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#9a9488', fontFamily: 'var(--mono)', marginBottom: '10px' }}>Know Your Rights</div>
                {countries.map(c => (
                  <Link key={c} href={`/rights/${c.toLowerCase().replace(/\s+/g,'-')}`} style={{ display: 'block', fontSize: '13px', color: '#8b6914', textDecoration: 'none', marginBottom: '8px', fontWeight: 300 }}>
                    {FLAG[c]} {c} Labour Law Guide →
                  </Link>
                ))}
                <Link href="/tools/calculator" style={{ display: 'block', fontSize: '13px', color: '#8b6914', textDecoration: 'none', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0ece4', fontWeight: 300 }}>
                  🧮 Calculate Your Wage Gap →
                </Link>
              </div>

              {/* Red flags */}
              <div style={{ background: '#fff5f5', border: '1px solid #f5d0d0', padding: '24px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#A32D2D', fontFamily: 'var(--mono)', marginBottom: '10px' }}>Common Red Flags</div>
                {['Off-the-clock work required', 'Tips kept by management', 'Misclassified as contractor', 'No overtime after 40hrs', 'Illegal pay deductions'].map((flag, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#6b6560', marginBottom: '8px', paddingLeft: '14px', position: 'relative', lineHeight: 1.5 }}>
                    <span style={{ position: 'absolute', left: 0, color: '#A32D2D' }}>·</span>
                    {flag}
                  </div>
                ))}
                <Link href="/red-flags" style={{ display: 'block', fontSize: '11px', color: '#A32D2D', textDecoration: 'none', marginTop: '12px', fontFamily: 'var(--mono)' }}>
                  Full checklist →
                </Link>
              </div>

              <AdSlot slot="rectangle" style={{ marginTop: '20px' }} />
            </aside>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

// Bridge page for companies NOT in database
function NotFoundBridge({ slug }) {
  const company = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return (
    <>
      <Head>
        <title>{company} — No Records Found | WageTheft.live</title>
        <meta name="description" content={`No government wage violation records found for ${company}. Learn how to check your payslip and what to do if you suspect wage theft.`} />
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <main style={{ flex: 1, maxWidth: '760px', margin: '0 auto', padding: '64px 40px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#9a9488', fontFamily: 'var(--mono)', marginBottom: '20px' }}>No enforcement records found</div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '40px', fontWeight: 300, color: '#1a1814', marginBottom: '16px', lineHeight: 1.2 }}>
            No records found for <em style={{ fontStyle: 'italic', color: '#8b6914' }}>{company}</em>
          </h1>
          <p style={{ fontSize: '14px', color: '#6b6560', lineHeight: 1.85, fontWeight: 300, marginBottom: '40px' }}>
            This company doesn't appear in our current government enforcement database. This could mean they have a clean record, appear under a different legal entity name, or their violations haven't been published yet. Here's what you can do:
          </p>

          <div style={{ display: 'grid', gap: '16px', marginBottom: '48px' }}>
            {[
              { icon: '🧮', title: 'Check your payslip', desc: 'Use our Wage Calculator to see if your pay is correct based on hours worked.', href: '/tools/calculator', cta: 'Calculate now →' },
              { icon: '🔍', title: 'Search by parent company', desc: 'Companies often operate under different legal names. Try searching a partial name or holding company.', href: '/search', cta: 'Search database →' },
              { icon: '📋', title: 'Check for red flags', desc: 'Review our checklist of common wage theft warning signs that may apply to your situation.', href: '/red-flags', cta: 'View checklist →' },
              { icon: '⚖️', title: 'File a complaint anyway', desc: 'You can file a complaint with your government\'s labour authority even if the company doesn\'t appear here yet.', href: '/rights', cta: 'Find your agency →' },
            ].map(({ icon, title, desc, href, cta }) => (
              <div key={title} style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '24px', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '24px', flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 500, color: '#1a1814', marginBottom: '6px' }}>{title}</div>
                  <p style={{ fontSize: '13px', color: '#6b6560', fontWeight: 300, lineHeight: 1.7, marginBottom: '10px' }}>{desc}</p>
                  <Link href={href} style={{ fontSize: '12px', color: '#8b6914', fontFamily: 'var(--mono)', textDecoration: 'none' }}>{cta}</Link>
                </div>
              </div>
            ))}
          </div>

          <AdSlot slot="leaderboard" />
        </main>
        <Footer />
      </div>
    </>
  );
}

export async function getStaticPaths() {
  const { data } = await supabase
    .from('violations')
    .select('company_name')
    .limit(500);

  const paths = (data || []).map(v => ({
    params: { slug: v.company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') },
  }));

  return { paths, fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  const { slug } = params;

  // Find all violations matching this slug
  const { data: all } = await supabase
    .from('violations')
    .select('*')
    .order('amount_back_wages', { ascending: false });

  const violations = (all || []).filter(v => {
    const s = (v.company_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return s === slug;
  });

  if (violations.length === 0) {
    return { props: { notFound: true, slug, company: '', violations: [] }, revalidate: 86400 };
  }

  return {
    props: {
      company:    violations[0].company_name,
      violations: JSON.parse(JSON.stringify(violations)),
      notFound:   false,
      slug,
    },
    revalidate: 3600,
  };
}
