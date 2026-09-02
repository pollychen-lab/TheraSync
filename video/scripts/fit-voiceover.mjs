import { rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

const execFile = promisify(execFileCallback);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const audioDir = join(dirname(scriptDir), "public", "audio");
const sceneDurations = {
  "01-intro.mp3": 30,
  "02-crisis.mp3": 45,
  "03-triage.mp3": 45,
  "04-booking.mp3": 45,
  "05-close.mp3": 15,
};

const probeDuration = async (file) => {
  const { stdout } = await execFile("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  return Number(stdout.trim());
};

for (const [filename, targetSeconds] of Object.entries(sceneDurations)) {
  const source = join(audioDir, filename);
  const before = await probeDuration(source);
  const tempo = before / targetSeconds;
  const temporary = `${source}.fit.mp3`;

  await execFile("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", source,
    "-vn",
    "-af", `atempo=${tempo}`,
    "-t", String(targetSeconds),
    "-codec:a", "libmp3lame",
    "-q:a", "2",
    temporary,
  ]);
  await rename(temporary, source);

  const after = await probeDuration(source);
  console.log(`${filename}: ${before.toFixed(2)}s -> ${after.toFixed(2)}s (target ${targetSeconds}s)`);
}
