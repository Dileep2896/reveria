import { useState, useEffect, useRef } from 'react';
import { useSceneActions } from '../contexts/SceneActionsContext';
import { isImageCached } from '../utils/textUtils';
import SceneComposing from './scene/SceneComposing';
import SceneHeader from './scene/SceneHeader';
import SceneImageArea from './scene/SceneImageArea';
import SceneTextArea from './scene/SceneTextArea';

/* ── Revealed scene with cinematic animation ── */
function SceneRevealed({ scene, scale = 1, displayIndex, isBookmarked, singlePage }) {
  const { sceneBusy } = useSceneActions();
  const isBusy = sceneBusy.has(scene.scene_number);

  // Track "waiting for rewritten text" - set on regen-scene click, cleared when new text arrives
  const [awaitingTextRegen, setAwaitingTextRegen] = useState(false);

  const isError = scene.image_url === 'error';
  const cached = isError || isImageCached(scene.image_url);
  const preloaded = scene._preloaded || false;
  const skipInitial = cached || preloaded;

  const [imageLoaded, setImageLoaded] = useState(cached);
  const [imageFailed, setImageFailed] = useState(false);
  const [showText, setShowText] = useState(skipInitial);
  const hasAnimated = useRef(skipInitial);

  const showError = isError || imageFailed;

  useEffect(() => {
    if (showText && !hasAnimated.current) {
      hasAnimated.current = true;
    }
  }, [showText]);

  const noImage = !scene.image_url && !isError;

  useEffect(() => {
    if (imageLoaded || showError || noImage) {
      if (hasAnimated.current) {
        setShowText(true);
        return;
      }
      const timer = setTimeout(() => setShowText(true), 300);
      return () => clearTimeout(timer);
    }
  }, [imageLoaded, showError, noImage]);

  // Reset image state when URL changes (e.g. regen)
  const prevImageUrl = useRef(scene.image_url);
  const wasRegenerated = useRef(false);
  useEffect(() => {
    if (scene.image_url && scene.image_url !== prevImageUrl.current) {
      wasRegenerated.current = !!prevImageUrl.current;
      prevImageUrl.current = scene.image_url;
      setImageLoaded(false);
      setImageFailed(false);
    }
  }, [scene.image_url]);

  useEffect(() => {
    if (scene.image_url && !isError && !imageLoaded && !imageFailed) {
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.onerror = () => setImageFailed(true);
      img.src = scene.image_url;
      return () => {
        img.onload = null;
        img.onerror = null;
        img.src = '';
      };
    }
  }, [scene.image_url, isError, imageLoaded, imageFailed]);

  // Track text changes for regen animation
  const prevText = useRef(scene.text);
  const [textRegenKey, setTextRegenKey] = useState(0);
  const textWasRegenerated = useRef(false);
  useEffect(() => {
    if (scene.text && scene.text !== prevText.current && prevText.current) {
      textWasRegenerated.current = true;
      setTextRegenKey((k) => k + 1);
      setAwaitingTextRegen(false); // New text arrived - hide writing overlay
    }
    prevText.current = scene.text;
  }, [scene.text]);

  // Also clear if busy ends without text change (e.g. error)
  useEffect(() => {
    if (!isBusy) setAwaitingTextRegen(false);
  }, [isBusy]);

  // Safety timeout: clear awaitingTextRegen after 60s in case regen fails silently
  useEffect(() => {
    if (!awaitingTextRegen) return;
    const timer = setTimeout(() => setAwaitingTextRegen(false), 60000);
    return () => clearTimeout(timer);
  }, [awaitingTextRegen]);

  const isRegen = textWasRegenerated.current;
  const skip = hasAnimated.current && !isRegen;
  const animateText = (showText && !hasAnimated.current) || isRegen;

  // Capture at mount: is this a fresh scene arriving during generation?
  const isTypewriterRef = useRef(!preloaded && !cached && !isError);

  return (
    <div
      className={preloaded ? 'scene-preloaded-fadein' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        ...(skip && !preloaded ? {} : preloaded ? {} : { animation: 'sceneReveal 0.7s cubic-bezier(0.22, 1, 0.36, 1)' }),
      }}
    >
      <SceneHeader scene={scene} scale={scale} displayIndex={displayIndex} isBookmarked={isBookmarked} isBusy={isBusy} onRegenSceneStart={() => setAwaitingTextRegen(true)} />

      <SceneImageArea
        scene={scene} scale={scale} displayIndex={displayIndex}
        imageLoaded={imageLoaded} imageFailed={imageFailed} isBusy={isBusy}
        showError={showError} preloaded={preloaded} skip={skip}
        wasRegenerated={wasRegenerated} singlePage={singlePage}
      />

      <SceneTextArea
        scene={scene} scale={scale} showText={showText} skip={skip}
        animateText={animateText} isRegen={isRegen} textRegenKey={textRegenKey}
        textWasRegenerated={textWasRegenerated}
        rewriting={awaitingTextRegen}
        isTypewriter={isTypewriterRef.current && !isRegen}
      />
    </div>
  );
}

/* ── Main SceneCard: decides composing vs revealed ── */
export default function SceneCard({ scene, scale = 1, displayIndex, isBookmarked, singlePage }) {
  const wrapperStyle = scene._deleting
    ? { animation: 'sceneDeleteOut 0.5s ease-in forwards', height: '100%' }
    : { height: '100%' };

  const content = scene.text
    ? <SceneRevealed scene={scene} scale={scale} displayIndex={displayIndex} isBookmarked={isBookmarked} singlePage={singlePage} />
    : <SceneComposing sceneNumber={scene.scene_number} displayIndex={displayIndex} scale={scale} />;

  return <div style={wrapperStyle}>{content}</div>;
}
