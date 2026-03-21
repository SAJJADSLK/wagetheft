import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{ background: '#1a1814', padding: '44px 40px' }}>
      <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #2a2520', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, letterSpacing: '.04em', color: '#f8f6f1' }}>
            Wage<em style={{ fontStyle: 'italic', color: '#8b6914' }}>Theft</em>.live
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {[['About & Data Sources','/about'],['Privacy Policy','/privacy'],['Disclaimer','/disclaimer']].map(([label, href]) => (
              <Link key={href} href={href} style={{ fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#4a4540' }}>{label}</Link>
            ))}
          </div>
        </div>
        <p style={{ fontSize: '11px', color: '#4a4540', lineHeight: 1.9, fontWeight: 300, maxWidth: '820px', marginBottom: '16px' }}>
          Data sourced from the US Department of Labor Wage and Hour Division, HMRC National Minimum Wage Enforcement (United Kingdom), Fair Work Ombudsman (Australia), and Employment and Social Development Canada. All records constitute public government enforcement information. Provided for informational purposes only. Records may not reflect resolved violations, successful appeals, or post-publication corrections. Always verify with the original government source.
        </p>
        <p style={{ fontSize: '10px', color: '#2a2520', fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>
          © {new Date().getFullYear()} WageTheft.live — Independent public data aggregator. Not affiliated with any government agency.
        </p>
      </div>
    </footer>
  );
}
