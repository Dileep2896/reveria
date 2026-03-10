/**
 * WebSocket message handler dispatch map.
 * Each handler receives (data, state) and returns true if handled.
 */

let _msgId = 0;

/**
 * Detect story language from transcript text via Unicode script ranges.
 * Returns a supported language key or null if Latin/ambiguous.
 */
function detectScriptLanguage(text) {
  if (!text || text.length < 3) return null;
  // Count characters in each script range
  let devanagari = 0, cjk = 0, hiraganaKatakana = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x0900 && cp <= 0x097F) devanagari++;
    else if (cp >= 0x4E00 && cp <= 0x9FFF) cjk++;
    else if ((cp >= 0x3040 && cp <= 0x309F) || (cp >= 0x30A0 && cp <= 0x30FF)) hiraganaKatakana++;
  }
  const total = text.replace(/\s/g, '').length;
  if (!total) return null;
  const threshold = 0.3; // 30% of non-space chars
  if (devanagari / total > threshold) return 'Hindi';
  if (hiraganaKatakana / total > threshold) return 'Japanese';
  if (cjk / total > threshold) return 'Chinese';
  // Spanish/French/German/Portuguese can't be detected by script alone (all Latin)
  return null;
}

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
  setHeroMode,
  onLanguageDetected,
  onNavigate,
  onAudioChunk,
  onAudioDone,
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
          // Don't clear directorLiveNotes — accumulate across generations
        }
        // Track hero photo analysis in progress
        if (data.content === 'analyzing_photo' && setHeroMode) {
          setHeroMode(prev => ({ ...prev, analyzing: true }));
        }
        return true;

      case 'text': {
        // Discard stale scene data after reset (story switched)
        if (!storyIdRef.current) return true;
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
        if (!storyIdRef.current) return true;
        setScenes((prev) =>
          prev.map((scene) =>
            scene.scene_number === data.scene_number
              ? {
                  ...scene,
                  image_url: data.content,
                  image_tier: data.tier || 1,
                  image_brief: data.image_brief || null,
                  // Preserve existing text_overlays if message doesn't provide new ones
                  ...(data.text_overlays ? { text_overlays: data.text_overlays } : {}),
                }
              : scene,
          ),
        );
        return true;

      case 'audio':
        if (!storyIdRef.current) return true;
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
        // Backend now analyzes ALL scenes per batch — latest data is complete
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
        if (!storyIdRef.current) return true;
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

      case 'hero_status':
        if (setHeroMode) setHeroMode(prev => ({
          active: !!data.enabled, description: data.description || '', heroName: data.hero_name || prev?.heroName || '', analyzing: false,
        }));
        // Only toast on fresh activation, not on resume restore
        if (data.enabled && !data.restored) {
          addToastRef.current?.('Hero Mode active!', 'success');
        }
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
        if (setDirectorChatMessages && data.audio_url) {
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
        // Auto-detect language from script (Hindi, Japanese, Chinese)
        if (onLanguageDetected) {
          const detected = detectScriptLanguage(data.content);
          if (detected) onLanguageDetected(detected);
        }
        return true;

      case 'director_chat_suggestion':
        if (setDirectorChatLoading) setDirectorChatLoading(false);
        if (setDirectorChatPrompt) setDirectorChatPrompt(data.content);
        return true;

      case 'director_chat_ended':
        if (setDirectorChatActive) setDirectorChatActive(false);
        if (setDirectorChatMessages) setDirectorChatMessages([]);
        if (setDirectorChatLoading) setDirectorChatLoading(false);
        if (setDirectorChatPrompt) setDirectorChatPrompt(null);
        return true;

      case 'director_chat_generate':
        if (setDirectorAutoGenerate) {
          setDirectorAutoGenerate({
            prompt: data.prompt,
            artStyle: data.art_style,
            sceneCount: data.scene_count,
            language: data.language,
            template: data.template,
          });
        }
        return true;

      case 'director_chat_audio_chunk':
        // Streaming PCM chunk — feed to Web Audio for immediate playback
        if (setDirectorChatLoading) setDirectorChatLoading(false);
        if (onAudioChunk && data.data) onAudioChunk(data.data);
        return true;

      case 'director_chat_audio_done':
        // Stream complete — transcripts and metadata arrive here
        if (setDirectorChatLoading) setDirectorChatLoading(false);
        if (onAudioDone) onAudioDone(data);
        return true;

      case 'director_chat_navigate':
        if (onNavigate && data.destination) {
          onNavigate(data.destination);
        }
        return true;

      case 'director_chat_error':
        if (setDirectorChatLoading) setDirectorChatLoading(false);
        addToastRef.current?.(data.content || 'Director chat error', 'error');
        // Only tear down chat on fatal errors or if session never started (no messages)
        if (data.fatal) {
          if (setDirectorChatActive) setDirectorChatActive(false);
          if (setDirectorChatMessages) setDirectorChatMessages([]);
          if (setDirectorChatPrompt) setDirectorChatPrompt(null);
        }
        return true;

      default:
        return false;
    }
  };
}
