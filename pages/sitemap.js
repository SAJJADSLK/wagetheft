const SITE = 'https://wagetheft.live';

const pages = [
  { url: '/',               priority: '1.0', changefreq: 'daily'   },
  { url: '/search',         priority: '0.9', changefreq: 'daily'   },
  { url: '/top-offenders',  priority: '0.8', changefreq: 'daily'   },
  { url: '/blog',           priority: '0.7', changefreq: 'weekly'  },
  { url: '/about',          priority: '0.6', changefreq: 'monthly' },
  { url: '/privacy',        priority: '0.3', changefreq: 'yearly'  },
  { url: '/disclaimer',     priority: '0.3', changefreq: 'yearly'  },
];

const blogPosts = [
  'how-to-report-wage-theft-usa',
  'wage-theft-laws-by-us-state',
  'what-is-the-fair-labor-standards-act',
];

export default function Sitemap() { return null; }

export async function getServerSideProps({ res }) {
  const today = new Date().toISOString().split('T')[0];

  const allPages = [
    ...pages,
    ...blogPosts.map(slug => ({
      url: `/blog/${slug}`,
      priority: '0.7',
      changefreq: 'monthly',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(p => `  <url>
    <loc>${SITE}${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
  res.write(xml);
  res.end();
  return { props: {} };
}
