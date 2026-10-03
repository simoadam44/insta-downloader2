// True MP4 -> MP3 transcoding, done entirely in the browser.
// Rationale: serverless/edge runtimes have no ffmpeg, so the previous
// "MP3" download was just the MP4 bytes renamed to .mp3 (it played back as
// video). This decodes the real audio track (Web Audio) and re-encodes it as
// genuine MPEG audio (lamejs), producing an audio-only file.
// Cost control: lamejs is dynamically imported on first use, so the main
// bundle stays lean; the encoder chunk loads only when MP3 is requested.
// On ANY failure the caller must fall back to downloading the original file
// (something beats nothing) — this function never swallows success paths.

export const TRANSCODED_MP3_KBPS = 192;

// Memory guard: transcoding very long media in-page can OOM mobile browsers.
const MAX_DURATION_S = 600;

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function transcodeVideoToMp3(videoUrl: string): Promise<Blob> {
  const res = await fetch(videoUrl, { mode: 'cors' });
  if (!res.ok) throw new Error(`media fetch failed: HTTP ${res.status}`);
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength) throw new Error('empty media file');

  const AC: typeof AudioContext | undefined =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error('Web Audio unavailable in this browser');

  const ctx = new AC();
  try {
    // decodeAudioData detaches its input — pass a copy.
    // Given an MP4 container, browsers decode its audio track (no video).
    const audio = await ctx.decodeAudioData(bytes.slice(0));
    if (!audio || audio.numberOfChannels < 1 || audio.length === 0) {
      throw new Error('no decodable audio track');
    }
    if (audio.duration > MAX_DURATION_S) throw new Error('media too long for in-browser conversion');

    const { Mp3Encoder } = await import('@breezystack/lamejs');
    const channels = Math.min(2, audio.numberOfChannels);
    const encoder = new Mp3Encoder(channels, audio.sampleRate, TRANSCODED_MP3_KBPS);
    const left = floatTo16BitPCM(audio.getChannelData(0));
    const right = channels > 1 ? floatTo16BitPCM(audio.getChannelData(1)) : undefined;

    const FRAME = 1152;
    const parts: Uint8Array[] = [];
    for (let i = 0; i < left.length; i += FRAME) {
      const l = left.subarray(i, i + FRAME);
      const enc = right ? encoder.encodeBuffer(l, right.subarray(i, i + FRAME)) : encoder.encodeBuffer(l);
      if (enc.length > 0) parts.push(enc);
    }
    const tail = encoder.flush();
    if (tail.length > 0) parts.push(tail);
    if (parts.length === 0) throw new Error('encoder produced no output');
    return new Blob(parts as BlobPart[], { type: 'audio/mpeg' });
  } finally {
    try {
      await ctx.close();
    } catch {
      // AudioContext cleanup is best-effort.
    }
  }
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  }
}
