/**
 * WebSocket message handler dispatch map.
 * Each handler receives (data, state) and returns true if handled.
 */

export function createWsHandlers({
  setScenes, setGenerating, setUserPrompt, setError, setDirectorData,
  setStoryId, storyIdRef, setQuotaCooldown, setSceneBusy, setBookMeta,
  setPortraits, setPortraitsLoading, setGenerations,
  generationsRef, currentBatchIndexRef, initialStateRef, hydratedRef,
  addToastRef, quotaImageToastFired, cooldownTimer,
  liveHandlerRef, storyDeletedRef,
}) {
  return function handleMessage(data) {
    // Route live voice messages to handler
    if (data.type?.startsWith('live_') && liveHandlerRef.current) {
      if (liveHandlerRef.current(data)) return true;
    }

    switch (data.type) {
      case 'story_id':
        setStoryId(data.content);
        storyIdRef.current = data.content;
        return true;

      case 'book_meta':
        setBookMeta({ title: data.title, coverUrl: data.cover_image_url });
        addToastRef.current?.('AI title & cover ready!', 'info');
        return true;

      case 'status':
        setGenerating(data.content === 'generating');
        if (data.content === 'generating') {
          setError(null);
        }
        return true;

      case 'text': {
        if (data.is_regen) {
          setScenes((prev) =>
            prev.map((scene) =>
              scene.scene_number === data.scene_number
                ? { ...scene, text: data.content, audio_url: null }
                : scene,
            ),
          );
          return true;
        }
        const currentBatch = generationsRef.current[currentBatchIndexRef.current];
        setScenes((prev) => [
          ...prev,
          {
            scene_number: data.scene_number,
            text: data.content,
            scene_title: data.scene_title || null,
            image_url: null,
            prompt: currentBatch?.prompt || null,
          },
        ]);
        if (currentBatch) {
          currentBatch.sceneNumbers.push(data.scene_number);
          setGenerations([...generationsRef.current]);
        }
        return true;
      }

      case 'image':
        setScenes((prev) =>
          prev.map((scene) =>
            scene.scene_number === data.scene_number
              ? { ...scene, image_url: data.content, image_tier: data.tier || 1 }
              : scene,
          ),
        );
        return true;

      case 'audio':
        setScenes((prev) =>
          prev.map((scene) =>
            scene.scene_number === data.scene_number
              ? {
                  ...scene,
                  audio_url: data.content,
                  ...(data.word_timestamps ? { word_timestamps: data.word_timestamps } : {}),
                }
              : scene,
          ),
        );
        return true;

      case 'image_error':
        setScenes((prev) =>
          prev.map((scene) => {
            if (scene.scene_number !== data.scene_number) return scene;
            // If scene already has a valid image (regen failed), keep the old one
            const hasImage = scene.image_url && scene.image_url !== 'error';
            if (hasImage) return { ...scene, image_error_reason: data.reason || 'generation_failed' };
            return { ...scene, image_url: 'error', image_error_reason: data.reason || 'generation_failed' };
          }),
        );
        if (data.reason === 'quota_exhausted' && !quotaImageToastFired.current) {
          quotaImageToastFired.current = true;
          addToastRef.current?.('Image skipped — quota exhausted', 'warning');
        }
        return true;

      case 'director': {
        setDirectorData(data.content);
        const batch = generationsRef.current[currentBatchIndexRef.current];
        if (batch) {
          batch.directorData = data.content;
          setGenerations([...generationsRef.current]);
        }
        return true;
      }

      case 'transcription':
        setUserPrompt(data.content);
        generationsRef.current.push({ prompt: data.content, directorData: null, sceneNumbers: [] });
        currentBatchIndexRef.current = generationsRef.current.length - 1;
        setGenerations([...generationsRef.current]);
        return true;

      case 'quota_exhausted': {
        const seconds = data.retry_after || 60;
        setQuotaCooldown(seconds);
        addToastRef.current?.(`Image quota exhausted — retry in ${seconds}s`, 'warning', 6000);
        clearInterval(cooldownTimer.current);
        cooldownTimer.current = setInterval(() => {
          setQuotaCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(cooldownTimer.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return true;
      }

      case 'regen_start':
        setSceneBusy((prev) => new Set(prev).add(data.scene_number));
        return true;

      case 'regen_done':
      case 'regen_error':
        setSceneBusy((prev) => {
          const next = new Set(prev);
          next.delete(data.scene_number);
          return next;
        });
        return true;

      case 'scene_skipped':
        setScenes((prev) => prev.map((s) =>
          s.scene_number === data.scene_number ? { ...s, _deleting: true } : s
        ));
        setTimeout(() => {
          setScenes((prev) => prev.filter((s) => s.scene_number !== data.scene_number));
        }, 500);
        addToastRef.current?.(
          data.reason === 'quota_exhausted'
            ? 'Scene skipped — image quota exhausted'
            : 'Scene skipped — image generation failed',
          'warning',
        );
        return true;

      case 'scene_deleted':
        setScenes((prev) => prev.map((s) =>
          s.scene_number === data.scene_number ? { ...s, _deleting: true } : s
        ));
        setTimeout(() => {
          setScenes((prev) => prev.filter((s) => s.scene_number !== data.scene_number));
        }, 500);
        setSceneBusy((prev) => {
          const next = new Set(prev);
          next.delete(data.scene_number);
          return next;
        });
        // Clean deleted scene from generations so Director updates
        for (const gen of generationsRef.current) {
          const idx = gen.sceneNumbers.indexOf(data.scene_number);
          if (idx !== -1) {
            gen.sceneNumbers.splice(idx, 1);
            // Also remove per-scene tension level at the same index
            if (gen.directorData?.tension?.levels) {
              gen.directorData.tension.levels.splice(idx, 1);
            }
          }
        }
        setGenerations([...generationsRef.current]);
        return true;

      case 'story_deleted':
        setScenes([]);
        setUserPrompt(null);
        setError(null);
        setGenerating(false);
        setDirectorData(null);
        setBookMeta(null);
        setPortraits([]);
        setPortraitsLoading(false);
        setStoryId(null);
        storyIdRef.current = null;
        generationsRef.current = [];
        currentBatchIndexRef.current = -1;
        setGenerations([]);
        initialStateRef.current = null;
        hydratedRef.current = false;
        storyDeletedRef.current?.();
        return true;

      case 'portrait':
        setPortraits((prev) => {
          const exists = prev.some(p => p.name === data.name && p.image_url === data.image_url);
          if (exists) return prev;
          const withoutOld = prev.filter(p => p.name !== data.name);
          return [...withoutOld, { name: data.name, image_url: data.image_url, error: data.error }];
        });
        return true;

      case 'portraits_done':
        setPortraitsLoading(false);
        return true;

      case 'error':
        setError(data.content);
        addToastRef.current?.(data.content, 'error');
        return true;

      default:
        return false;
    }
  };
}
