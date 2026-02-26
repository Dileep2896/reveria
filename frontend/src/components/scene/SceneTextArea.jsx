import { useState, useEffect, useRef, useMemo } from 'react';
import { cleanText } from '../../utils/textUtils';
import WritingSkeleton from './WritingSkeleton';

export default function SceneTextArea({ scene, scale, showText, skip, animateText, isRegen, textRegenKey, textWasRegenerated, rewriting, isTypewriter }) {
  const clean = cleanText(scene.text);

  // Word-level splitting for typewriter
  const allWords = useMemo(() => clean.split(/\s+/).filter(Boolean), [clean]);
  const [wordIndex, setWordIndex] = useState(isTypewriter ? 0 : allWords.length);
  const typewriterDone = useRef(!isTypewriter);

  // Progressive word reveal: 2 words per 50ms tick (~5s for 200 words)
  useEffect(() => {
    if (!isTypewriter || !showText || skip) {
      setWordIndex(allWords.length);
      typewriterDone.current = true;
      return;
    }
    let idx = 0;
    const interval = setInterval(() => {
      idx += 2;
      if (idx >= allWords.length) {
        setWordIndex(allWords.length);
        typewriterDone.current = true;
        clearInterval(interval);
      } else {
        setWordIndex(idx);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [isTypewriter, showText, skip, allWords.length]);

  // Use truncated text for display when typewriter is active
  const displayText = isTypewriter && !typewriterDone.current
    ? allWords.slice(0, wordIndex).join(' ')
    : clean;

  const sentences = displayText.match(/[^.!?]+[.!?]+[\s]*/g) || [displayText];
  const firstChar = displayText.charAt(0);
  const restOfFirstSentence = sentences[0]?.slice(1) || '';
  const remainingSentences = sentences.slice(1);

  const typewriterActive = isTypewriter && !typewriterDone.current;

  return (
    <>
      {/* Decorative divider — subtle ornamental rule */}
      <div key={`divider-${textRegenKey}`} style={{ flexShrink: 0, marginBottom: `${5 * scale}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: `${40 * scale}px`,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)',
            opacity: showText || skip ? 0.35 : 0,
            transition: skip ? 'none' : 'opacity 0.5s ease 0.2s',
            animation: animateText ? 'dividerGrow 0.6s ease-out' : 'none',
            transformOrigin: 'center',
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
            lineHeight: '1.75',
            letterSpacing: '0.01em',
            fontSize: `${12 * scale}px`,
            ...(isRegen ? { animation: 'textRegenContainer 0.5s ease-out' } : {}),
            ...(rewriting ? { opacity: 0, visibility: 'hidden' } : {}),
          }}
        >
          {/* Drop cap */}
          {wordIndex > 0 && (
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: `${2.4 * scale}rem`,
              fontWeight: 700,
              float: 'left',
              lineHeight: '0.8',
              marginRight: '0.22em',
              marginTop: '0.05em',
              paddingRight: '0.02em',
              color: 'var(--accent-primary)',
              textShadow: '0 0 20px var(--accent-primary-glow)',
              animation: typewriterActive
                ? 'dropCapReveal 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
                : animateText
                  ? isRegen
                    ? 'textRegenDropCap 0.6s cubic-bezier(0.22, 1, 0.36, 1)'
                    : 'dropCapReveal 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'none',
            }}
          >
            {firstChar}
          </span>
          )}

          <span
            style={{
              opacity: 1,
              animation: typewriterActive
                ? 'none'
                : animateText
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
                animation: typewriterActive
                  ? 'none'
                  : animateText
                    ? isRegen
                      ? `textRegenLine 0.5s ease-out ${0.15 + i * 0.06}s both`
                      : `textRevealLine 0.6s ease-out ${0.25 + i * 0.08}s both`
                    : 'none',
              }}
            >
              {sentence}
            </span>
          ))}

          {typewriterActive && <span className="typewriter-cursor" />}
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
