import Head from 'next/head';
import Nav from '../components/Nav';
import Footer from '../components/Footer';

const prose = { fontSize: '14px', color: '#6b6560', lineHeight: 1.9, fontWeight: 300, marginBottom: '14px' };
const h2    = { fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 400, color: '#1a1814', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e0dbd0', letterSpacing: '-.01em', marginTop: '48px' };

export default function About() {
  return (
    <>
      <Head>
        <title>About & Data Sources — WageTheft.live</title>
        <meta name="description" content="WageTheft.live aggregates public government wage enforcement records from the US, UK, Canada and Australia. Learn about our sources, methodology and legal basis." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://wagetheft.live/about" />
      </Head>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <div style={{ background: '#1a1814', padding: '56px 40px 48px' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(40px,5vw,64px)', fontWeight: 300, color: '#f8f6f1', letterSpacing: '-.01em' }}>
              About &amp; <em style={{ fontStyle: 'italic', color: '#c9a84c' }}>Data Sources</em>
            </h1>
          </div>
        </div>
        <main style={{ flex: 1, background: '#f8f6f1' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 40px 72px' }}>

            <h2 style={{ ...h2, marginTop: 0 }}>What is WageTheft.live?</h2>
            <p style={prose}>WageTheft.live is an independent public-interest aggregator that collects wage enforcement records from official government agencies across the United States, United Kingdom, Canada, Australia, Ireland, the Netherlands, and the European Union into a single searchable database.</p>
            <p style={prose}>Every record is sourced exclusively from official government enforcement publications freely available in the public domain. We do not generate, infer, or create any records — we only display what governments have already published.</p>

            <h2 style={h2}>Data sources</h2>
            {[
              { flag:'🇺🇸', country:'United States',  agency:'Department of Labor — Wage and Hour Division (WHD)',        desc:'Enforces the FLSA, Migrant and Seasonal Worker Protection Act, and Davis-Bacon Act. Data via api.dol.gov V1 OData API. ~200,000 records since FY 2005.', url:'https://enforcedata.dol.gov',          label:'enforcedata.dol.gov',          licence:'US Government Works — Public Domain' },
              { flag:'🇬🇧', country:'United Kingdom', agency:'HM Revenue & Customs — National Minimum Wage Enforcement',  desc:'HMRC publishes named employers who underpaid workers. Annual naming rounds (~524 employers in 2024). CSV via gov.uk Content API.', url:'https://www.gov.uk/government/collections/national-minimum-wage-enforcement', label:'gov.uk/nmw-enforcement', licence:'Open Government Licence v3.0' },
              { flag:'🇦🇺', country:'Australia',      agency:'Fair Work Ombudsman',                                       desc:'Prosecution outcomes, court orders, and enforceable undertakings published via RSS media releases. Note: FWO has no public JSON API.', url:'https://www.fairwork.gov.au', label:'fairwork.gov.au', licence:'Creative Commons Attribution 3.0 AU' },
              { flag:'🇨🇦', country:'Canada',         agency:'Employment and Social Development Canada (ESDC)',           desc:"Part III Canada Labour Code violation records via Government of Canada Open Data CKAN portal (resource ID: 9fa42498).", url:'https://open.canada.ca', label:'open.canada.ca', licence:'Open Government Licence — Canada' },
              { flag:'🇮🇪', country:'Ireland',        agency:'Workplace Relations Commission (WRC)',                      desc:"Ireland's employment law enforcement body. Publishes adjudication decisions and enforcement outcomes covering underpayment, minimum wage, and employment law breaches.", url:'https://www.workplacerelations.ie', label:'workplacerelations.ie', licence:'PSI Directive — free reuse' },
              { flag:'🇳🇱', country:'Netherlands',    agency:'Nederlandse Arbeidsinspectie — Netherlands Labour Authority',desc:'Enforces the Minimum Wage Act (WML). Fine decisions and enforcement actions published under the Dutch Open Government Act (Woo).', url:'https://www.nlarbeidsinspectie.nl', label:'nlarbeidsinspectie.nl', licence:'Netherlands Open Government Act (Woo)' },
              { flag:'🇪🇺', country:'EU / ELA',       agency:'European Labour Authority',                                desc:'Cross-border inspection results across EU Member States (construction, transport, HORECA). Note: no single EU-wide wage violation database exists. Individual EU states do not publish structured open data on employer fines.', url:'https://www.ela.europa.eu', label:'ela.europa.eu', licence:'EC Open Data Licence' },
            ].map(({ flag, country, agency, desc, url, label, licence }) => (
              <div key={country} style={{ background:'#fff', border:'1px solid #e0dbd0', padding:'24px 28px', marginBottom:'12px' }}>
                <div style={{ display:'flex', gap:'12px', alignItems:'flex-start', marginBottom:'10px' }}>
                  <span style={{ fontSize:'22px', lineHeight:1 }}>{flag}</span>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:500, color:'#1a1814', marginBottom:'3px' }}>{country} — {agency}</div>
                    <div style={{ fontSize:'10px', color:'#9a9488', fontFamily:'var(--mono)', letterSpacing:'.06em' }}>Licence: {licence}</div>
                  </div>
                </div>
                <p style={{ ...prose, fontSize:'13px', marginBottom:'12px' }}>{desc}</p>
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize:'11px', color:'#8b6914', fontFamily:'var(--mono)', letterSpacing:'.04em' }}>{label} ↗</a>
              </div>
            ))}

            <h2 style={h2}>Update frequency</h2>
            <p style={prose}>An automated Vercel serverless function fetches new enforcement data from all seven government sources every day at 06:00 UTC. New violations appear within one business day of their official government publication.</p>

            <h2 style={h2}>Legal basis</h2>
            <p style={prose}>All data is sourced from official government publications in the public domain or under open government licences that explicitly permit free reuse, including commercial use. We do not scrape paywalled sources or purchase private data. Facts — including company names and enforcement outcomes — cannot be copyrighted.</p>

            <h2 style={h2}>Contact</h2>
            <p style={prose}>For corrections, inaccuracy reports, or press enquiries: <a href="mailto:data@wagetheft.live" style={{ color:'#8b6914' }}>data@wagetheft.live</a></p>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
