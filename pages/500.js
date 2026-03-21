import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';
import Footer from '../components/Footer';

export default function Custom500() {
  return (
    <>
      <Head>
        <title>Server error — WageTheft.live</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', background: '#f8f6f1' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '120px', fontWeight: 300, color: '#e0dbd0', lineHeight: 1, fontStyle: 'italic' }}>
              500
            </div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: '28px', fontWeight: 300, color: '#1a1814', margin: '20px 0 12px', letterSpacing: '-.01em' }}>
              Server error
            </h1>
            <p style={{ fontSize: '14px', color: '#9a9488', fontWeight: 300, marginBottom: '36px', lineHeight: 1.7, maxWidth: '400px' }}>
              Something went wrong on our end. Please try refreshing the page or come back in a moment.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <Link href="/" style={{ fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)' }}>
                Return to homepage →
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
