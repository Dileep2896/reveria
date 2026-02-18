import './Logo.css';

export default function Logo({ size = 'compact' }) {
  const iconClass = size === 'compact' ? 'logo-icon-compact' : 'logo-icon-full';

  return (
    <div className={`sf-logo sf-logo-${size}`}>
      <div className={`sf-icon ${iconClass}`}>
        <div className="sf-forge-glow" />
        <div className="sf-book">
          <div className="sf-book-left" />
          <div className="sf-book-spine" />
          <div className="sf-book-right" />
        </div>
        <div className="sf-sparks">
          <div className="sf-spark sf-spark-1" />
          <div className="sf-spark sf-spark-2" />
          <div className="sf-spark sf-spark-3" />
          {size !== 'compact' && (
            <>
              <div className="sf-spark sf-spark-4" />
              <div className="sf-spark sf-spark-5" />
            </>
          )}
        </div>
      </div>
      <div className="sf-wordmark">
        <span className="sf-word-story">Story</span>
        <span className="sf-word-forge">Forge</span>
      </div>
    </div>
  );
}
