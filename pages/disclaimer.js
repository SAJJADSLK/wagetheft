import Head from 'next/head';
import Nav from '../components/Nav';
import Footer from '../components/Footer';

const prose = { fontSize:'14px', color:'#6b6560', lineHeight:1.9, fontWeight:300, marginBottom:'14px' };

export default function Disclaimer() {
  return (
    <>
      <Head>
        <title>Disclaimer — WageTheft.live</title>
        <meta name="description" content="Legal disclaimer for WageTheft.live. Public government data provided for informational purposes only." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://wagetheft.live/disclaimer" />
      </Head>
      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>
        <Nav />
        <div style={{ background:'#1a1814', padding:'48px 40px 40px' }}>
          <div style={{ maxWidth:'760px', margin:'0 auto' }}>
            <h1 style={{ fontFamily:'var(--serif)', fontSize:'48px', fontWeight:300, color:'#f8f6f1' }}>Disclaimer</h1>
          </div>
        </div>
        <main style={{ flex:1, background:'#f8f6f1' }}>
          <div style={{ maxWidth:'760px', margin:'0 auto', padding:'48px 40px 72px' }}>
            <p style={prose}>The information published on WageTheft.live is provided for informational and research purposes only. While we endeavour to keep information accurate and current, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, or availability of the information displayed.</p>

            <p style={prose}><strong style={{ color:'#1a1814', fontWeight:500 }}>Data currency:</strong> Records may not reflect resolved violations, successful appeals, payment of owed wages, corrections issued after the original publication date, or any developments after the government agency's original publication. A record appearing on this site does not necessarily mean a violation is current or unresolved.</p>

            <p style={prose}><strong style={{ color:'#1a1814', fontWeight:500 }}>Verify at source:</strong> Every record links to its original government source. Users should verify information directly with the relevant government agency before making any decisions based on data displayed on this site.</p>

            <p style={prose}><strong style={{ color:'#1a1814', fontWeight:500 }}>Not legal advice:</strong> Nothing on this site constitutes legal advice. If you believe your wages have been stolen, consult a qualified employment attorney or contact the relevant government enforcement agency in your jurisdiction.</p>

            <p style={prose}><strong style={{ color:'#1a1814', fontWeight:500 }}>No affiliation:</strong> WageTheft.live is an independent aggregator and is not affiliated with, endorsed by, or connected to any government agency including the US Department of Labor, HMRC, Fair Work Ombudsman, or Employment and Social Development Canada.</p>

            <p style={prose}><strong style={{ color:'#1a1814', fontWeight:500 }}>Corrections:</strong> To report an error or a resolved case, contact <a href="mailto:data@wagetheft.live" style={{ color:'#8b6914' }}>data@wagetheft.live</a> with the original government source link.</p>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
