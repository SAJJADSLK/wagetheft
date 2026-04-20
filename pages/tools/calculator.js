import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import AdSlot from '../../components/AdSlot';

const CURRENCY = { USD: '$', GBP: '£', CAD: 'CA$', AUD: 'A$', EUR: '€' };

export default function Calculator() {
  const router = useRouter();
  const [form, setForm] = useState({
    currency: 'USD', hoursPerWeek: '', weeksWorked: '', agreedRate: '', actualPaid: '',
    overtimeHours: '', unpaidBreaks: '', tipDeductions: '',
  });
  const [result, setResult] = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const n   = (v) => parseFloat(v) || 0;

  function calculate() {
    const hrs   = n(form.hoursPerWeek);
    const wks   = n(form.weeksWorked);
    const rate  = n(form.agreedRate);
    const paid  = n(form.actualPaid);
    const otHrs = n(form.overtimeHours);
    const brkHrs= n(form.unpaidBreaks) / 60; // minutes to hours
    const tips  = n(form.tipDeductions);

    const regularOwed    = hrs * wks * rate;
    const actualReceived = paid;
    const overtimeOwed   = otHrs * wks * (rate * 1.5) - otHrs * wks * rate;
    const breakPay       = brkHrs * wks * rate;
    const tipAmount      = tips * wks;

    const totalOwed  = regularOwed;
    const totalGap   = Math.max(0, totalOwed - actualReceived) + overtimeOwed + breakPay + tipAmount;
    const sym        = CURRENCY[form.currency] || '$';

    setResult({
      totalOwed,
      actualReceived,
      overtimeOwed,
      breakPay,
      tipAmount,
      totalGap,
      sym,
      hasProblem: totalGap > 0,
      severity: totalGap > 10000 ? 'high' : totalGap > 1000 ? 'medium' : 'low',
    });
  }

  const Input = ({ label, field, placeholder, unit }) => (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '12px', letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b6560', fontFamily: 'var(--mono)', marginBottom: '8px' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0dbd0', background: '#fff', overflow: 'hidden' }}>
        {unit && <span style={{ padding: '0 14px', fontSize: '13px', color: '#9a9488', borderRight: '1px solid #e0dbd0', fontFamily: 'var(--mono)' }}>{unit}</span>}
        <input
          type="number" min="0" step="0.01"
          value={form[field]}
          onChange={e => set(field, e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, padding: '12px 16px', border: 'none', outline: 'none', fontSize: '14px', color: '#1a1814', background: 'transparent', fontFamily: 'var(--sans)', fontWeight: 300 }}
        />
      </div>
    </div>
  );

  return (
    <>
      <Head>
        <title>Wage Theft Calculator — Did Your Employer Underpay You? | WageTheft.live</title>
        <meta name="description" content="Calculate if your employer owes you back wages. Check overtime, unpaid breaks, tip theft, and misclassification. Free tool based on labour law." />
        <link rel="canonical" href="https://wagetheft.live/tools/calculator" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Wage Theft Calculator',
          applicationCategory: 'FinanceApplication',
          description: 'Calculate whether your employer owes you back wages under labour law',
          url: 'https://wagetheft.live/tools/calculator',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        })}} />
      </Head>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Nav />
        <main style={{ flex: 1, background: '#f8f6f1' }}>

          <div style={{ background: '#1a1814', padding: '48px 40px' }}>
            <div style={{ maxWidth: '760px', margin: '0 auto' }}>
              <div style={{ fontSize: '10px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#8b6914', fontFamily: 'var(--mono)', marginBottom: '12px' }}>Free Tool</div>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: '48px', color: '#f8f6f1', fontWeight: 300, marginBottom: '12px', lineHeight: 1.1 }}>
                Wage Gap <em style={{ color: '#c9a84c' }}>Calculator</em>
              </h1>
              <p style={{ fontSize: '14px', color: '#6b6560', fontWeight: 300, lineHeight: 1.8 }}>
                Enter your pay details to find out if your employer may owe you money.
              </p>
            </div>
          </div>

          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 40px' }}>

            {/* Currency selector */}
            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', fontSize: '12px', letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b6560', fontFamily: 'var(--mono)', marginBottom: '8px' }}>Currency</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {Object.entries(CURRENCY).map(([k, sym]) => (
                  <button key={k} onClick={() => set('currency', k)} style={{ padding: '8px 16px', border: `1px solid ${form.currency === k ? '#8b6914' : '#e0dbd0'}`, background: form.currency === k ? '#8b6914' : '#fff', color: form.currency === k ? '#fff' : '#6b6560', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--mono)', transition: 'all .15s' }}>
                    {sym} {k}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '32px', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 300, marginBottom: '24px', color: '#1a1814' }}>Your Work & Pay</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                <Input label="Hours worked per week" field="hoursPerWeek" placeholder="e.g. 40" />
                <Input label="Weeks worked" field="weeksWorked" placeholder="e.g. 52" />
                <Input label="Agreed hourly rate" field="agreedRate" placeholder="e.g. 15.00" unit={CURRENCY[form.currency]} />
                <Input label="Total actually paid" field="actualPaid" placeholder="e.g. 25000" unit={CURRENCY[form.currency]} />
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e0dbd0', padding: '32px', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 300, marginBottom: '8px', color: '#1a1814' }}>Common Violations <span style={{ fontSize: '13px', color: '#9a9488', fontWeight: 300 }}>(optional)</span></h2>
              <p style={{ fontSize: '12px', color: '#9a9488', fontWeight: 300, marginBottom: '24px' }}>Leave blank if not applicable</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                <Input label="Overtime hours per week (unpaid)" field="overtimeHours" placeholder="e.g. 8" />
                <Input label="Unpaid breaks per day (minutes)" field="unpaidBreaks" placeholder="e.g. 30" />
                <Input label="Tips withheld per week" field="tipDeductions" placeholder="e.g. 50" unit={CURRENCY[form.currency]} />
              </div>
            </div>

            <button
              onClick={calculate}
              style={{ width: '100%', padding: '18px', background: '#1a1814', color: '#f8f6f1', border: 'none', fontSize: '12px', letterSpacing: '.16em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--mono)', transition: 'background .2s', marginBottom: '32px' }}
              onMouseEnter={e => e.currentTarget.style.background = '#8b6914'}
              onMouseLeave={e => e.currentTarget.style.background = '#1a1814'}
            >
              Calculate What You're Owed
            </button>

            {result && (
              <div style={{ border: `2px solid ${result.hasProblem ? (result.severity === 'high' ? '#A32D2D' : '#c9a84c') : '#3B6D11'}`, padding: '32px', background: '#fff', marginBottom: '32px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '.16em', textTransform: 'uppercase', fontFamily: 'var(--mono)', color: result.hasProblem ? '#A32D2D' : '#3B6D11', marginBottom: '12px' }}>
                  {result.hasProblem ? (result.severity === 'high' ? '⚠ Significant discrepancy detected' : '⚠ Potential underpayment detected') : '✓ Pay appears consistent'}
                </div>

                <div style={{ fontFamily: 'var(--serif)', fontSize: '52px', fontWeight: 300, color: result.hasProblem ? '#A32D2D' : '#3B6D11', lineHeight: 1, marginBottom: '8px' }}>
                  {result.sym}{result.totalGap.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '14px', color: '#6b6560', fontWeight: 300, marginBottom: '24px' }}>
                  {result.hasProblem ? 'estimated back wages owed to you' : 'no significant shortfall detected'}
                </div>

                {result.hasProblem && (
                  <div style={{ borderTop: '1px solid #f0ece4', paddingTop: '20px', marginBottom: '20px' }}>
                    {[
                      result.overtimeOwed > 0 && { label: 'Unpaid overtime premium', value: result.overtimeOwed },
                      result.breakPay > 0     && { label: 'Unpaid break time', value: result.breakPay },
                      result.tipAmount > 0    && { label: 'Withheld tips', value: result.tipAmount },
                      (result.totalOwed - result.actualReceived) > 0 && { label: 'Base wage shortfall', value: Math.max(0, result.totalOwed - result.actualReceived) },
                    ].filter(Boolean).map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6b6560', marginBottom: '8px', fontWeight: 300 }}>
                        <span>{label}</span>
                        <span style={{ fontFamily: 'var(--mono)' }}>{result.sym}{value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {result.hasProblem && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button onClick={() => router.push('/search')} style={{ flex: 1, padding: '12px', background: '#1a1814', color: '#f8f6f1', border: 'none', fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--mono)' }}>
                      Search Employer Database
                    </button>
                    <button onClick={() => router.push('/red-flags')} style={{ flex: 1, padding: '12px', background: 'transparent', color: '#1a1814', border: '1px solid #1a1814', fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--mono)' }}>
                      View Red Flags Guide
                    </button>
                  </div>
                )}
              </div>
            )}

            <p style={{ fontSize: '11px', color: '#9a9488', fontWeight: 300, lineHeight: 1.7 }}>
              <strong>Disclaimer:</strong> This calculator provides an estimate for educational purposes only and does not constitute legal advice. Labour law varies by jurisdiction. Consult a qualified labour attorney for advice specific to your situation.
            </p>

            <AdSlot slot="leaderboard" style={{ marginTop: '32px' }} />
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
