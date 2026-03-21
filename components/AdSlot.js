import { useEffect } from 'react';

export default function AdSlot({ slot = 'leaderboard', style = {} }) {
  useEffect(() => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) {}
  }, []);

  const slotIds = {
    leaderboard: 'REPLACE_SLOT_LEADERBOARD',
    rectangle:   'REPLACE_SLOT_RECTANGLE',
    article:     'REPLACE_SLOT_ARTICLE',
  };

  return (
    <div style={{ borderTop: '1px solid #e0dbd0', borderBottom: '1px solid #e0dbd0', padding: '14px 0', background: '#fdfcf8', ...style }}>
      <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '0 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '9px', letterSpacing: '.15em', textTransform: 'uppercase', color: '#c0bab0', fontFamily: 'var(--mono)' }}>
          Advertisement
        </span>
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client="ca-pub-REPLACE_WITH_YOUR_PUBLISHER_ID"
          data-ad-slot={slotIds[slot] ?? slotIds.leaderboard}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
