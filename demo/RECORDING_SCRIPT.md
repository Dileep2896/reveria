# Reveria Demo Recording Script

> 2-minute video for Gemini Live Agent Challenge
> Judging: Innovation 40% | Technical 30% | Demo 30%

## Pre-Recording Checklist

- [ ] Dark theme enabled
- [ ] Browser at 1920x1080 (full screen, no bookmarks bar)
- [ ] Pro tier account (no usage limits showing)
- [ ] 2-3 previously saved stories in Library (for montage)
- [ ] Director voice set to preferred choice (Settings > Director Voice)
- [ ] Language set to English
- [ ] OBS or macOS screen recording ready
- [ ] **IMPORTANT**: System audio capture enabled (for Director voice)
  - macOS: OBS + BlackHole or QuickTime with audio loopback
- [ ] Practice overlay shortcuts: `` ` `` toggle, `` `+1 `` thru `` `+5 ``
- [ ] Close all other apps, notifications off

## Recommended Prompts (pre-tested)

**First prompt (Storybook):**
> A lighthouse keeper on a remote island discovers a glowing message in a bottle that reveals a map to a place that shouldn't exist

**Director brainstorm direction:**
> I want the map to lead to an underwater city that only appears during a lunar eclipse. Make it mysterious and atmospheric.

**Backup prompts (if safety filter blocks):**
> A clockmaker in a quiet mountain village discovers that one of her antique clocks can open doors to different time periods

> A wandering musician finds a melody that can make flowers bloom, but each song takes a piece of their memory

---

## THE SCRIPT

### ACT 1: HOOK + FIRST GENERATION (0:00 - 0:50)

```
TIME    ACTION                              VOICEOVER (record separately or narrate live)
────────────────────────────────────────────────────────────────────────────────────────────

0:00    App is open, template carousel       "This is Reveria, an AI story engine
        visible. Slowly scroll through        built with Google's Gemini, Imagen,
        2-3 templates.                        and Agent Development Kit."

0:08    Select "Storybook" template.          "You describe a story..."
        Art style: Cinematic (default).

0:12    Type or paste the prompt into         "...and watch it come alive."
        the control bar. Click Send.

0:18    Generation starts. Book cover         (Let the generation breathe for
        pulses, then flips open.              2-3 seconds, no talking)

0:20    >>> PRESS `+1 (Pipeline overlay)      "Under the hood, Google's ADK
        Hold for ~5 seconds.                  orchestrates a SequentialAgent.
        Point out the pulsing nodes.          Each scene spawns parallel tasks
                                              for Imagen, Gemini Audio, and
                                              Director analysis."

0:25    >>> PRESS ` (close overlay)           (Silence. Let the magic happen.)
        Watch scene text stream in,
        image paint in with shimmer,
        audio player appear.

0:35    Flip to the generated scene page.     "Text, images, and narration
        Click the audio play button           stream in real-time per scene."
        briefly (~3 seconds of audio).

0:42    >>> PRESS `+5 (Evolution overlay)     "We iterated across 60+ sessions,
        Hold for ~5 seconds.                  evolving from naive prompts to
                                              Visual DNA anchoring, from batch
                                              pipelines to per-scene streaming."

0:47    >>> PRESS ` (close overlay)
        Brief pause on the book.
```

### ACT 2: DIRECTOR CHAT - THE STAR (0:50 - 1:35)

```
TIME    ACTION                              VOICEOVER
────────────────────────────────────────────────────────────────────────────────────────────

0:50    Open Director panel (if not           "Now for the key feature:
        already visible).                     Director Chat, powered by
        Click "Talk to Director" CTA.         the Gemini Live API."

0:55    >>> PRESS `+2 (Director overlay)      "A persistent bidirectional audio
        Hold for ~5 seconds.                  session with native tool calling.
                                              The Director decides when
                                              brainstorming is done."

1:00    >>> PRESS ` (close overlay)
        Director's greeting audio plays.      (Let the Director's voice play.
        Wait for it to finish.                This is the demo's wow moment.)

1:05    Start speaking to the Director:       YOUR ACTUAL VOICE:
        "I want the map to lead to an         (Speak naturally, conversational)
        underwater city that only appears
        during a lunar eclipse. Make it
        mysterious and atmospheric."

1:12    Director responds with voice.         (Let the Director respond fully.
        Wait for audio to finish.             Show the transcript appearing.)
        Show the orb animating.

1:18    Say: "Yes, let's do it!              YOUR ACTUAL VOICE:
        Generate the story."                  (Confirm naturally)

        OR if tool calling doesn't fire:
        Click "Suggest" button as fallback.

1:22    Director triggers generation.         "The Director called the
        Orb switches to watching state        generate_story tool natively.
        (eye icon, pulse).                    No separate API call needed."

1:25    New scene generates. Show             (Brief silence, let generation
        Director live notes appearing         play. Point at Director panel
        in the panel during generation.       showing live analysis.)

1:32    Generation completes.                 "Real-time creative collaboration
                                              between two AI agents."
```

### ACT 3: INFRASTRUCTURE + CLOSE (1:35 - 2:00)

```
TIME    ACTION                              VOICEOVER
────────────────────────────────────────────────────────────────────────────────────────────

1:35    >>> PRESS `+3 (Cloud overlay)         "Running on Google Cloud: Cloud Run
        Hold for ~5 seconds.                  backend, Firebase Hosting, Firestore,
                                              Vertex AI Imagen, all connected
                                              via WebSocket streaming."

1:40    >>> PRESS `+4 (CI/CD overlay)         "Fully automated CI/CD: push to main
        Hold for ~4 seconds.                  triggers tests and deploys to
                                              Cloud Run and Firebase."

1:44    >>> PRESS ` (close overlay)
        Click Library in header.              "Every story is saved to your
        Show the Library with book cards.     personal library."

1:48    Click on one of the pre-made          (Brief pause on a nice-looking
        books. Show the book spread.          story spread)

1:52    Navigate back. Show the final         "Reveria. Stories from your
        story spread from this session.       imagination."

1:55    End on a beautiful book spread.       "Built for the Gemini Live Agent
        Hold for 5 seconds.                   Challenge with Google ADK, Gemini
                                              Live API, and Imagen 3."

2:00    END
```

---

## Overlay Shortcut Cheat Sheet

| Shortcut | Slide | When to Show |
|----------|-------|-------------|
| `` `+1 `` | ADK Agent Pipeline | During first generation (0:20) |
| `` `+2 `` | Gemini Live API | Before Director conversation (0:55) |
| `` `+3 `` | Google Cloud Arch | After Director generation (1:35) |
| `` `+4 `` | CI/CD Pipeline | Right after Cloud slide (1:40) |
| `` `+5 `` | Iterative Evolution | During first generation gap (0:42) |
| `` ` `` | Toggle open/close | Close any overlay |

---

## Recording Tips

### Audio Setup
1. **Screen recording captures**: System audio (Director's voice, narration playback)
2. **Separate track**: Your voiceover (either live or post-production)
3. Best approach: Record screen with system audio, add voiceover in post

### macOS Screen Recording with Audio
- **OBS Studio**: Add "Display Capture" + "Audio Output Capture" (needs BlackHole)
- **QuickTime**: Screen Recording > Options > select audio input
- Alternative: Just use OBS, it handles everything

### If Something Goes Wrong
- Safety filter blocks prompt? Use a backup prompt (listed above)
- Director doesn't call tool? Click "Suggest" button (it's a valid fallback, mention it)
- Image generation fails? Keep going, mention "circuit breakers handle errors gracefully"
- Generation takes too long? Show an overlay while waiting (fill dead time)

### Post-Production (Optional)
- Trim dead time (waiting for generation)
- Add subtle background music (lo-fi, very quiet)
- Add text callouts for key moments
- Ensure total runtime is under 2:00

---

## What Judges Want to See (Mapped to Script)

### Innovation & Multimodal UX (40%)
- **Director voice chat** (ACT 2) - the centerpiece, most time allocated
- **Real-time streaming** (ACT 1) - text + image + audio arriving live
- **Evolution slide** (0:42) - shows deep iteration, not a weekend hack

### Technical Implementation (30%)
- **Pipeline overlay** (0:20) - ADK agent architecture
- **Cloud overlay** (1:35) - production GCP deployment
- **CI/CD overlay** (1:40) - automated deployment proof

### Demo & Presentation (30%)
- **Clean, polished UI** - glassmorphism, book animations, template variety
- **Natural flow** - not rushing, letting moments breathe
- **Working product** - real generation, real API calls, real results
