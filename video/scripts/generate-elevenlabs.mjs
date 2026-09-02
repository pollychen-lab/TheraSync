import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const videoDir = dirname(scriptDir);
const voiceoverDir = join(videoDir, "voiceover");
const outputDir = join(videoDir, "public", "audio");

const apiKey = process.env.ELEVENLABS_API_KEY;
// Matilda is an English-language, professional educational narrator. It is a
// better fit for a calm product walkthrough than an artificially accelerated
// voice. Override this with any voice from the account when needed.
const voiceId = process.env.ELEVENLABS_VOICE_ID || "XrExE9yKIg1WjnnlVkGX";
const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_v3";
const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
const isV3 = modelId === "eleven_v3";
const requestedSpeed = process.env.ELEVENLABS_SPEED === undefined ? null : Number(process.env.ELEVENLABS_SPEED);
const clampSpeed = (value) => (Number.isFinite(value) ? Math.min(1.2, Math.max(0.7, value)) : 1);

if (!apiKey) {
  console.error("Missing ELEVENLABS_API_KEY. Set it in your shell; never commit it to the repository.");
  process.exit(1);
}

const requestedFiles = (process.env.ELEVENLABS_ONLY || "")
  .split(",")
  .map((file) => file.trim())
  .filter(Boolean);
const scriptFiles = (await readdir(voiceoverDir))
  .filter((file) => file.endsWith(".txt"))
  .filter((file) => requestedFiles.length === 0 || requestedFiles.includes(file))
  .sort();

if (scriptFiles.length === 0) {
  throw new Error(`No matching voiceover scripts found in ${voiceoverDir}`);
}

await mkdir(outputDir, { recursive: true });

if (isV3 && requestedSpeed !== null) {
  console.warn("ELEVENLABS_SPEED is ignored for eleven_v3. Use natural punctuation and audio direction in the script instead.");
}

for (const scriptFile of scriptFiles) {
  const text = (await readFile(join(voiceoverDir, scriptFile), "utf8")).trim();
  const target = join(outputDir, `${basename(scriptFile, extname(scriptFile))}.mp3`);
  const speed = clampSpeed(requestedSpeed ?? 1);
  const endpoint = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`);
  endpoint.searchParams.set("output_format", outputFormat);
  const voiceSettings = {
    // "Natural" stability: expressive enough for v3 direction, but stable
    // enough to keep a coherent, professional narrator across five scenes.
    stability: 0.55,
    similarity_boost: 0.78,
    style: 0,
    use_speaker_boost: true,
  };

  // Eleven v3 has no speed control. The prior cut used speed plus FFmpeg
  // fitting, which made some phrases sound hurried. Other models can still
  // opt into the documented 0.7–1.2 speed range for backwards compatibility.
  if (!isV3) {
    voiceSettings.speed = speed;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: voiceSettings,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`ElevenLabs failed for ${scriptFile} (${response.status}): ${details.slice(0, 500)}`);
  }

  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  console.log(`Generated ${target} with ${isV3 ? "native v3 pacing" : `speed ${speed}`}`);
}

console.log(`Generated ${scriptFiles.length} ElevenLabs narration tracks with voice ${voiceId} (${modelId}).`);
