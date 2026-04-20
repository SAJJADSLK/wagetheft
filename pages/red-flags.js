import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import AdSlot from '../components/AdSlot';

const FLAGS = [
  {
    category: 'Off-the-Clock Work',
    icon: '⏰',
    severity: 'high',
    items: [
      { flag: 'You are asked to clock out and continue working', detail: 'Any work performed must be compensated. "Volunteering" time at an employer\'s request or benefit is illegal in most jurisdictions.' },
      { flag: 'Mandatory pre-shift duties without pay (uniform, setup)', detail: 'Time spent donning required uniforms, safety gear, or performing setup tasks before clocking in must be paid.' },
      { flag: 'Post-shift work after clocking out (cleaning, cash-up)', detail: 'Closing duties, register reconciliation, and cleanup are compensable work time.' },
      { flag: 'Training or meetings not counted as work hours', detail: 'Mandatory training and meetings are work. They must appear on your timesheet and be paid.' },
    ],
  },
  {
    category: 'Overtime Violations',
    icon: '📊',
    severity: 'high',
    items: [
      { flag: 'No overtime pay after 40 hours (US) / 48 hours (UK/EU)', detail: 'In the US, hours over 40 per week must be paid at 1.5× your regular rate. Rules differ by country.' },
      { flag: 'Overtime rate calculated on base pay only (excluding bonuses)', detail: 'Many bonuses must be included in your "regular rate" before calculating overtime — employers often skip this.' },
      { flag: 'Being paid a "salary" to avoid overtime', detail: 'Most salaried workers earning below the threshold (~$684/week in the US) are still entitled to overtime.' },
      { flag: 'Hours spread across two weeks to avoid 40-hour threshold', detail: 'Overtime is calculated per workweek, not per pay period. Splitting hours doesn\'t legally reduce the requirement.' },
    ],
  },
  {
    category: 'Tip Theft & Pooling',
    icon: '💰',
    severity: 'high',
    items: [
      { flag: 'Manager or owner takes a share of the tip pool', detail: 'In the US, supervisors and managers are legally prohibited from participating in tip pools.' },
      { flag: 'Tips applied toward base wage without your knowledge', detail: 'Under the "tip credit," employers can pay less than minimum wage only with proper notice. Many don\'t give it.' },
      { flag: 'Service charges not passed to workers', detail: 'Mandatory service charges are not legally tips — employers can keep them, but workers must still receive minimum wage.' },
      { flag: 'Credit card processing fees deducted from tips', detail: 'Legal in most US states, but only the proportional fee may be deducted. Taking more is wage theft.' },
    ],
  },
  {
    category: 'Misclassification',
    icon: '📝',
    severity: 'medium',
    items: [
      { flag: 'Labelled "independent contractor" but work like an employee', detail: 'If your employer controls when, where, and how you work, you may legally be an employee entitled to full protections.' },
      { flag: 'No overtime, benefits, or protections as a "contractor"', detail: 'Misclassification denies workers minimum wage, overtime, and workers\' comp — often worth tens of thousands annually.' },
      { flag: 'Required to use company equipment as a "contractor"', detail: 'Using company tools and following their schedule are key indicators of employee status under most labour laws.' },
    ],
  },
  {
    category: 'Illegal Deductions',
    icon: '🔻',
    severity: 'medium',
    items: [
      { flag: 'Deductions for cash register shortages or breakages', detail: 'Deductions that bring pay below minimum wage are illegal. Some deductions require written consent.' },
      { flag: 'Uniform costs deducted from wages', detail: 'Costs that bring your effective hourly rate below minimum wage are prohibited in most jurisdictions.' },
      { flag: 'Tools or equipment charges not disclosed at hiring', detail: 'Required equipment deductions must be disclosed before work begins and cannot reduce pay below minimum wage.' },
      { flag: 'Repaying training costs when you leave', detail: 'Clawbacks for general training are often unenforceable. Specific certifications may be different.' },
    ],
  },
  {
    category: 'Payslip & Record Issues',
    icon: '🧾',
    severity: 'medium',
    items: [
      { flag: 'No payslip, or payslip doesn\'t itemise deductions', detail: 'Most countries require detailed payslips. No payslip is often a sign of wage theft.' },
      { flag: 'Payment in cash with no records', detail: 'Cash payment is legal, but records are still required. Cash-only is a major red flag for underpayment.' },
      { flag: 'Pay doesn\'t match agreed contract rate', detail: 'Any difference between contracted and actual pay is potentially recoverable, even years later.' },
      { flag: 'Hours rounded down consistently on your timesheet', detail: 'Consistent rounding in the employer\'s favour is wage theft. Rounding must be neutral over time.' },
    ],
  },
];

const SEVERITY_COLOR = { high: '#A32D2D', medium: '#854F0B', low: '#3B6D11' };
const SEVERITY_BG    = { high: '#fff5f5', medium: '#fffbf0', low: '#f0fff4' };

export default function RedFlags() {
  return (
    <>
      <Head>
        <title>Wage Theft Red Flags — How to Spot If Your Employer Is Stealing Your Wages</title>
        <meta name="description" content="A complete checklist of wage theft warning signs: off-the-clock work, overtime violations, tip theft, misclassification, and illegal deductions. Know your rights." />
        <link rel="canonical" href="https://wagetheft.live/red-flags" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'How to Spot Wage Theft: A Complete Red Flags Checklist',
          description: 'Learn the warning signs that your employer may be stealing your wages.',
          author: { '@type': 'Organization', name: 'WageTheft.live' },
          url: 'https://wagetheft.live/red-flags',
        })}} />
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <main style={{ flex: 1, background: '#f8f6f1' }}>

          <div style={{ background: '#1a1814', padding: '48px 40px' }}>
            <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
              <div style={{ fontSize: '10px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)', marginBottom: '12px' }}>Wage Theft Guide</div>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(36px, 4vw, 56px)', color: '#f8f6f1', fontWeight: 300, marginBottom: '16px', lineHeight: 1.1 }}>
                Red Flags: <em style={{ color: '#c9a84c' }}>Is Your Employer Stealing Your Wages?</em>
              </h1>
              <p style={{ fontSize: '14px', color: '#6b6560', fontWeight: 300, lineHeight: 1.8, maxWidth: '600px' }}>
                Wage theft is the most common crime in most countries — far exceeding robbery and burglary combined. Most victims never realise it's happening. Check these warning signs.
              </p>
            </div>
          </div>

          <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '48px 40px' }}>

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '48px' }}>
              {[
                { label: 'Calculate your wage gap', href: '/tools/calculator', icon: '🧮' },
                { label: 'Search employer records', href: '/search', icon: '🔍' },
                { label: 'Know your country\'s laws', href: '/rights', icon: '⚖️' },
              ].map(({ label, href, icon }) => (
                <Link key={href} href={href} style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '20px 24px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px', transition: 'border-color .2s' }} onMouseEnter={e => e.currentTarget.style.borderColor='#c9a84c'} onMouseLeave={e => e.currentTarget.style.borderColor='#e0dbd0'}>
                  <span style={{ fontSize: '24px' }}>{icon}</span>
                  <span style={{ fontSize: '13px', color: '#1a1814', fontWeight: 400 }}>{label} →</span>
                </Link>
              ))}
            </div>

            {FLAGS.map(({ category, icon, severity, items }) => (
              <div key={category} style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #e0dbd0' }}>
                  <span style={{ fontSize: '28px' }}>{icon}</span>
                  <div>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: '26px', fontWeight: 300, color: '#1a1814', lineHeight: 1 }}>{category}</h2>
                    <span style={{ fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: SEVERITY_COLOR[severity], fontFamily: 'var(--mono)' }}>
                      {severity === 'high' ? '⚠ High severity' : severity === 'medium' ? '● Medium severity' : '○ Check if applicable'}
                    </span>
                  </div>
                </div>

                {items.map(({ flag, detail }, i) => (
                  <div key={i} style={{ background: SEVERITY_BG[severity], border: `1px solid ${SEVERITY_COLOR[severity]}22`, padding: '20px 24px', marginBottom: '12px', borderLeft: `3px solid ${SEVERITY_COLOR[severity]}` }}>
                    <div style={{ fontSize: '15px', fontWeight: 500, color: '#1a1814', marginBottom: '8px' }}>
                      ✗ {flag}
                    </div>
                    <p style={{ fontSize: '13px', color: '#6b6560', fontWeight: 300, lineHeight: 1.7, margin: 0 }}>{detail}</p>
                  </div>
                ))}
              </div>
            ))}

            <AdSlot slot="leaderboard" style={{ margin: '32px 0' }} />

            {/* CTA */}
            <div style={{ background: '#1a1814', padding: '40px', textAlign: 'center' }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: '32px', fontWeight: 300, color: '#f8f6f1', marginBottom: '12px' }}>
                Spot a Red Flag?
              </h2>
              <p style={{ fontSize: '14px', color: '#6b6560', fontWeight: 300, marginBottom: '28px', lineHeight: 1.7 }}>
                Search our database of 232+ government enforcement records to see if your employer has a history of violations.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/search" style={{ background: '#8b6914', color: '#fff', padding: '14px 28px', textDecoration: 'none', fontSize: '12px', letterSpacing: '.14em', textTransform: 'uppercase', fontFamily: 'var(--mono)' }}>
                  Search Employer Database
                </Link>
                <Link href="/tools/calculator" style={{ background: 'transparent', color: '#f8f6f1', border: '1px solid #3a3228', padding: '14px 28px', textDecoration: 'none', fontSize: '12px', letterSpacing: '.14em', textTransform: 'uppercase', fontFamily: 'var(--mono)' }}>
                  Calculate Your Gap
                </Link>
              </div>
            </div>

          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
