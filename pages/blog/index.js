import Head from 'next/head';
import Link from 'next/link';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import { POSTS } from '../../lib/blog';

export default function Blog() {
  return (
    <>
      <Head>
        <title>Workers Rights Guides — WageTheft.live</title>
        <meta name="description" content="Guides on wage theft laws, how to report unpaid wages, and worker rights in the US, UK, Canada and Australia." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://wagetheft.live/blog" />
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />

        <div style={{ background: '#1a1814', padding: '56px 40px 48px' }}>
          <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#8b6914', marginBottom: '18px', fontFamily: 'var(--mono)' }}>
              <span style={{ display: 'block', width: '24px', height: '1px', background: '#8b6914' }} />
              Workers Rights
            </div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 300, color: '#f8f6f1', letterSpacing: '-.01em', marginBottom: '14px' }}>
              Guides &amp; <em style={{ fontStyle: 'italic', color: '#c9a84c' }}>Resources</em>
            </h1>
            <p style={{ fontSize: '14px', color: '#6b6560', fontWeight: 300, maxWidth: '520px', lineHeight: 1.8 }}>
              Practical guides on wage theft laws, how to recover unpaid wages, and your rights as a worker in the US, UK, Canada and Australia.
            </p>
          </div>
        </div>

        <main style={{ flex: 1, background: '#f8f6f1', borderBottom: '1px solid #e0dbd0' }}>
          <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '52px 40px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              {POSTS.map(({ slug, title, excerpt, date, readMin }) => (
                <Link
                  key={slug}
                  href={`/blog/${slug}`}
                  style={{ display: 'block', background: '#fff', border: '1px solid #e0dbd0', padding: '28px', transition: 'border-color .2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#8b6914'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e0dbd0'}
                >
                  <div style={{ fontSize: '10px', color: '#9a9488', fontFamily: 'var(--mono)', letterSpacing: '.08em', marginBottom: '14px' }}>
                    {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {readMin} min read
                  </div>
                  <h2 style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 400, color: '#1a1814', lineHeight: 1.25, marginBottom: '14px', letterSpacing: '-.01em' }}>
                    {title}
                  </h2>
                  <p style={{ fontSize: '13px', color: '#9a9488', lineHeight: 1.8, fontWeight: 300, marginBottom: '20px' }}>
                    {excerpt}
                  </p>
                  <div style={{ height: '1px', background: '#e0dbd0', marginBottom: '16px' }} />
                  <span style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)' }}>
                    Read guide →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
