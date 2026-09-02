# TheraSync demo video

These Remotion compositions are captioned walkthroughs of the current local
TheraSync build. The three-minute cut follows the supplied recording guide:
architecture, crisis circuit breaker, structured triage, human approval and
database commitment, then a short close.

The production cut adds an HTML/React replay of the product states inside the
browser window: a typed intake, WebMCP tool registry, flowing typed-contract
events, recurring-session progress, safety intercept, approval guard, and the
post-commit confirmation. The labels and transitions mirror
`frontend/src/TheraSyncApp.tsx` and `backend/server.js`; it does not portray
the fictional directory as a real clinical service. The five scene MP3 files
under `public/audio/` are the generated narration track.

## Render

From this directory:

```bash
npm install
npm run render
```

The short cut is written to `out/therasync-demo.mp4`. For the production
three-minute cut, run:

```bash
npm run render:3min
```

That writes `out/therasync-webmcp-challenge.mp4` at 1600x900, 30fps and
exactly three minutes. `npm run render:final` is an alias. Use `npm run dev`
to preview either composition in Remotion Studio.

## Optional ElevenLabs narration

The MP3 files under `public/audio/` make the video renderable without
credentials. The default generator selects Matilda, an English-language
professional educational narrator, and Eleven v3 for a warm, unhurried
product-demo delivery. To regenerate it, set the key in your shell:

```bash
export ELEVENLABS_API_KEY="your-key"
export ELEVENLABS_VOICE_ID="XrExE9yKIg1WjnnlVkGX"
export ELEVENLABS_MODEL_ID="eleven_v3"
npm run generate:voiceover
npm run render:final
```

The generator calls ElevenLabs from Node, so the API key is never sent to the
browser or embedded in the Remotion bundle. Eleven v3 does not offer a speed
parameter; the narration is paced with voice choice, clear punctuation, and
the actual generated audio durations instead of time-compressing speech.
Use a non-v3 model with `ELEVENLABS_MODEL_ID` only when you specifically need
the optional `ELEVENLABS_SPEED` setting.

`fit:voiceover` remains available only for legacy non-v3 narration. Do not use
it for the production V3 cut: its scene durations are measured and laid out
natively so there are no post-narration still holds or clipped words.
