import { ALL_FORMATS, Input, UrlSource, type AudioCodec } from 'mediabunny'

/**
 * An audio track as the file's container describes it, whether or not the native <video> element can
 * decode it. `id` and `label` are built the same way the custom player builds its own track list, so a
 * pick made here carries straight over when playback switches to the custom player.
 */
export interface ContainerAudioTrack {
  id: string
  language: string
  label: string
  codec: AudioCodec | null
  /** The native <video> element can decode this codec. */
  native: boolean
}

// RFC 6381 codec strings for asking the native element what it can decode. Asked of the element rather
// than kept as a list, so an Electron build with more decoders is picked up without a code change.
// Measured on stock Electron 44 (2026-09-30): aac, mp3, opus, vorbis, flac and pcm answer "probably";
// ac3, eac3, dts, truehd and alac answer "" and never appear in video.audioTracks.
const NATIVE_TYPE: Partial<Record<AudioCodec, string>> = {
  aac: 'audio/mp4; codecs="mp4a.40.2"',
  mp3: 'audio/mpeg',
  opus: 'audio/webm; codecs="opus"',
  vorbis: 'audio/webm; codecs="vorbis"',
  flac: 'audio/flac',
  ac3: 'audio/mp4; codecs="ac-3"',
  eac3: 'audio/mp4; codecs="ec-3"',
  dts: 'audio/mp4; codecs="dtsc"',
  truehd: 'audio/mp4; codecs="mlpa"',
  alac: 'audio/mp4; codecs="alac"'
}

const nativeSupport = new Map<AudioCodec, boolean>()

function nativelyDecodable (codec: AudioCodec | null): boolean {
  if (!codec) return false
  const cached = nativeSupport.get(codec)
  if (cached !== undefined) return cached
  const type = NATIVE_TYPE[codec] ?? (codec.startsWith('pcm') || codec === 'ulaw' || codec === 'alaw' ? 'audio/wav' : null)
  const supported = !!type && document.createElement('video').canPlayType(type) !== ''
  nativeSupport.set(codec, supported)
  return supported
}

/** Reads the container's audio track list from the file's headers. Only metadata is fetched. */
export async function probeContainerAudio (url: string): Promise<ContainerAudioTrack[]> {
  const input = new Input({ source: new UrlSource(url), formats: ALL_FORMATS })
  try {
    const tracks = await input.getAudioTracks()
    return await Promise.all(tracks.map(async track => {
      const [languageCode, codec] = await Promise.all([track.getLanguageCode(), track.getCodec()])
      return {
        id: `${track.id}`,
        language: (!languageCode || languageCode === 'und') ? '' : languageCode,
        label: track.name?.trim() || `${codec?.toUpperCase() || 'audio'} ${track.number}`,
        codec,
        native: nativelyDecodable(codec)
      }
    }))
  } finally {
    input.dispose()
  }
}

/** The track playback should be on: the preferred language, else Japanese, else the first one. */
export function preferredAudioTrack<T extends { language: string }> (tracks: T[], preferredLanguage: string): T | undefined {
  return tracks.find(track => track.language === preferredLanguage) ?? tracks.find(track => track.language === 'jpn') ?? tracks[0]
}
