export default function ErrorState({ message = 'Something went wrong. Please try again.', onRetry }) {
  return (
    <div style={{ padding: '48px 40px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 300, color: '#1a1814', marginBottom: '10px' }}>
        Unable to load data
      </div>
      <p style={{ fontSize: '13px', color: '#9a9488', fontWeight: 300, lineHeight: 1.8, marginBottom: '20px' }}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'transparent', border: '1px solid #e0dbd0',
            color: '#9a9488', fontSize: '11px', padding: '10px 22px',
            letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer',
            transition: 'all .2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b6914'; e.currentTarget.style.color = '#8b6914'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0dbd0'; e.currentTarget.style.color = '#9a9488'; }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
