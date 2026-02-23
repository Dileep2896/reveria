import { cleanText } from '../../utils/textUtils';
import WritingSkeleton from './WritingSkeleton';

export default function SceneTextArea({ scene, scale, showText, skip, animateText, isRegen, textRegenKey, textWasRegenerated, rewriting }) {
  const clean = cleanText(scene.text);
  const sentences = clean.match(/[^.!?]+[.!?]+[\s]*/g) || [clean];
  const firstChar = clean.charAt(0);
  const restOfFirstSentence = sentences[0]?.slice(1) || '';
  const remainingSentences = sentences.slice(1);

  return (
    <>
      {/* Decorative divider */}
      <div key={`divider-${textRegenKey}`} className="flex items-center gap-2" style={{ flexShrink: 0, marginBottom: `${4 * scale}px` }}>
        <div
          className="h-px flex-1"
          style={{
            background: 'linear-gradient(90deg, var(--accent-primary-glow), transparent)',
            animation: animateText ? 'dividerGrow 0.6s ease-out' : 'none',
            transformOrigin: 'left',
            transform: showText || skip ? 'scaleX(1)' : 'scaleX(0)',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${3 * scale}px`,
            opacity: showText || skip ? 0.4 : 0,
            transition: skip ? 'none' : 'opacity 0.4s ease 0.3s',
            color: 'var(--accent-primary)',
            fontSize: `${8 * scale}px`,
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: `${5 * scale}px` }}>&#9679;</span>
          <span style={{ fontSize: `${3 * scale}px` }}>&#9679;</span>
          <span style={{ fontSize: `${5 * scale}px` }}>&#9679;</span>
        </div>
        <div
          className="h-px flex-1"
          style={{
            background: 'linear-gradient(270deg, var(--accent-primary-glow), transparent)',
            animation: animateText ? 'dividerGrow 0.6s ease-out' : 'none',
            transformOrigin: 'right',
            transform: showText || skip ? 'scaleX(1)' : 'scaleX(0)',
          }}
        />
      </div>

      {/* Story text - fills remaining space, overflow hidden with fade */}
      <div
        className="scene-text-area"
        style={{
          flex: '1 1 0',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Rewriting skeleton overlay */}
        {rewriting && <WritingSkeleton scale={scale} label="Crafting new scene" overlay />}

        <div
          key={textRegenKey}
          onAnimationEnd={() => { textWasRegenerated.current = false; }}
          style={{
            fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
            color: 'var(--book-page-text, var(--text-primary))',
            lineHeight: '1.85',
            letterSpacing: '0.01em',
            fontSize: `${12 * scale}px`,
            ...(isRegen ? { animation: 'textRegenContainer 0.5s ease-out' } : {}),
            ...(rewriting ? { opacity: 0, visibility: 'hidden' } : {}),
          }}
        >
          {/* Drop cap */}
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: `${2.4 * scale}rem`,
              fontWeight: 700,
              float: 'left',
              lineHeight: '0.8',
              marginRight: '0.12em',
              marginTop: '0.05em',
              paddingRight: '0.02em',
              color: 'var(--accent-primary)',
              textShadow: '0 0 20px var(--accent-primary-glow)',
              animation: animateText
                ? isRegen
                  ? 'textRegenDropCap 0.6s cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'dropCapReveal 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
                : 'none',
            }}
          >
            {firstChar}
          </span>

          <span
            style={{
              opacity: 1,
              animation: animateText
                ? isRegen
                  ? 'textRegenLine 0.5s ease-out 0.1s both'
                  : 'textRevealLine 0.6s ease-out 0.15s both'
                : 'none',
            }}
          >
            {restOfFirstSentence}
          </span>

          {remainingSentences.map((sentence, i) => (
            <span
              key={i}
              style={{
                opacity: 1,
                animation: animateText
                  ? isRegen
                    ? `textRegenLine 0.5s ease-out ${0.15 + i * 0.06}s both`
                    : `textRevealLine 0.6s ease-out ${0.25 + i * 0.08}s both`
                  : 'none',
              }}
            >
              {sentence}
            </span>
          ))}
        </div>

        {/* Fade-out at bottom if text overflows */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${24 * scale}px`,
            background: 'linear-gradient(to top, var(--book-page-bg), transparent)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </>
  );
}
