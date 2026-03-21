import Head from 'next/head';
import Link from 'next/link';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import AdSlot from '../../components/AdSlot';
import { POSTS } from '../../lib/blog';

const CONTENT = {
  'how-to-report-wage-theft-usa': {
    body: [
      { type: 'p',  text: 'Wage theft is the most common form of theft in the United States — more money is stolen by employers each year than by bank robbers, car thieves, and burglars combined. If your employer has not paid you the wages you are legally owed, you have enforceable rights under federal and state law.' },
      { type: 'h2', text: 'What counts as wage theft?' },
      { type: 'p',  text: 'Wage theft takes many forms. The most common include: paying below the federal or state minimum wage; not paying overtime (1.5x your regular rate) for hours worked beyond 40 in a workweek; making illegal deductions from your pay; requiring off-the-clock work; misclassifying you as an independent contractor to avoid paying benefits; and not paying your final paycheck after you leave.' },
      { type: 'h2', text: 'Step 1 — Document everything' },
      { type: 'p',  text: 'Before filing a complaint, gather evidence. Keep copies of all pay stubs, timesheets, schedules, and written communications about pay. Note the dates and hours you worked. If your employer uses digital time-tracking, take screenshots. The more documentation you have, the stronger your case.' },
      { type: 'h2', text: 'Step 2 — File a complaint with the Dept of Labor' },
      { type: 'p',  text: "The US Department of Labor's Wage and Hour Division (WHD) investigates wage theft complaints at no cost to you. File online at dol.gov/agencies/whd/contact/complaints, by phone at 1-866-4US-WAGE, or in person at a local WHD office. Complaints are confidential — your employer cannot legally retaliate against you for filing." },
      { type: 'p',  text: 'The WHD will investigate and, if violations are found, can recover back wages, civil money penalties, and in serious cases refer the employer for criminal prosecution. There is no filing fee and you do not need a lawyer.' },
      { type: 'h2', text: 'Step 3 — Consider a private lawsuit' },
      { type: 'p',  text: 'You can also hire a private employment attorney and sue your employer directly under the Fair Labor Standards Act. If you win, you may be entitled to double damages plus attorney fees paid by your employer. Many employment lawyers work on contingency — they only get paid if you win.' },
      { type: 'h2', text: 'Statute of limitations' },
      { type: 'p',  text: 'Under federal law you generally have 2 years to file — extended to 3 years for wilful violations. Many states have longer periods. Do not delay: the clock starts from when the violation occurred, not when you discovered it.' },
    ],
  },
  'wage-theft-laws-by-us-state': {
    body: [
      { type: 'p',  text: 'The Fair Labor Standards Act sets a federal floor for wage protections, but every state can enact stronger laws. As of 2024, more than half of US states have a higher minimum wage than the federal $7.25, and many have extended overtime protections or longer statutes of limitations.' },
      { type: 'h2', text: 'States with the strongest wage protections' },
      { type: 'p',  text: "California has the most comprehensive wage theft laws in the country. The state minimum wage is $16/hour, employees can recover up to three years of back wages, and the California Labor Commissioner has broad enforcement powers including the ability to place liens on employer property." },
      { type: 'p',  text: 'New York provides strong protections with a $16 minimum wage in New York City and Long Island, a six-year statute of limitations, and the ability to recover 100% of unpaid wages plus liquidated damages. The Wage Theft Prevention Act requires employers to provide written wage notices.' },
      { type: 'h2', text: 'Federal vs state law — which applies?' },
      { type: 'p',  text: 'When federal and state law conflict, the law most favourable to the employee applies. If your state minimum wage is higher than $7.25, your employer must pay the state rate. If your state allows a longer period to file, you can use it.' },
      { type: 'h2', text: 'Key provisions to check in your state' },
      { type: 'p',  text: 'Look for: the current minimum wage rate; overtime rules (some states require daily overtime after 8 hours); the statute of limitations; whether liquidated or double damages are available; and your state labour enforcement agency contact details.' },
      { type: 'h2', text: 'Local ordinances' },
      { type: 'p',  text: 'Many cities have enacted their own minimum wage ordinances above state levels. Seattle, San Francisco, Denver, Chicago, Minneapolis, and dozens of other cities have higher local minimums. Always check city or county ordinances in addition to state law.' },
    ],
  },
  'what-is-the-fair-labor-standards-act': {
    body: [
      { type: 'p',  text: 'The Fair Labor Standards Act (FLSA) was enacted in 1938 and remains the cornerstone of US federal wage law. It establishes minimum wage, overtime pay, recordkeeping, and child labour standards for most private sector and government employees.' },
      { type: 'h2', text: 'Who is covered?' },
      { type: 'p',  text: "The FLSA covers most US employees whether full-time, part-time, or temporary. However some workers are exempt — executives, administrators, and professionals earning above $684/week are generally exempt from overtime. Independent contractors are not covered, which is why misclassification is a serious form of wage theft." },
      { type: 'h2', text: 'Minimum wage' },
      { type: 'p',  text: 'The FLSA sets the federal minimum at $7.25/hour — unchanged since 2009. States and cities can set higher rates, and workers in those places are entitled to the higher amount.' },
      { type: 'h2', text: 'Overtime' },
      { type: 'p',  text: 'Non-exempt employees must receive at least 1.5x their regular rate for all hours beyond 40 in a workweek. The FLSA defines overtime weekly — employers cannot average hours across two weeks. Requiring off-the-clock work is illegal.' },
      { type: 'h2', text: 'Recordkeeping' },
      { type: 'p',  text: "Employers must keep accurate records of hours worked and wages paid. If an employer fails to keep records and there is a dispute, courts may accept the employee's estimate of hours worked as credible evidence." },
      { type: 'h2', text: 'Enforcement and remedies' },
      { type: 'p',  text: 'The WHD enforces the FLSA. Violations can result in back wages for up to 3 years (wilful), plus equal liquidated damages, plus civil penalties. Employees can also file private lawsuits and recover attorneys fees.' },
      { type: 'h2', text: 'Anti-retaliation' },
      { type: 'p',  text: 'The FLSA prohibits retaliation against employees who file complaints or cooperate with DOL investigations. Retaliation includes termination, demotion, or any adverse action. Employees who experience retaliation can file a separate complaint.' },
    ],
  },
};

export default function BlogPost({ post, content }) {
  if (!post) return null;
  return (
    <>
      <Head>
        <title>{post.title} — WageTheft.live</title>
        <meta name="description" content={post.excerpt} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`https://wagetheft.live/blog/${post.slug}`} />
        <meta property="og:title"       content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <meta property="og:type"        content="article" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context':   'https://schema.org',
          '@type':      'Article',
          headline:     post.title,
          description:  post.excerpt,
          datePublished: post.date,
          publisher: { '@type': 'Organization', name: 'WageTheft.live', url: 'https://wagetheft.live' },
        })}} />
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <div style={{ background: '#1a1814', padding: '56px 40px 48px' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <Link href="/blog" style={{ fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)', display: 'inline-block', marginBottom: '24px' }}>
              ← All guides
            </Link>
            <div style={{ fontSize: '10px', color: '#4a4540', fontFamily: 'var(--mono)', marginBottom: '16px' }}>
              {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {post.readMin} min read
            </div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 300, color: '#f8f6f1', letterSpacing: '-.01em', lineHeight: 1.15 }}>
              {post.title}
            </h1>
          </div>
        </div>

        <AdSlot slot="leaderboard" />

        <main style={{ flex: 1, background: '#f8f6f1' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 40px 64px' }}>
            {content.body.map((block, i) => {
              if (block.type === 'p')  return <p  key={i} style={{ fontSize: '15px', color: '#6b6560', lineHeight: 1.9, fontWeight: 300, marginBottom: '18px' }}>{block.text}</p>;
              if (block.type === 'h2') return <h2 key={i} style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 400, color: '#1a1814', marginTop: '44px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #e0dbd0', letterSpacing: '-.01em' }}>{block.text}</h2>;
              return null;
            })}

            <div style={{ background: '#1a1814', padding: '32px', marginTop: '48px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '.16em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)', marginBottom: '12px' }}>Search the database</div>
              <p style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 300, color: '#f8f6f1', marginBottom: '16px', lineHeight: 1.3 }}>
                Check if your employer has a recorded <em style={{ fontStyle: 'italic', color: '#c9a84c' }}>wage violation</em>
              </p>
              <Link href="/search" style={{ display: 'inline-block', background: '#8b6914', color: '#f8f6f1', fontSize: '11px', fontWeight: 500, padding: '12px 24px', letterSpacing: '.14em', textTransform: 'uppercase' }}>
                Search Records →
              </Link>
            </div>
          </div>
        </main>

        <AdSlot slot="rectangle" />
        <Footer />
      </div>
    </>
  );
}

export async function getStaticPaths() {
  return { paths: POSTS.map(p => ({ params: { slug: p.slug } })), fallback: false };
}

export async function getStaticProps({ params }) {
  const post    = POSTS.find(p => p.slug === params.slug);
  const content = CONTENT[params.slug];
  if (!post || !content) return { notFound: true };
  return { props: { post, content } };
}
