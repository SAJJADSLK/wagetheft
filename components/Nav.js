import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Nav() {
  const { pathname } = useRouter();

  return (
    <nav style={{
      background: '#f8f6f1', borderBottom: '1px solid #e0dbd0',
      padding: '0 40px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: '62px',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <Link href="/" style={{
        fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 600,
        letterSpacing: '.04em', color: '#1a1814',
      }}>
        Wage<em style={{ fontStyle: 'italic', color: '#8b6914' }}>Theft</em>.live
      </Link>

      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        {[
          { href: '/search',        label: 'Search'       },
          { href: '/top-offenders', label: 'Top Offenders'},
          { href: '/about',         label: 'About & Data' },
        ].map(({ href, label }) => (
          <Link key={href} href={href} style={{
            fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase',
            color: pathname === href ? '#1a1814' : '#9a9488',
            borderBottom: pathname === href ? '2px solid #1a1814' : '2px solid transparent',
            paddingBottom: '2px', transition: 'color .2s',
          }}>
            {label}
          </Link>
        ))}
      </div>

      <div style={{
        fontSize: '10px', background: '#1a1814', color: '#f8f6f1',
        padding: '6px 14px', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 500,
      }}>
        Updated Daily
      </div>
    </nav>
  );
}
