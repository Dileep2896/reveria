import './GeminiBadge.css';

export default function GeminiBadge() {
  return (
    <div className="gemini-badge">
      <svg className="gemini-badge-icon" viewBox="0 0 28 28" fill="none" width="14" height="14">
        <path
          d="M14 0C14 7.732 7.732 14 0 14c7.732 0 14 6.268 14 14 0-7.732 6.268-14 14-14C20.268 14 14 7.732 14 0Z"
          fill="url(#geminiGrad)"
        />
        <defs>
          <linearGradient id="geminiGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4285F4" />
            <stop offset="0.5" stopColor="#9B72CB" />
            <stop offset="1" stopColor="#D96570" />
          </linearGradient>
        </defs>
      </svg>
      <span className="gemini-badge-text">Powered by Gemini</span>
    </div>
  );
}
