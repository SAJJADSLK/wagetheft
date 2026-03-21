import { useEffect, useState } from 'react';
import Head from 'next/head';
import '../styles/globals.css';

// ── GDPR Consent Banner ────────────────────────────────────────────────────
// Required by Google AdSense for EU/UK visitors
function ConsentBanner({ onAccept, onDecline }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#1a1814', borderTop: '1px solid #2a2520',
      padding: '20px 40px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap',
    }}>
      <p style={{ fontSize: '13px', color: '#9a9488', fontWeight: 300, lineHeight: 1.7, maxWidth: '680px' }}>
        We use cookies to display relevant advertisements and analyse site traffic.
        By clicking <strong style={{ color: '#f8f6f1', fontWeight: 400 }}>Accept</strong>, you consent to our use of cookies as described in our{' '}
        <a href="/privacy" style={{ color: '#c9a84c', textDecoration: 'underline' }}>Privacy Policy</a>.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={onDecline}
          style={{
            background: 'transparent', border: '1px solid #3a3228',
            color: '#9a9488', fontSize: '11px', padding: '9px 20px',
            letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          Decline
        </button>
        <button
          onClick={onAccept}
          style={{
            background: '#8b6914', border: 'none',
            color: '#f8f6f1', fontSize: '11px', padding: '9px 20px',
            letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function App({ Component, pageProps }) {
  const [consent, setConsent] = useState(null); // null = not decided yet
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check stored consent
    const stored = localStorage.getItem('cookie_consent');
    if (stored) {
      setConsent(stored);
      if (stored === 'accepted') enableAds();
    } else {
      // Show banner after 1 second
      const t = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(t);
    }
  }, []);

  function enableAds() {
    // Push AdSense consent
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({ google_ad_client: 'ca-pub-REPLACE_WITH_YOUR_PUBLISHER_ID' });
    } catch (_) {}
  }

  function handleAccept() {
    localStorage.setItem('cookie_consent', 'accepted');
    setConsent('accepted');
    setShowBanner(false);
    enableAds();
  }

  function handleDecline() {
    localStorage.setItem('cookie_consent', 'declined');
    setConsent('declined');
    setShowBanner(false);
  }

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
      {showBanner && consent === null && (
        <ConsentBanner onAccept={handleAccept} onDecline={handleDecline} />
      )}
    </>
  );
}
