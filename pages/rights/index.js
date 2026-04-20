import Head from 'next/head';
import Link from 'next/link';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import AdSlot from '../../components/AdSlot';

export const RIGHTS_PAGES = [
  { country: 'United States', slug: 'united-states', flag: '🇺🇸', minWage: '$7.25/hr federal (states vary)', overtimeThreshold: '40 hours/week', agency: 'Dept of Labor (WHD)', agencyUrl: 'https://www.dol.gov/agencies/whd/contact/complaints', color: '#1a3d7c' },
  { country: 'United Kingdom', slug: 'united-kingdom', flag: '🇬🇧', minWage: '£12.21/hr (21+)', overtimeThreshold: '48 hours/week average', agency: 'HMRC / Pay & Work Rights', agencyUrl: 'https://www.gov.uk/pay-and-work-rights', color: '#c8102e' },
  { country: 'Canada',        slug: 'canada',         flag: '🇨🇦', minWage: 'CA$16.65/hr+ (varies by province)', overtimeThreshold: '40 hours/week (federal)', agency: 'Employment & Social Dev. Canada', agencyUrl: 'https://www.canada.ca/en/employment-social-development/services/labour-standards/reports/complaint.html', color: '#d52b1e' },
  { country: 'Australia',     slug: 'australia',      flag: '🇦🇺', minWage: 'A$23.23/hr', overtimeThreshold: '38 hours/week ordinary', agency: 'Fair Work Ombudsman', agencyUrl: 'https://www.fairwork.gov.au/about-us/contact-us/online-complaints-form', color: '#00843d' },
  { country: 'Ireland',       slug: 'ireland',        flag: '🇮🇪', minWage: '€13.50/hr (2025)', overtimeThreshold: '48 hours/week average', agency: 'Workplace Relations Commission', agencyUrl: 'https://www.workplacerelations.ie/en/complaints_disputes/making_a_complaint_/', color: '#009a44' },
  { country: 'Netherlands',   slug: 'netherlands',    flag: '🇳🇱', minWage: '€14.06/hr (2025)', overtimeThreshold: '40 hours/week (varies by sector)', agency: 'NL Arbeidsinspectie', agencyUrl: 'https://www.nlarbeidsinspectie.nl/onderwerpen/melding-maken', color: '#ae1c28' },
  { country: 'Germany',       slug: 'germany',        flag: '🇩🇪', minWage: '€12.82/hr', overtimeThreshold: '48 hours/week (8hrs/day)', agency: 'Zoll / FKS', agencyUrl: 'https://www.zoll.de/DE/Privatpersonen/Arbeit/Schwarzarbeit-illegale-Beschaeftigung/Verdacht-melden/verdacht-melden_node.html', color: '#000000' },
  { country: 'France',        slug: 'france',         flag: '🇫🇷', minWage: '€11.88/hr (SMIC)', overtimeThreshold: '35 hours/week', agency: 'Inspection du Travail', agencyUrl: 'https://signalement.travail-emploi.gouv.fr/', color: '#0055a4' },
  { country: 'Italy',         slug: 'italy',          flag: '🇮🇹', minWage: 'No statutory minimum (sector CBAs)', overtimeThreshold: '40-48 hours/week', agency: 'Ispettorato Nazionale del Lavoro', agencyUrl: 'https://www.ispettorato.gov.it/it-it/segnalazioni/index.html', color: '#009246' },
  { country: 'Spain',         slug: 'spain',          flag: '🇪🇸', minWage: '€1,184/month (SMI 2025)', overtimeThreshold: '40 hours/week (max 80 OT/year)', agency: 'Inspección de Trabajo y SS', agencyUrl: 'https://www.mites.gob.es/itss/web/Tramites_y_Servicios/Denuncia/index.html', color: '#aa151b' },
];

export default function RightsHub() {
  return (
    <>
      <Head>
        <title>Know Your Labour Rights — Wage Laws by Country | WageTheft.live</title>
        <meta name="description" content="Minimum wage rates, overtime rules, and how to file a complaint in the US, UK, Canada, Australia, Ireland, Netherlands, Germany, France, Italy, and Spain." />
        <link rel="canonical" href="https://wagetheft.live/rights" />
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <main style={{ flex: 1, background: '#f8f6f1' }}>

          <div style={{ background: '#1a1814', padding: '48px 40px' }}>
            <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
              <div style={{ fontSize: '10px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)', marginBottom: '12px' }}>Know Your Rights</div>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(36px, 4vw, 56px)', color: '#f8f6f1', fontWeight: 300, marginBottom: '16px', lineHeight: 1.1 }}>
                Labour Law <em style={{ color: '#c9a84c' }}>By Country</em>
              </h1>
              <p style={{ fontSize: '14px', color: '#6b6560', fontWeight: 300, lineHeight: 1.8, maxWidth: '560px' }}>
                Minimum wages, overtime thresholds, and direct links to file a complaint with the enforcement agency in your country.
              </p>
            </div>
          </div>

          <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '48px 40px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', marginBottom: '48px' }}>
              {RIGHTS_PAGES.map(({ country, slug, flag, minWage, overtimeThreshold, agency, agencyUrl }) => (
                <div key={slug} style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '28px', transition: 'border-color .2s' }} onMouseEnter={e => e.currentTarget.style.borderColor='#c9a84c'} onMouseLeave={e => e.currentTarget.style.borderColor='#e0dbd0'}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>{flag}</div>
                  <h2 style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 300, color: '#1a1814', marginBottom: '16px' }}>{country}</h2>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#9a9488', fontFamily: 'var(--mono)', marginBottom: '4px' }}>Minimum Wage</div>
                    <div style={{ fontSize: '14px', color: '#1a1814', fontWeight: 400 }}>{minWage}</div>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#9a9488', fontFamily: 'var(--mono)', marginBottom: '4px' }}>Overtime Kicks In</div>
                    <div style={{ fontSize: '14px', color: '#1a1814', fontWeight: 400 }}>{overtimeThreshold}</div>
                  </div>

                  <div style={{ borderTop: '1px solid #f0ece4', paddingTop: '16px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    <Link href={`/rights/${slug}`} style={{ fontSize: '12px', color: '#8b6914', fontFamily: 'var(--mono)', textDecoration: 'none' }}>
                      Full rights guide →
                    </Link>
                    <a href={agencyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#A32D2D', fontFamily: 'var(--mono)', textDecoration: 'none' }}>
                      File a complaint with {agency} ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <AdSlot slot="leaderboard" />
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
