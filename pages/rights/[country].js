import Head from 'next/head';
import Link from 'next/link';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import AdSlot from '../../components/AdSlot';
import { RIGHTS_PAGES } from './index';

const DETAIL = {
  'united-states': {
    laws: ['Fair Labor Standards Act (FLSA)', 'National Labor Relations Act (NLRA)', 'State minimum wage laws (40+ states exceed federal minimum)'],
    keyRules: [
      { title: 'Minimum Wage', body: 'Federal minimum is $7.25/hr but most states have higher rates. California is $16.50/hr, New York $16.00/hr, Washington $16.28/hr. Your employer must pay whichever is higher.' },
      { title: 'Overtime', body: 'All non-exempt employees must receive 1.5× their regular rate for hours over 40/week. Most workers earning under $684/week cannot be classified as "exempt." Day-rate and piece-rate workers also qualify.' },
      { title: 'Tip Rules', body: 'Under the 2018 FLSA amendment, employers cannot take tips from workers. Mandatory service charges are not tips. Tip pools can only include employees who regularly receive tips — not managers.' },
      { title: 'Statute of Limitations', body: 'You can recover wages going back 2 years (3 years for wilful violations). Act quickly — every day you wait reduces what you can claim.' },
    ],
    industries: ['Restaurant & Hospitality', 'Retail', 'Agriculture', 'Home Care', 'Construction', 'Gig/App-based work'],
    complaintUrl: 'https://www.dol.gov/agencies/whd/contact/complaints',
    legalAid: 'https://www.lawhelp.org',
    statAgency: 'US Department of Labor — Wage and Hour Division',
  },
  'united-kingdom': {
    laws: ['National Minimum Wage Act 1998', 'Working Time Regulations 1998', 'Employment Rights Act 1996'],
    keyRules: [
      { title: 'National Living Wage', body: 'From April 2025: £12.21/hr for workers aged 21+. £10.00/hr for 18-20 year olds. £7.55/hr for under 18s and apprentices. Your employer must pay at least these rates.' },
      { title: 'Working Time', body: 'You cannot be required to work more than 48 hours per week on average (calculated over 17 weeks). You may opt out in writing, but cannot be penalised for refusing.' },
      { title: 'HMRC Enforcement', body: 'HMRC names employers who fail to pay the National Minimum Wage. Penalties of up to 200% of underpayments are levied. The "naming scheme" is updated twice yearly.' },
      { title: 'Time Limits', body: 'Employment tribunal claims must typically be filed within 3 months minus one day of the act complained of. Acas early conciliation can pause this clock.' },
    ],
    industries: ['Care & Social Work', 'Hospitality', 'Retail', 'Cleaning & Security', 'Delivery/Courier'],
    complaintUrl: 'https://www.gov.uk/pay-and-work-rights',
    legalAid: 'https://www.citizensadvice.org.uk',
    statAgency: 'HM Revenue & Customs (HMRC)',
  },
  'canada': {
    laws: ['Canada Labour Code (federally regulated)', 'Provincial Employment Standards Acts', 'Canada Human Rights Act'],
    keyRules: [
      { title: 'Minimum Wage', body: 'Federal minimum wage is CA$17.30/hr (April 2024). Provincial minimums vary: Ontario CA$17.20, BC CA$17.40, Alberta CA$15.00. Federal covers ~10% of workers; most fall under provincial rules.' },
      { title: 'Overtime', body: 'Federal: overtime after 40 hours/week at 1.5×. Most provinces set thresholds between 40-44 hours. Some sectors (agriculture, professionals) have exemptions.' },
      { title: 'Public Naming', body: 'ESDC publicly names employers who violate the Canada Labour Code and fail to comply with payment orders. Names stay on the government website for 3 years.' },
      { title: 'Time Limits', body: 'Federal claims must be filed within 6 months of the last date of work. Provincial limits vary from 6 months to 2 years. Don\'t delay.' },
    ],
    industries: ['Trucking & Transport', 'Banking & Finance', 'Telecom', 'Agriculture', 'Construction', 'Restaurants'],
    complaintUrl: 'https://www.canada.ca/en/employment-social-development/services/labour-standards/reports/complaint.html',
    legalAid: 'https://www.legalaid.ca',
    statAgency: 'Employment and Social Development Canada',
  },
  'australia': {
    laws: ['Fair Work Act 2009', 'National Employment Standards (NES)', 'Modern Awards & Enterprise Agreements'],
    keyRules: [
      { title: 'National Minimum Wage', body: 'A$23.23/hr (July 2024) or A$882.80/week. Most workers are covered by Modern Awards that set higher minimum rates by industry and classification. Check your Award.' },
      { title: 'Ordinary Hours', body: '38 ordinary hours/week for full-time workers. Additional hours must be paid at penalty rates: typically 1.5× for first 2 hours, then 2× — though Awards vary.' },
      { title: 'Sham Contracting', body: 'It\'s illegal to disguise an employment relationship as a contractor arrangement. The Fair Work Ombudsman actively investigates and penalises sham contracting.' },
      { title: 'Time Limits', body: 'Fair Work claims must generally be filed within 6 years. However, it\'s best to act quickly — evidence is easier to gather while the work is recent.' },
    ],
    industries: ['Hospitality & Cafes', 'Retail', 'Agriculture', 'Aged Care', 'Cleaning', 'Construction'],
    complaintUrl: 'https://www.fairwork.gov.au/about-us/contact-us/online-complaints-form',
    legalAid: 'https://www.fwa.gov.au',
    statAgency: 'Fair Work Ombudsman',
  },
  'ireland': {
    laws: ['Employment Equality Acts 1998-2015', 'National Minimum Wage Act 2000', 'Organisation of Working Time Act 1997'],
    keyRules: [
      { title: 'National Minimum Wage', body: '€13.50/hr from January 2025. Youth rates: €9.45/hr for under 18. €10.80/hr for workers in first year of employment. Most collective agreements set higher rates.' },
      { title: 'Working Time', body: 'Maximum 48 hours/week average (over 4 months). At least 11 consecutive hours rest per day. 24 hours rest per week. 15-minute break for shifts over 4.5 hours.' },
      { title: 'WRC Enforcement', body: 'The Workplace Relations Commission investigates complaints, issues decisions, and can require back pay and compensation. Decisions can be appealed to the Labour Court.' },
      { title: 'Time Limits', body: 'WRC complaints must be submitted within 6 months of the contravention. This can be extended to 12 months for reasonable cause.' },
    ],
    industries: ['Hospitality', 'Retail', 'Agriculture', 'Construction', 'Cleaning', 'Care Sector'],
    complaintUrl: 'https://www.workplacerelations.ie/en/complaints_disputes/making_a_complaint_/',
    legalAid: 'https://www.flac.ie',
    statAgency: 'Workplace Relations Commission (WRC)',
  },
  'netherlands': {
    laws: ['Wet minimumloon (WML)', 'Arbeidstijdenwet (ATW)', 'Wet Aanpak Schijnconstructies (WAS)'],
    keyRules: [
      { title: 'Minimum Wage', body: '€14.06/hr from January 2025 (age 21+). Youth minimums for ages 15-20 apply as a percentage. Sectors with CAO (collective agreements) often pay more.' },
      { title: 'Working Hours', body: 'Maximum 60 hours/week (average 48 over 16 weeks). Minimum 11 hours rest between shifts. Sector-specific rules often apply through collective agreements.' },
      { title: 'FKS Enforcement', body: 'The Netherlands Labour Authority (NLA) and Customs (Zoll) enforce wage laws, particularly in logistics, agriculture, and construction. Fines are significant.' },
      { title: 'Time Limits', body: '5-year prescription period for most wage claims. However, evidence can be difficult to obtain after time passes — act early.' },
    ],
    industries: ['Logistics', 'Agriculture', 'Cleaning', 'Construction', 'Hospitality', 'Domestic Work'],
    complaintUrl: 'https://www.nlarbeidsinspectie.nl/onderwerpen/melding-maken',
    legalAid: 'https://www.juridischloket.nl',
    statAgency: 'Nederlandse Arbeidsinspectie (NLA)',
  },
  'germany': {
    laws: ['Mindestlohngesetz (MiLoG)', 'Arbeitszeitgesetz (ArbZG)', 'Tarifvertragsgesetz (TVG)'],
    keyRules: [
      { title: 'Minimum Wage', body: '€12.82/hr (January 2024). Construction, postal workers, and other sectors have higher sector-specific minimums set by collective agreements (Tarifverträge).' },
      { title: 'Working Hours', body: 'Maximum 8 hours/day, up to 10 hours if compensated within 6 months. Rest period of at least 11 hours after each shift. 30-minute break for 6+ hour shifts.' },
      { title: 'Schwarzarbeit Enforcement', body: 'The Finanzkontrolle Schwarzarbeit (FKS) within Customs (Zoll) actively inspects construction, restaurant, and logistics sectors. Penalties include fines up to €500,000.' },
      { title: 'Time Limits', body: '3-year statute of limitations for wage claims, running from end of calendar year in which claim arose. Many collective agreements have shorter contractual deadlines.' },
    ],
    industries: ['Construction', 'Restaurants & Cafes', 'Logistics', 'Meat Processing', 'Cleaning', 'Agriculture'],
    complaintUrl: 'https://www.zoll.de/DE/Privatpersonen/Arbeit/Schwarzarbeit-illegale-Beschaeftigung/Verdacht-melden/verdacht-melden_node.html',
    legalAid: 'https://www.faire-integration.de',
    statAgency: 'Zoll — Finanzkontrolle Schwarzarbeit (FKS)',
  },
  'france': {
    laws: ['Code du Travail', 'Loi relative à la transparence dans les rémunérations', 'Loi El Khomri'],
    keyRules: [
      { title: 'SMIC', body: 'Salaire Minimum Interprofessionnel de Croissance (SMIC): €11.88/hr gross (2024). Most sectors have higher rates set by collective conventions (conventions collectives).' },
      { title: 'Working Time', body: 'Legal working week is 35 hours. Hours 36-43 paid at 1.25×, hours 44+ at 1.5×. Forfait jours (day-rate) executives are exempt but must have 11-hour rest periods.' },
      { title: 'Inspection du Travail', body: 'Labour inspectors (inspection du travail) can access premises, examine records, and issue penalties. Workers can report anonymously. Employers face fines and criminal prosecution.' },
      { title: 'Time Limits', body: '3-year limitation period for wage claims (since 2013 reform). Prud\'hommes (industrial tribunals) handle most disputes. Filing pauses the limitation period.' },
    ],
    industries: ['Restaurants & Cafés', 'Retail', 'Agriculture', 'Construction', 'Home Care', 'Security'],
    complaintUrl: 'https://signalement.travail-emploi.gouv.fr/',
    legalAid: 'https://www.aide-juridictionnelle.justice.fr',
    statAgency: 'Inspection du Travail (DREETS)',
  },
  'italy': {
    laws: ['Statuto dei Lavoratori (L. 300/1970)', 'Codice Civile Art. 2099-2120', 'D.lgs. 81/2015 (Jobs Act)'],
    keyRules: [
      { title: 'Minimum Wage', body: 'Italy has no statutory national minimum wage. Minimum pay is set by sector-specific collective bargaining agreements (contratti collettivi nazionali di lavoro, CCNL). Coverage is near-universal.' },
      { title: 'Working Hours', body: 'Maximum 40 ordinary hours/week under most CCNLs. Overtime limit is typically 250 hours/year. Overtime rates set by CCNL (usually 15-25% premium).' },
      { title: 'INL Enforcement', body: 'The Ispettorato Nazionale del Lavoro (INL) conducts inspections and investigates violations. INPS (social security) also investigates undeclared work.' },
      { title: 'Time Limits', body: '5-year limitation period for wage claims (during employment). Rights must be exercised within 5 years of termination. Many CCNLs specify shorter contractual deadlines.' },
    ],
    industries: ['Agriculture', 'Construction', 'Logistics', 'Fashion & Textile', 'Food Processing', 'Tourism'],
    complaintUrl: 'https://www.ispettorato.gov.it/it-it/segnalazioni/index.html',
    legalAid: 'https://www.cgil.it',
    statAgency: 'Ispettorato Nazionale del Lavoro (INL)',
  },
  'spain': {
    laws: ['Estatuto de los Trabajadores (ET)', 'Real Decreto 902/2020 (pay equality)', 'Ley 14/1994 (ETT)'],
    keyRules: [
      { title: 'SMI', body: 'Salario Mínimo Interprofesional: €1,184/month (14 payments/year = €16,576/year) in 2025. Many sector collective agreements (convenios colectivos) set higher rates.' },
      { title: 'Working Hours', body: 'Maximum 40 hours/week ordinary time. Maximum 80 hours overtime per year (unless collective agreement permits more). Overtime must be compensated or given as rest time.' },
      { title: 'ITSS Enforcement', body: 'Inspección de Trabajo y Seguridad Social carries out inspections, especially in agriculture, construction, and domestic work. Sanctions range from €626 to €187,515.' },
      { title: 'Time Limits', body: '1-year limitation period for most wage claims from when they become due. File with SMAC (conciliation service) before going to tribunal — this is mandatory.' },
    ],
    industries: ['Agriculture', 'Tourism & Hotels', 'Construction', 'Domestic Work', 'Retail', 'Fishing'],
    complaintUrl: 'https://www.mites.gob.es/itss/web/Tramites_y_Servicios/Denuncia/index.html',
    legalAid: 'https://www.icam.es',
    statAgency: 'Inspección de Trabajo y Seguridad Social (ITSS)',
  },
};

export default function CountryRights({ page, detail }) {
  if (!page || !detail) return null;

  return (
    <>
      <Head>
        <title>Wage & Labour Rights in {page.country} — Minimum Wage, Overtime, How to Complain | WageTheft.live</title>
        <meta name="description" content={`${page.country} labour law guide: minimum wage ${page.minWage}, overtime rules, how to file a complaint with ${detail.statAgency}. Know your rights.`} />
        <link rel="canonical" href={`https://wagetheft.live/rights/${page.slug}`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: `Labour Rights in ${page.country}: Minimum Wage, Overtime & How to File a Complaint`,
          description: `Complete guide to wage and labour rights in ${page.country}.`,
          author: { '@type': 'Organization', name: 'WageTheft.live' },
          url: `https://wagetheft.live/rights/${page.slug}`,
        })}} />
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <main style={{ flex: 1, background: '#f8f6f1' }}>

          <div style={{ background: '#1a1814', padding: '48px 40px' }}>
            <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)', marginBottom: '12px' }}>
                <Link href="/rights" style={{ color: '#8b6914', textDecoration: 'none' }}>Know Your Rights</Link>
                <span style={{ color: '#3a3228' }}>›</span>
                {page.country}
              </div>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(36px, 4vw, 56px)', color: '#f8f6f1', fontWeight: 300, marginBottom: '16px', lineHeight: 1.1 }}>
                {page.flag} Labour Rights in <em style={{ color: '#c9a84c' }}>{page.country}</em>
              </h1>
              <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#6b6560', fontFamily: 'var(--mono)' }}>Min. Wage</div>
                  <div style={{ fontSize: '18px', color: '#c9a84c', fontFamily: 'var(--serif)' }}>{page.minWage}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#6b6560', fontFamily: 'var(--mono)' }}>Overtime After</div>
                  <div style={{ fontSize: '18px', color: '#c9a84c', fontFamily: 'var(--serif)' }}>{page.overtimeThreshold}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '48px 40px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '48px' }}>

            <div>
              {/* Key rules */}
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: '26px', fontWeight: 300, color: '#1a1814', marginBottom: '24px' }}>Key Rules</h2>
              {detail.keyRules.map(({ title, body }) => (
                <div key={title} style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '24px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 500, color: '#1a1814', marginBottom: '8px' }}>{title}</div>
                  <p style={{ fontSize: '13px', color: '#6b6560', fontWeight: 300, lineHeight: 1.8, margin: 0 }}>{body}</p>
                </div>
              ))}

              <AdSlot slot="leaderboard" style={{ margin: '32px 0' }} />

              {/* Applicable laws */}
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: '26px', fontWeight: 300, color: '#1a1814', marginBottom: '20px' }}>Applicable Laws</h2>
              <div style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '24px', marginBottom: '32px' }}>
                {detail.laws.map((law, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#6b6560', fontWeight: 300, padding: '8px 0', borderBottom: i < detail.laws.length - 1 ? '1px solid #f0ece4' : 'none', fontFamily: 'var(--mono)' }}>
                    · {law}
                  </div>
                ))}
              </div>

              {/* High-risk industries */}
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: '26px', fontWeight: 300, color: '#1a1814', marginBottom: '20px' }}>High-Risk Industries</h2>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '32px' }}>
                {detail.industries.map(ind => (
                  <span key={ind} style={{ fontSize: '12px', padding: '6px 14px', border: '1px solid #e0dbd0', color: '#6b6560', fontFamily: 'var(--mono)', background: '#fff' }}>{ind}</span>
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <aside>
              <div style={{ background: '#fff', border: '2px solid #c9a84c', padding: '24px', marginBottom: '20px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)', marginBottom: '10px' }}>File a Complaint</div>
                <p style={{ fontSize: '13px', color: '#6b6560', fontWeight: 300, lineHeight: 1.7, marginBottom: '16px' }}>
                  Contact {detail.statAgency} to report an unpaid wage violation.
                </p>
                <a href={page.agencyUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: '#A32D2D', color: '#fff', textAlign: 'center', padding: '12px', fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'var(--mono)' }}>
                  File Complaint Now ↗
                </a>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '24px', marginBottom: '20px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#9a9488', fontFamily: 'var(--mono)', marginBottom: '10px' }}>Free Legal Help</div>
                <a href={detail.legalAid} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '13px', color: '#8b6914', textDecoration: 'none', marginBottom: '12px', fontWeight: 300 }}>
                  Legal Aid Resources ↗
                </a>
                <Link href="/tools/calculator" style={{ display: 'block', fontSize: '13px', color: '#8b6914', textDecoration: 'none', fontWeight: 300 }}>
                  🧮 Calculate Your Wage Gap →
                </Link>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '24px', marginBottom: '20px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#9a9488', fontFamily: 'var(--mono)', marginBottom: '10px' }}>Other Countries</div>
                {RIGHTS_PAGES.filter(p => p.slug !== page.slug).slice(0, 6).map(p => (
                  <Link key={p.slug} href={`/rights/${p.slug}`} style={{ display: 'block', fontSize: '13px', color: '#6b6560', textDecoration: 'none', marginBottom: '8px', fontWeight: 300, transition: 'color .15s' }} onMouseEnter={e => e.currentTarget.style.color='#8b6914'} onMouseLeave={e => e.currentTarget.style.color='#6b6560'}>
                    {p.flag} {p.country}
                  </Link>
                ))}
              </div>

              <AdSlot slot="rectangle" />
            </aside>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

export async function getStaticPaths() {
  return { paths: RIGHTS_PAGES.map(p => ({ params: { country: p.slug } })), fallback: false };
}

export async function getStaticProps({ params }) {
  const page   = RIGHTS_PAGES.find(p => p.slug === params.country);
  const detail = DETAIL[params.country];
  if (!page || !detail) return { notFound: true };
  return { props: { page, detail } };
}
