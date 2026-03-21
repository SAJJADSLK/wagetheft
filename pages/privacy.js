import Head from 'next/head';
import Nav from '../components/Nav';
import Footer from '../components/Footer';

const prose = { fontSize:'14px', color:'#6b6560', lineHeight:1.9, fontWeight:300, marginBottom:'14px' };
const h2    = { fontFamily:'var(--serif)', fontSize:'22px', fontWeight:400, color:'#1a1814', marginBottom:'14px', marginTop:'40px', paddingBottom:'10px', borderBottom:'1px solid #e0dbd0' };

export default function Privacy() {
  const updated = new Date().toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' });
  return (
    <>
      <Head>
        <title>Privacy Policy — WageTheft.live</title>
        <meta name="description" content="Privacy policy for WageTheft.live — how we collect, use and protect your data." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://wagetheft.live/privacy" />
      </Head>
      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>
        <Nav />
        <div style={{ background:'#1a1814', padding:'48px 40px 40px' }}>
          <div style={{ maxWidth:'760px', margin:'0 auto' }}>
            <h1 style={{ fontFamily:'var(--serif)', fontSize:'48px', fontWeight:300, color:'#f8f6f1' }}>Privacy Policy</h1>
            <p style={{ fontSize:'11px', color:'#4a4540', fontFamily:'var(--mono)', marginTop:'10px', letterSpacing:'.06em' }}>Last updated: {updated}</p>
          </div>
        </div>
        <main style={{ flex:1, background:'#f8f6f1' }}>
          <div style={{ maxWidth:'760px', margin:'0 auto', padding:'48px 40px 72px' }}>

            <p style={prose}>This Privacy Policy describes how WageTheft.live ("we", "us", "our") collects, uses and shares information when you visit our website at wagetheft.live.</p>

            <h2 style={{ ...h2, marginTop:0 }}>Information we collect</h2>
            <p style={prose}><strong style={{ color:'#1a1814', fontWeight:500 }}>Usage data:</strong> We collect standard server logs including IP address, browser type, pages visited, and visit time. This data is used solely for operating the site and is never sold.</p>
            <p style={prose}><strong style={{ color:'#1a1814', fontWeight:500 }}>Search queries:</strong> We log search queries anonymously to understand site usage. These logs contain no personally identifiable information.</p>
            <p style={prose}><strong style={{ color:'#1a1814', fontWeight:500 }}>Cookies:</strong> We use cookies for analytics (Google Analytics) and advertising (Google AdSense). You will be asked for consent before advertising cookies are set.</p>

            <h2 style={h2}>Google AdSense &amp; advertising</h2>
            <p style={prose}>We display advertisements provided by Google AdSense. Google may use cookies to show relevant advertisements based on your browsing history. You can opt out of personalised advertising at <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" style={{ color:'#8b6914' }}>google.com/settings/ads</a>.</p>
            <p style={prose}>We present a cookie consent banner to all visitors before any advertising cookies are set. EU/EEA visitors must accept before personalised ads are displayed, as required by GDPR and the ePrivacy Directive.</p>

            <h2 style={h2}>Google Analytics</h2>
            <p style={prose}>We use Google Analytics 4 to understand site traffic. IP addresses are anonymised. You may opt out via the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" style={{ color:'#8b6914' }}>Google Analytics opt-out add-on</a>.</p>

            <h2 style={h2}>GDPR — European users</h2>
            <p style={prose}>If you are in the EU or EEA, you have rights under GDPR including access, correction, and deletion of personal data. Our lawful basis for analytics processing is legitimate interests. For advertising cookies, we rely on your consent.</p>
            <p style={prose}>To exercise your rights, contact us at <a href="mailto:privacy@wagetheft.live" style={{ color:'#8b6914' }}>privacy@wagetheft.live</a>.</p>

            <h2 style={h2}>Data retention</h2>
            <p style={prose}>Server log data is retained for 30 days. Anonymised analytics data is retained for 26 months per Google Analytics defaults.</p>

            <h2 style={h2}>Third-party links</h2>
            <p style={prose}>Our site links to original government sources. We are not responsible for the privacy practices of those external sites.</p>

            <h2 style={h2}>Changes to this policy</h2>
            <p style={prose}>We may update this policy from time to time. The date at the top reflects the most recent revision.</p>

            <h2 style={h2}>Contact</h2>
            <p style={prose}><a href="mailto:privacy@wagetheft.live" style={{ color:'#8b6914' }}>privacy@wagetheft.live</a></p>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
