import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CARDS, normalizeCardData, hasVisualFields, ChevronToggle, ShimmerVisual } from './director/directorUtils.jsx';
import NarrativeArcVisual from './director/NarrativeArcVisual';
import CharactersVisual from './director/CharactersVisual';
import TensionVisual from './director/TensionVisual';
import VisualStyleVisual from './director/VisualStyleVisual';
import IllustrationsCard from './director/IllustrationsCard';
import DirectorHelpModal from './director/DirectorHelpModal';
import PortraitGallery from './director/PortraitGallery';

/* ── Main panel ── */

export default function DirectorPanel({ data, generating, sceneNumbers, sceneTitles, imageTiers, portraits = [], portraitsLoading = false, onGeneratePortraits, language }) {
  const isAnalyzing = generating && !data;
  const [expandedCards, setExpandedCards] = useState({});
  const [helpOpen, setHelpOpen] = useState(false);
  const toggleCard = (key) => setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div
      className="director-panel overflow-y-auto flex-shrink-0"
      style={{
        background: 'color-mix(in srgb, var(--bg-primary) 88%, transparent)',
        backdropFilter: 'var(--glass-blur-strong)',
        WebkitBackdropFilter: 'var(--glass-blur-strong)',
        borderLeft: '1px solid var(--glass-border)',
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-5 py-4 flex items-center gap-2.5"
        style={{
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: 'var(--accent-secondary-soft)',
            border: '1px solid var(--glass-border-secondary)',
            boxShadow: 'var(--shadow-glow-secondary)',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <h2
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: 'var(--accent-secondary)', flex: 1 }}
        >
          Director
        </h2>
        {language && (
          <span
            style={{
              fontSize: '9px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '9999px',
              color: 'var(--accent-primary)',
              background: 'var(--accent-primary-soft)',
              border: '1px solid var(--glass-border-accent)',
              letterSpacing: '0.03em',
            }}
          >
            {language}
          </span>
        )}
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Director guide"
          title="What do these cards mean?"
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '11px',
            fontWeight: 700,
            lineHeight: 1,
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-secondary-soft)';
            e.currentTarget.style.color = 'var(--accent-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--glass-bg)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          ?
        </button>
      </div>

      {helpOpen && createPortal(
        <DirectorHelpModal onClose={() => setHelpOpen(false)} />,
        document.body,
      )}

      <div className="director-body">
        {!data && !isAnalyzing ? (
          /* ── Empty state — centered illustration ── */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '2.5rem 1.5rem',
            gap: '1rem',
            minHeight: '320px',
          }}>
            {/* Icon cluster */}
            <div style={{
              position: 'relative',
              width: '80px',
              height: '80px',
              marginBottom: '0.5rem',
            }}>
              {/* Central eye icon */}
              <div style={{
                position: 'absolute',
                inset: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'var(--accent-secondary-soft)',
                border: '1px solid var(--glass-border-secondary)',
                boxShadow: 'var(--shadow-glow-secondary)',
                animation: 'directorIdlePulse 3s ease-in-out infinite',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              {/* Orbiting dots */}
              {CARDS.map(({ icon }, i) => {
                const angle = (i * 90 - 45) * (Math.PI / 180);
                const r = 48;
                return (
                  <div key={i} style={{
                    position: 'absolute',
                    left: `${40 + Math.cos(angle) * r - 10}px`,
                    top: `${40 + Math.sin(angle) * r - 10}px`,
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: `directorIdlePulse 3s ease-in-out ${i * 0.4}s infinite`,
                  }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                      <path d={icon} />
                    </svg>
                  </div>
                );
              })}
            </div>

            <p style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              letterSpacing: '0.02em',
            }}>
              Awaiting your story
            </p>
            <p style={{
              fontSize: '0.7rem',
              lineHeight: 1.6,
              color: 'var(--text-muted)',
              maxWidth: '200px',
            }}>
              Narrative arc, characters, tension, and visual style analysis will appear here as scenes are generated.
            </p>

            {/* Language lock warning */}
            {language && (
              <div style={{
                marginTop: '16px',
                padding: '8px 12px',
                borderRadius: '10px',
                background: 'rgba(255, 180, 50, 0.08)',
                border: '1px solid rgba(255, 180, 50, 0.2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                maxWidth: '220px',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 180, 50, 0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{
                  fontSize: '0.62rem',
                  lineHeight: 1.5,
                  color: 'rgba(255, 180, 50, 0.7)',
                }}>
                  Language ({language}) will be locked once you start generating.
                </span>
              </div>
            )}
          </div>
        ) : (
          /* ── Active / Analyzing state ── */
          <>
            {isAnalyzing ? (
              /* ── Analyzing state — animated scanning ── */
              <>
                {/* Scanning indicator */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: 'var(--accent-secondary-soft)',
                  border: '1px solid var(--glass-border-secondary)',
                  animation: 'analyzePulse 2s ease-in-out infinite',
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'scanEye 2.5s ease-in-out infinite',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                  <div>
                    <p style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--accent-secondary)',
                      marginBottom: '2px',
                    }}>
                      Analyzing story
                    </p>
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{
                          width: '4px',
                          height: '4px',
                          borderRadius: '50%',
                          background: 'var(--accent-secondary)',
                          animation: `analyzeDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Skeleton cards with pill-shaped shimmers */}
                {CARDS.map(({ key, label, icon }, cardIndex) => (
                  <div
                    key={key}
                    className="mb-3 p-3.5 rounded-xl"
                    style={{
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      backdropFilter: 'var(--glass-blur)',
                      animation: `analyzeCardIn 0.5s ease-out ${cardIndex * 0.12}s both`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2.5">
                      <div style={{
                        animation: `analyzeIconPulse 2s ease-in-out ${cardIndex * 0.3}s infinite`,
                      }}>
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--text-muted)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d={icon} />
                        </svg>
                      </div>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-widest"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {label}
                      </span>
                    </div>
                    <ShimmerVisual />
                  </div>
                ))}
              </>
            ) : (
              /* ── Data-ready state ── */
              <>
                <p
                  className="text-xs leading-relaxed mb-5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Creative analysis of the current story.
                </p>

                {CARDS.map(({ key, label, icon }) => {
                  const content = normalizeCardData(key, data?.[key]);
                  const expanded = !!expandedCards[key];
                  const showChevron = content && (hasVisualFields(key, content) || content.detail);

                  return (
                    <div
                      key={key}
                      className="mb-3 p-3.5 rounded-xl"
                      style={{
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        backdropFilter: 'var(--glass-blur)',
                        animation: 'fadeIn 0.4s ease',
                      }}
                    >
                      {/* Card header */}
                      <div
                        className="flex items-center gap-2 mb-2.5"
                        style={{ cursor: showChevron ? 'pointer' : 'default' }}
                        onClick={() => showChevron && toggleCard(key)}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--accent-secondary)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d={icon} />
                        </svg>
                        <span
                          className="text-[10px] font-semibold uppercase tracking-widest"
                          style={{ color: 'var(--accent-secondary)', flex: 1 }}
                        >
                          {label}
                        </span>
                        {showChevron && (
                          <ChevronToggle
                            expanded={expanded}
                            onClick={(e) => { e.stopPropagation(); toggleCard(key); }}
                          />
                        )}
                      </div>

                      {content ? (
                        <>
                          {/* Visual summary — always visible */}
                          {hasVisualFields(key, content) ? (
                            <>
                              {key === 'narrative_arc' && (
                                <NarrativeArcVisual
                                  stage={content.stage}
                                  pacing={content.pacing}
                                  summary={content.summary}
                                />
                              )}
                              {key === 'characters' && (
                                <CharactersVisual
                                  list={content.list}
                                  summary={content.summary}
                                />
                              )}
                              {key === 'tension' && (
                                <TensionVisual
                                  levels={content.levels}
                                  trend={content.trend}
                                  summary={content.summary}
                                  sceneNumbers={sceneNumbers}
                                  sceneTitles={sceneTitles}
                                />
                              )}
                              {key === 'visual_style' && (
                                <VisualStyleVisual
                                  tags={content.tags}
                                  mood={content.mood}
                                  summary={content.summary}
                                />
                              )}
                            </>
                          ) : (
                            /* Old string format fallback: show detail directly */
                            <p
                              className="text-xs leading-relaxed"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {content.detail}
                            </p>
                          )}

                          {/* Collapsible detail text */}
                          {expanded && content.detail && hasVisualFields(key, content) && (
                            <div style={{
                              marginTop: '10px',
                              paddingTop: '10px',
                              borderTop: '1px solid var(--glass-border)',
                              animation: 'detailFadeIn 0.2s ease',
                            }}>
                              <p
                                className="text-xs leading-relaxed"
                                style={{ color: 'var(--text-muted)', margin: 0 }}
                              >
                                {content.detail}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <ShimmerVisual />
                      )}
                    </div>
                  );
                })}

                {/* Illustrations tier card — after visual_style */}
                <IllustrationsCard imageTiers={imageTiers} />

                {/* Portrait Gallery Card */}
                <PortraitGallery
                  portraits={portraits}
                  portraitsLoading={portraitsLoading}
                  onGeneratePortraits={onGeneratePortraits}
                />
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes detailFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tensionBarGrow {
          from { height: 0%; opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes directorIdlePulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes shimmerSlide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes analyzePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.75; }
        }
        @keyframes scanEye {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          25% { transform: scale(1.1); opacity: 1; }
          50% { transform: scale(1); opacity: 0.8; }
          75% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes analyzeDot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes analyzeCardIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes analyzeIconPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes helpOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dialogPop {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
