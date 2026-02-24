/**
 * WebSocket message handler dispatch map.
 * Each handler receives (data, state) and returns true if handled.
 */

let _msgId = 0;

export function createWsHandlers({
  setScenes, setGenerating, setUserPrompt, setError, setDirectorData,
  setStoryId, storyIdRef, setQuotaCooldown, setSceneBusy, setBookMeta,
  setPortraits, setPortraitsLoading, setGenerations,
  generationsRef, currentBatchIndexRef, initialStateRef, hydratedRef,
  addToastRef, quotaImageToastFired, cooldownTimer,
  storyDeletedRef, setControlBarInput,
  setUsage,
  setDirectorLiveNotes,
  setDirectorChatActive, setDirectorChatMessages, setDirectorChatLoading, setDirectorChatPrompt,
  setDirectorAutoGenerate,
}) {
  return function handleMessage(data) {
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
          if (setDirectorLiveNotes) setDirectorLiveNotes([]);
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
          const idx = currentBatchIndexRef.current;
          generationsRef.current[idx] = { ...currentBatch, sceneNumbers: [...currentBatch.sceneNumbers, data.scene_number] };
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
          addToastRef.current?.('Image skipped - quota exhausted', 'warning');
        }
        return true;

      case 'director_live':
        if (setDirectorLiveNotes) {
          setDirectorLiveNotes((prev) => [...prev, {
            scene_number: data.scene_number,
            thought: data.thought,
            mood: data.mood,
            tension_level: data.tension_level,
            craft_note: data.craft_note,
            emoji: data.emoji,
            suggestion: data.suggestion,
            audio_url: data.audio_url,
          }]);
        }
        return true;

      case 'steer_ack':
        addToastRef.current?.(`Steering applied: "${data.content}"`, 'info');
        return true;

      case 'director': {
        setDirectorData(data.content);
        const idx = currentBatchIndexRef.current;
        const batch = generationsRef.current[idx];
        if (batch) {
          generationsRef.current[idx] = { ...batch, directorData: data.content };
          setGenerations([...generationsRef.current]);
        }
        return true;
      }

      case 'transcription':
        // Populate the text field so the user can review/edit before sending
        if (setControlBarInput) setControlBarInput(data.content);
        return true;

      case 'quota_exhausted': {
        const seconds = data.retry_after || 60;
        setQuotaCooldown(seconds);
        addToastRef.current?.(`Image quota exhausted - retry in ${seconds}s`, 'warning', 6000);
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
            ? 'Scene skipped - image quota exhausted'
            : 'Scene skipped - image generation failed',
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
        generationsRef.current = generationsRef.current.map((gen) => {
          const idx = gen.sceneNumbers.indexOf(data.scene_number);
          if (idx === -1) return gen;
          const updated = {
            ...gen,
            sceneNumbers: gen.sceneNumbers.filter((_, i) => i !== idx),
          };
          if (gen.directorData) {
            const dd = { ...gen.directorData };
            if (dd.tension?.levels) dd.tension = { ...dd.tension, levels: dd.tension.levels.filter((_, i) => i !== idx) };
            if (dd.emotional_arc?.values) dd.emotional_arc = { ...dd.emotional_arc, values: dd.emotional_arc.values.filter((_, i) => i !== idx) };
            if (dd.directors_notes?.notes) dd.directors_notes = { ...dd.directors_notes, notes: dd.directors_notes.notes.filter((_, i) => i !== idx) };
            updated.directorData = dd;
          }
          return updated;
        });
        setGenerations([...generationsRef.current]);
        return true;

      case 'story_deleted':
        setScenes([]);
        setUserPrompt(null);
        setError(null);
        setGenerating(false);
        setDirectorData(null);
        if (setDirectorLiveNotes) setDirectorLiveNotes([]);
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

      case 'portraits_loading':
        setPortraitsLoading(true);
        return true;

      case 'portraits_done':
        setPortraitsLoading(false);
        return true;

      case 'usage_update':
        if (setUsage) setUsage({ usage: data.usage, limits: data.limits });
        return true;

      case 'error':
        setError(data.content);
        addToastRef.current?.(data.content, 'error');
        return true;

      // ── Director Chat handlers ──
      case 'director_chat_started':
        if (setDirectorChatActive) setDirectorChatActive(true);
        if (setDirectorChatLoading) setDirectorChatLoading(false);
        addToastRef.current?.('Director mode entered', 'success');
        if (data.audio_url && setDirectorChatMessages) {
          setDirectorChatMessages(prev => [...prev, {
            id: `director-greeting-${++_msgId}`,
            role: 'director',
            type: 'audio',
            audioUrl: data.audio_url,
          }]);
        }
        return true;

      case 'director_chat_response':
        if (setDirectorChatLoading) setDirectorChatLoading(false);
        if (setDirectorChatMessages) {
          setDirectorChatMessages(prev => [...prev, {
            id: `director-${++_msgId}`,
            role: 'director',
            type: 'audio',
            audioUrl: data.audio_url,
          }]);
        }
        return true;

      case 'director_chat_user_transcript':
        if (setDirectorChatMessages) {
          setDirectorChatMessages(prev => {
            // Find the latest user voice message and add transcript
            const updated = [...prev];
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].role === 'user' && updated[i].type === 'audio' && !updated[i].transcript) {
                updated[i] = { ...updated[i], transcript: data.content };
                break;
              }
            }
            return updated;
          });
        }
        return true;

      case 'director_chat_suggestion':
        if (setDirectorChatLoading) setDirectorChatLoading(false);
        if (setDirectorChatPrompt) setDirectorChatPrompt(data.content);
        return true;

      case 'director_chat_ended':
        if (setDirectorChatActive) setDirectorChatActive(false);
        if (setDirectorChatMessages) setDirectorChatMessages([]);
        if (setDirectorChatPrompt) setDirectorChatPrompt(null);
        return true;

      case 'director_chat_generate':
        if (setDirectorAutoGenerate) {
          setDirectorAutoGenerate({
            prompt: data.prompt,
            artStyle: data.art_style,
            sceneCount: data.scene_count,
            language: data.language,
          });
        }
        return true;

      case 'director_chat_error':
        if (setDirectorChatLoading) setDirectorChatLoading(false);
        addToastRef.current?.(data.content || 'Director chat error', 'error');
        return true;

      default:
        return false;
    }
  };
}
