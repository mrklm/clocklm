import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
} from 'react';
import { AppShell } from './components/AppShell';
import { AnalogClockCard } from './features/clocks/components/AnalogClockCard';
import { FlipClockCard } from './features/clocks/components/FlipClockCard';
import { SevenSegmentClockCard } from './features/clocks/components/SevenSegmentClockCard';
import { DISPLAY_MODES } from './features/clocks/constants';
import { useSystemTime } from './features/clocks/hooks/useSystemTime';
import { DEFAULT_THEME_NAME, THEMES } from './themes/themes';
import type { ClockDisplayDefinition, ClockDisplayId } from './types/clock';
import type { ThemePalette } from './types/theme';
import optionsIconUrl from '../assets/options.svg';
import pinceauIconUrl from '../assets/pinceau.svg';
import clocklmIconUrl from '../assets/clocklm.png';
import packageJson from '../package.json';
import './styles/app.css';

type LiveAudioSource = 'radio' | 'directory';
type LiveDirectoryPlaybackMode = 'normal' | 'repeat' | 'shuffle';
type OptionsTabId = 'appearance' | 'music' | 'alarms';
type AlarmMode = 'visual' | 'radio' | 'file';
type VuMeterMode = 'floating' | 'integrated';
type VuMeterDisplay = 'clock' | 'vu-meter' | 'clock-and-vu-meter';
type VuMeterStyle =
  | 'needle-duo'
  | 'led-mono'
  | 'led-stereo'
  | 'led-horizontal-mono'
  | 'led-horizontal-stereo'
  | 'spectrum-rainbow'
  | 'wave-scope'
  | 'mini-bars';
type VuMeterWindowPayload = {
  style: VuMeterStyle;
  levels: number[];
  waveform: number[];
  theme: ThemePalette;
  playing: boolean;
};
type AlarmDefinition = {
  id: string;
  time: string;
  name: string;
  frequency: 'once' | 'weekdays' | 'daily';
  color: string;
  mode: AlarmMode;
  radioStationId: string;
  fileName: string;
};

type LautFmStation = {
  id: string;
  name: string;
  style: string;
  url: string;
  pageUrl: string;
  provider?: 'lautfm' | 'custom';
  metadataUrl?: string;
  metadataFallbackUrl?: string;
  metadataStrategy?: 'json-result' | 'bigfm-html';
};

type LautFmCurrentSong = {
  artistName: string;
  title: string;
};

type NativeVuMeterPayload = {
  left: number;
  right: number;
  waveform?: number[];
  timestamp?: number;
};

type NativeDirectoryTrack = {
  name: string;
  path: string;
  relativePath: string;
};

type NativeDirectorySelectionPayload = {
  directoryName: string;
  tracks: NativeDirectoryTrack[];
};

type LiveDirectoryTrack = {
  name: string;
  relativePath: string;
  sourceUrl: string;
  revokeOnClear?: boolean;
};

const STREAM_FETCH_TIMEOUT_MS = 5000;
const STREAM_PLAY_TIMEOUT_MS = 7000;
const VU_METER_TARGET_FPS = 24;
const VU_METER_WINDOW_LABEL = 'vu-meter-window';
const VU_METER_EVENT = 'clocklm://vu-meter';
const VU_METER_SYSTEM_EVENT = 'clocklm://vu-meter-system';
const VU_METER_STYLE_OPTIONS: Array<{ value: VuMeterStyle; label: string }> = [
  { value: 'needle-duo', label: 'Analogique' },
  { value: 'led-mono', label: 'Leds vertical mono' },
  { value: 'led-stereo', label: 'Leds vertical stereo' },
  { value: 'led-horizontal-mono', label: 'Leds horizontal mono vintage' },
  { value: 'led-horizontal-stereo', label: 'Leds horizontal stereo vintage' },
  { value: 'wave-scope', label: 'Forme d onde' },
];
const VU_METER_DISPLAY_OPTIONS: Array<{ value: VuMeterDisplay; label: string }> = [
  { value: 'clock', label: 'Heure' },
  { value: 'vu-meter', label: 'VU-metre' },
  { value: 'clock-and-vu-meter', label: 'Heure + VU-metre' },
];

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function isTauriRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  return '__TAURI_INTERNALS__' in window;
}

function getMediaErrorLabel(error: MediaError | null | undefined) {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'aborted';
    case MediaError.MEDIA_ERR_NETWORK:
      return 'network';
    case MediaError.MEDIA_ERR_DECODE:
      return 'decode';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'src_not_supported';
    default:
      return 'unknown';
  }
}

function buildAudioDebugSnapshot(audio: HTMLAudioElement | null | undefined) {
  if (!audio) {
    return { present: false };
  }

  return {
    present: true,
    src: audio.currentSrc || audio.src || '',
    paused: audio.paused,
    ended: audio.ended,
    readyState: audio.readyState,
    networkState: audio.networkState,
    currentTime: Number.isFinite(audio.currentTime) ? Number(audio.currentTime.toFixed(3)) : 0,
    duration: Number.isFinite(audio.duration) ? Number(audio.duration.toFixed(3)) : null,
    volume: Number.isFinite(audio.volume) ? Number(audio.volume.toFixed(3)) : 1,
    muted: audio.muted,
    crossOrigin: audio.crossOrigin || 'none',
    error: getMediaErrorLabel(audio.error),
  };
}

function logDesktopMediaDebug(scope: string, details?: Record<string, unknown>) {
  if (!isTauriRuntime()) {
    return;
  }

  if (details) {
    console.info(`[clocklm][desktop-media] ${scope}`, details);
    return;
  }

  console.info(`[clocklm][desktop-media] ${scope}`);
}

function sampleWaveform(values: Uint8Array, points = 48) {
  if (values.length === 0 || points <= 0) {
    return [];
  }

  return Array.from({ length: points }, (_, index) => {
    const sampleIndex = Math.min(
      values.length - 1,
      Math.floor((index / Math.max(points - 1, 1)) * values.length),
    );
    return clamp01(values[sampleIndex] / 255);
  });
}

function computeRmsLevel(values: Uint8Array) {
  if (values.length === 0) {
    return 0;
  }

  let sum = 0;
  for (const value of values) {
    const centered = (value - 128) / 128;
    sum += centered * centered;
  }

  return clamp01(Math.sqrt(sum / values.length) * Math.SQRT2);
}

function averageFrequencyData(left: Uint8Array, right: Uint8Array) {
  const length = Math.min(left.length, right.length);
  return Uint8Array.from({ length }, (_, index) =>
    Math.round(((left[index] ?? 0) + (right[index] ?? 0)) / 2),
  );
}

function averageWaveformData(left: Uint8Array, right: Uint8Array) {
  const length = Math.min(left.length, right.length);
  return Uint8Array.from({ length }, (_, index) =>
    Math.round(((left[index] ?? 128) + (right[index] ?? 128)) / 2),
  );
}

function smoothVuLevels(nextLevels: number[], previousLevels: number[]) {
  return nextLevels.map((level, index) => {
    const previousLevel = previousLevels[index] ?? 0;
    const smoothingFactor = level >= previousLevel ? 0.38 : 0.16;
    return clamp01(previousLevel + (level - previousLevel) * smoothingFactor);
  });
}

function buildVuMeterColumns(values: Uint8Array, columns = 16) {
  if (values.length === 0 || columns <= 0) {
    return [];
  }

  const bucketSize = Math.max(1, Math.floor(values.length / columns));

  return Array.from({ length: columns }, (_, index) => {
    const start = index * bucketSize;
    const end = index === columns - 1 ? values.length : Math.min(values.length, start + bucketSize);
    let sum = 0;

    for (let cursor = start; cursor < end; cursor += 1) {
      sum += values[cursor] ?? 0;
    }

    const average = sum / Math.max(end - start, 1);
    return clamp01(average / 255);
  });
}

function VuMeter({
  enabled,
  mode,
  style,
  levels,
  waveform,
  windowed = false,
}: {
  enabled: boolean;
  mode: VuMeterMode;
  style: VuMeterStyle;
  levels: number[];
  waveform: number[];
  windowed?: boolean;
}) {
  if (!enabled) {
    return null;
  }

  const isFloating = mode === 'floating';
  const isIdle = levels.length === 0;
  const leftLevel = levels[0] ?? 0;
  const rightLevel = levels[1] ?? leftLevel;
  const barLevels = levels.length > 0 ? levels : Array.from({ length: 20 }, (_, index) =>
    index % 4 === 0 ? 0.14 : 0.08,
  );
  const waveformPath = waveform
    .map((value, index) => {
      const x = waveform.length <= 1 ? 0 : (index / (waveform.length - 1)) * 100;
      const y = 90 - value * 80;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div
      className={`vu-meter vu-meter--${mode} vu-meter--${style}${isIdle ? ' vu-meter--idle' : ''}${windowed ? ' vu-meter--windowed' : ''}`}
      aria-hidden="true"
    >
      {style === 'needle-duo' ? (
        <div className="vu-meter-needle-duo">
          {[leftLevel, rightLevel].map((level, index) => (
            <div key={index} className="vu-meter-needle-panel">
              <div className="vu-meter-needle-scale" aria-hidden="true">
                {['-20', '10', '7', '5', '3', '0', '+3'].map((label, markIndex) => (
                  <span
                    key={label}
                    className={`vu-meter-scale-mark${markIndex >= 5 ? ' vu-meter-scale-mark--hot' : ''}`}
                    style={{ '--mark-index': `${markIndex}` } as CSSProperties}
                  >
                    <span className="vu-meter-scale-tick" />
                    <span className="vu-meter-scale-label">{label}</span>
                  </span>
                ))}
              </div>
              <div className="vu-meter-needle-dial">
                <div
                  className="vu-meter-needle"
                  style={{ transform: `rotate(${level * 82 - 41}deg)` }}
                />
                <div className="vu-meter-needle-pivot" />
              </div>
              <div className="vu-meter-needle-brand">
                <span>{index === 0 ? 'L' : 'R'}</span>
                <span className="vu-meter-needle-brand-led" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {style === 'led-mono' ? (
        <div className="vu-meter-led-rack">
          <div className="vu-meter-led-rack__scale" aria-hidden="true">
            {['0', '-3', '-6', '-10', '-20'].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="vu-meter-led-stack">
            {Array.from({ length: 20 }, (_, index) => {
              const positionFromBottom = 19 - index;
              const threshold = (positionFromBottom + 1) / 20;
              const toneClass =
                positionFromBottom >= 17
                  ? ' vu-meter-led--danger'
                  : positionFromBottom >= 13
                    ? ' vu-meter-led--warm'
                    : '';
              return (
                <span
                  key={index}
                  className={`vu-meter-led${toneClass}${leftLevel >= threshold ? ' is-active' : ''}`}
                />
              );
            })}
          </div>
          <div className="vu-meter-led-rack__scale vu-meter-led-rack__scale--right" aria-hidden="true">
            {['0', '-3', '-6', '-10', '-20'].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      ) : null}

      {style === 'led-stereo' ? (
        <div className="vu-meter-led-rack vu-meter-led-rack--stereo">
          <div className="vu-meter-led-rack__scale" aria-hidden="true">
            {['0', '-3', '-6', '-10', '-20'].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="vu-meter-led-rack__stereo-columns">
            {[leftLevel, rightLevel].map((channelLevel, channelIndex) => (
              <div key={channelIndex} className="vu-meter-led-stack vu-meter-led-stack--stereo">
                {Array.from({ length: 20 }, (_, index) => {
                  const positionFromBottom = 19 - index;
                  const threshold = (positionFromBottom + 1) / 20;
                  const toneClass =
                    positionFromBottom >= 17
                      ? ' vu-meter-led--danger'
                      : positionFromBottom >= 13
                        ? ' vu-meter-led--warm'
                        : '';
                  return (
                    <span
                      key={index}
                      className={`vu-meter-led vu-meter-led--column${toneClass}${channelLevel >= threshold ? ' is-active' : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="vu-meter-led-rack__scale vu-meter-led-rack__scale--right" aria-hidden="true">
            {['0', '-3', '-6', '-10', '-20'].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      ) : null}

      {style === 'led-horizontal-mono' ? (
        <div className="vu-meter-h-led-rack vu-meter-h-led-rack--broadcast vu-meter-h-led-rack--mono-comb">
          <div className="vu-meter-h-led-row">
            <span className="vu-meter-h-led-row__label">M</span>
            <div className="vu-meter-h-led-row__segments">
              <div className="vu-meter-h-led-row__guides vu-meter-h-led-row__guides--mono-comb">
                {Array.from({ length: 10 }, (_, index) => {
                  const threshold = (index + 1) / 12;
                  return (
                    <span
                      key={`top-${index}`}
                      className={`vu-meter-h-led-guide vu-meter-h-led-guide--mono-comb${leftLevel >= threshold ? ' is-active' : ''}`}
                    />
                  );
                })}
              </div>
              <div className="vu-meter-h-led-row__segments-main">
                {Array.from({ length: 10 }, (_, index) => {
                  const threshold = (index + 1) / 12;
                  const toneClass = index >= 7 ? ' vu-meter-led--warm' : '';
                  return (
                    <span
                      key={index}
                      className={`vu-meter-h-led${toneClass}${leftLevel >= threshold ? ' is-active' : ''}`}
                    />
                  );
                })}
              </div>
              <div className="vu-meter-h-led-row__guides vu-meter-h-led-row__guides--mono-comb">
                {Array.from({ length: 10 }, (_, index) => {
                  const threshold = (index + 1) / 12;
                  return (
                    <span
                      key={`bottom-${index}`}
                      className={`vu-meter-h-led-guide vu-meter-h-led-guide--mono-comb${leftLevel >= threshold ? ' is-active' : ''}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {style === 'led-horizontal-stereo' ? (
        <div className="vu-meter-h-led-rack vu-meter-h-led-rack--stereo vu-meter-h-led-rack--stereo-comb">
          {[leftLevel, rightLevel].map((channelLevel, index) => (
            <div key={index} className="vu-meter-h-led-row">
              <span className="vu-meter-h-led-row__label">{index === 0 ? 'L' : 'R'}</span>
              <div className="vu-meter-h-led-row__segments">
                <div className="vu-meter-h-led-row__guides vu-meter-h-led-row__guides--mono-comb">
                  {Array.from({ length: 10 }, (_, guideIndex) => {
                    const threshold = (guideIndex + 1) / 12;
                    return (
                      <span
                        key={`top-${index}-${guideIndex}`}
                        className={`vu-meter-h-led-guide vu-meter-h-led-guide--mono-comb${channelLevel >= threshold ? ' is-active' : ''}`}
                      />
                    );
                  })}
                </div>
                <div className="vu-meter-h-led-row__segments-main">
                  {Array.from({ length: 10 }, (_, segmentIndex) => {
                    const threshold = (segmentIndex + 1) / 12;
                    const toneClass = segmentIndex >= 7 ? ' vu-meter-led--warm' : '';
                    return (
                      <span
                        key={segmentIndex}
                        className={`vu-meter-h-led${toneClass}${channelLevel >= threshold ? ' is-active' : ''}`}
                      />
                    );
                  })}
                </div>
                <div className="vu-meter-h-led-row__guides vu-meter-h-led-row__guides--mono-comb">
                  {Array.from({ length: 10 }, (_, guideIndex) => {
                    const threshold = (guideIndex + 1) / 12;
                    return (
                      <span
                        key={`bottom-${index}-${guideIndex}`}
                        className={`vu-meter-h-led-guide vu-meter-h-led-guide--mono-comb${channelLevel >= threshold ? ' is-active' : ''}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {style === 'spectrum-rainbow' ? (
        <div className="vu-meter-spectrum">
          {barLevels.map((level, index) => (
            <span
              key={index}
              className="vu-meter-spectrum-bar"
              style={{
                height: `${Math.max(10, level * 100)}%`,
                '--vu-meter-hue': `${(index / Math.max(barLevels.length - 1, 1)) * 320}`,
              } as CSSProperties}
            />
          ))}
        </div>
      ) : null}

      {style === 'wave-scope' ? (
        <svg className="vu-meter-wave" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={waveformPath || 'M 0 50 L 100 50'} />
        </svg>
      ) : null}

      {style === 'mini-bars' ? (
        <div className={`vu-meter-mini-bars${isFloating ? ' vu-meter-mini-bars--compact' : ''}`}>
          {barLevels.slice(0, isFloating ? 12 : 20).map((level, index) => (
            <span
              key={index}
              className="vu-meter-mini-bar"
              style={{ height: `${Math.max(14, level * 100)}%` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function VuMeterWindowApp() {
  const [payload, setPayload] = useState<VuMeterWindowPayload | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    void Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/event'),
      import('@tauri-apps/api/window'),
    ]).then(async ([coreApi, eventApi, windowApi]) => {
      if (!coreApi.isTauri()) {
        return;
      }

      const currentWindow = windowApi.getCurrentWindow();
      setIsFullscreen(await currentWindow.isFullscreen());
      unlisten = await eventApi.listen<VuMeterWindowPayload>(VU_METER_EVENT, (event) => {
        setPayload(event.payload);
      });
    }).catch(() => {});

    return () => {
      if (unlisten) {
        void unlisten();
      }
    };
  }, []);

  const theme = payload?.theme ?? THEMES[DEFAULT_THEME_NAME];

  const handleMinimize = async () => {
    const [coreApi, windowApi] = await Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/window'),
    ]);
    if (!coreApi.isTauri()) {
      return;
    }
    await windowApi.getCurrentWindow().minimize();
  };

  const handleToggleFullscreen = async () => {
    const [coreApi, windowApi] = await Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/window'),
    ]);
    if (!coreApi.isTauri()) {
      return;
    }
    const currentWindow = windowApi.getCurrentWindow();
    const nextFullscreen = !(await currentWindow.isFullscreen());
    await currentWindow.setFullscreen(nextFullscreen);
    setIsFullscreen(nextFullscreen);
  };

  return (
    <div
      className="vu-meter-window"
      style={
        {
          '--theme-bg': theme.BG,
          '--theme-panel': theme.PANEL,
          '--theme-field': theme.FIELD,
          '--theme-fg': theme.FG,
          '--theme-field-fg': theme.FIELD_FG,
          '--theme-accent': theme.ACCENT,
        } as CSSProperties
      }
    >
      <div className="vu-meter-window__toolbar">
        <div className="vu-meter-window__title-group">
          <span className="vu-meter-window__eyebrow">Clock.l.m</span>
          <strong className="vu-meter-window__title">VU-metre</strong>
        </div>
        <div className="vu-meter-window__actions">
          <button type="button" className="vu-meter-window__button" onClick={() => void handleMinimize()}>
            Reduire
          </button>
          <button type="button" className="vu-meter-window__button" onClick={() => void handleToggleFullscreen()}>
            {isFullscreen ? 'Fenetre' : 'Plein ecran'}
          </button>
        </div>
      </div>
      <div className="vu-meter-window__content">
        <VuMeter
          enabled
          mode="floating"
          style={payload?.style ?? 'needle-duo'}
          levels={payload?.levels ?? []}
          waveform={payload?.waveform ?? []}
          windowed
        />
      </div>
    </div>
  );
}

function createLautFmStation(id: string, name: string, style: string): LautFmStation {
  return {
    id,
    name,
    style,
    url: `https://stream.laut.fm/${id}`,
    pageUrl: `https://laut.fm/${id}`,
    provider: 'lautfm',
  };
}

function createCustomStation(
  id: string,
  name: string,
  style: string,
  url: string,
  pageUrl: string,
  metadataUrl?: string,
  metadataFallbackUrl?: string,
  metadataStrategy: LautFmStation['metadataStrategy'] = 'json-result',
): LautFmStation {
  return {
    id,
    name,
    style,
    url,
    pageUrl,
    provider: 'custom',
    metadataUrl,
    metadataFallbackUrl,
    metadataStrategy,
  };
}

const DEFAULT_LAUT_FM_STATIONS: LautFmStation[] = [
  createCustomStation(
    'djam-radio',
    'Le new Djam',
    'Soul / funk / jazz / world',
    'https://stream9.xdevel.com/audio1s976748-1515/stream/icecast.audio',
    'https://www.djam.radio/',
    'https://api.xdevel.com/streamsolution/web/metadata/1515/?clientId=0bc0bd3968b344ab338838b2120da61fbc0d0093',
    'https://api.radiosolution.fr/data/titrage/lebonmix-soft.json',
    'json-result',
  ),
  createCustomStation(
    'nts-slow-focus',
    'NTS Slow Focus',
    'Ambient / drone / meditation / beatless',
    'https://stream-mixtape-geo.ntslive.net/mixtape',
    'https://www.nts.live/infinite-mixtapes/slow-focus',
  ),
  createCustomStation(
    'nts-low-key',
    'NTS Low Key',
    'Lo-fi hip-hop / smooth RnB / chill',
    'https://stream-mixtape-geo.ntslive.net/mixtape2',
    'https://www.nts.live/infinite-mixtapes/low-key',
  ),
  createLautFmStation('lofi', 'laut.fm lofi', 'Lofi hip-hop / chill beats'),
  createCustomStation(
    'soma-groove-salad',
    'SomaFM Groove Salad',
    'Ambient / chill / downtempo',
    'https://ice2.somafm.com/groovesalad-128-mp3',
    'https://somafm.com/groovesalad/',
  ),
  createCustomStation(
    'nts-field-recordings',
    'NTS Field Recordings',
    'Natural ambience / soundscapes / deep calm',
    'https://stream-mixtape-geo.ntslive.net/mixtape23',
    'https://www.nts.live/infinite-mixtapes/field-recordings',
  ),
  createCustomStation(
    'nts-poolside',
    'NTS Poolside',
    'Balearic / boogie / sunset chill',
    'https://stream-mixtape-geo.ntslive.net/mixtape4',
    'https://www.nts.live/infinite-mixtapes/poolside',
  ),
  createCustomStation(
    'nts-expansions',
    'NTS Expansions',
    'Jazz / ambient / mind-expanding grooves',
    'https://stream-mixtape-geo.ntslive.net/mixtape3',
    'https://www.nts.live/infinite-mixtapes/expansions',
  ),
  createCustomStation(
    'nts-feelings',
    'NTS Feelings',
    'Sweet soul / gospel / boogie / warm grooves',
    'https://stream-mixtape-geo.ntslive.net/mixtape27',
    'https://www.nts.live/infinite-mixtapes/feelings',
  ),
  createCustomStation(
    'noods-radio',
    'Noods Radio',
    'Alternative / leftfield / community radio',
    'https://noods-radio.radiocult.fm/stream',
    'https://noodsradio.com/info',
  ),
  createCustomStation(
    'cashmere-radio',
    'Cashmere Radio',
    'Experimental / ambient / downtempo / leftfield',
    'https://cashmereradio.out.airtime.pro/cashmereradio_b',
    'https://cashmereradio.com/about/',
  ),
  createCustomStation(
    'radio-swiss-jazz',
    'Radio Swiss Jazz',
    'Jazz / standards / swing / latin',
    'https://stream.srg-ssr.ch/srgssr/rsj/mp3/128',
    'https://www.radioswissjazz.ch/en/',
  ),
  createLautFmStation('jazz', 'laut.fm jazz', 'Jazz / soul / swing'),
  createLautFmStation('jazzfm', 'laut.fm jazzfm', 'Jazz'),
  createLautFmStation('jazzdings', 'laut.fm jazzdings', 'Jazz / blues'),
  createLautFmStation('coolradio-jazz', 'laut.fm coolradio-jazz', 'Classic jazz'),
  createLautFmStation('magicblue', 'laut.fm magicblue', 'Smooth jazz / chill-out'),
  createLautFmStation('groovefm', 'laut.fm groovefm', 'Jazz / funk / acid-jazz'),
  createLautFmStation('soulmama', 'Soulmama', 'Soul / funk / jazz'),
  createLautFmStation('delasoul', 'Delasoul', 'Soul / funk / R&B'),
  createLautFmStation('soulfood', 'Soulfood', 'Soul / funk / jazz'),
  createLautFmStation('jazzrockfusion', 'Jazz Rock Fusion', 'Jazz fusion / funk'),
  createLautFmStation('bluesrockcafe', 'Blues Rock Cafe', 'Blues / rock'),
  createCustomStation(
    'soma-sonic-universe',
    'SomaFM Sonic Universe',
    'Nu jazz / experimental / groove',
    'https://ice2.somafm.com/sonicuniverse-128-mp3',
    'https://somafm.com/sonicuniverse/',
  ),
  createLautFmStation('vaporwave', 'Vaporwave', 'Vaporwave / retro'),
];
const FEATURED_ALTERNATIVE_STATION_IDS = [
  'nts-slow-focus',
  'nts-low-key',
  'lofi',
  'soma-groove-salad',
  'nts-field-recordings',
  'nts-poolside',
  'nts-expansions',
  'nts-feelings',
  'noods-radio',
  'cashmere-radio',
];
const ALARM_BADGE_COLOR_PALETTE = [
  '#ff8a3d',
  '#ff4f6d',
  '#ffb703',
  '#4cc9f0',
  '#2ec4b6',
  '#7b61ff',
  '#8ac926',
  '#fb5607',
];
const ALARM_SETTINGS_STORAGE_KEY = 'clocklm.alarm-settings';
const APP_SIGNATURE_FALLBACK = `Clock.l.m v${packageJson.version}`;
const APP_REPOSITORY_URL = 'https://github.com/mrklm/clocklm';
const DIRECTORY_INPUT_ATTRIBUTES = {
  directory: true,
  webkitdirectory: true,
  mozdirectory: true,
} as unknown as InputHTMLAttributes<HTMLInputElement>;

function renderActiveDisplay(
  display: ClockDisplayDefinition,
  currentTime: Date,
  theme: ThemePalette,
  alarmColors: string[],
  analogAlarmPreviews: Array<{
    time: string;
    color: string;
  }>,
  showDate: boolean,
  use24HourFormat: boolean,
) {
  switch (display.id) {
    case 'analog':
      return (
        <AnalogClockCard
          currentTime={currentTime}
          display={display}
          theme={theme}
          alarmPreviews={analogAlarmPreviews}
          showDate={showDate}
        />
      );
    case 'seven-segment':
      return (
        <SevenSegmentClockCard
          currentTime={currentTime}
          display={display}
          alarmColors={alarmColors}
          showDate={showDate}
          use24HourFormat={use24HourFormat}
        />
      );
    case 'flip':
      return (
        <FlipClockCard
          currentTime={currentTime}
          display={display}
          showDate={showDate}
          alarmColors={alarmColors}
          use24HourFormat={use24HourFormat}
        />
      );
    default:
      return null;
  }
}

function getThemeFamily(themeName: string) {
  if (themeName.startsWith('[Clair]')) {
    return 'light';
  }

  if (themeName.startsWith('[Pouet]')) {
    return 'playful';
  }

  return 'dark';
}

function formatAlarmMinuteKey(currentTime: Date) {
  const year = currentTime.getFullYear();
  const month = `${currentTime.getMonth() + 1}`.padStart(2, '0');
  const day = `${currentTime.getDate()}`.padStart(2, '0');
  const hours = `${currentTime.getHours()}`.padStart(2, '0');
  const minutes = `${currentTime.getMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day}-${hours}:${minutes}`;
}

function isProbablyMobileDevice() {
  if (typeof window === 'undefined') {
    return false;
  }

  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
  const smallTouchViewport = window.matchMedia('(max-width: 820px) and (pointer: coarse)').matches;

  return mobileUserAgent || smallTouchViewport;
}

function detectRenderEnvironment() {
  if (typeof window === 'undefined') {
    return {
      isAppleWebKit: false,
      supportsColorMix: true,
    };
  }

  const userAgent = window.navigator.userAgent;
  const isApplePlatform = /Macintosh|Mac OS X|iPhone|iPad|iPod/i.test(userAgent);
  const isWebKitEngine = /AppleWebKit/i.test(userAgent);
  const isChromiumFamily = /Chrome|Chromium|CriOS|Edg\//i.test(userAgent);
  const supportsColorMix =
    typeof CSS === 'undefined'
      ? true
      : CSS.supports?.('color', 'color-mix(in srgb, white 50%, black)') ?? true;

  return {
    isAppleWebKit: isApplePlatform && isWebKitEngine && !isChromiumFamily,
    supportsColorMix,
  };
}

const AUDIO_FILE_EXTENSIONS = new Set([
  'aac',
  'aif',
  'aiff',
  'alac',
  'flac',
  'm4a',
  'mp3',
  'ogg',
  'oga',
  'opus',
  'wav',
  'webm',
  'wma',
]);

function getPathParts(relativePath: string) {
  return relativePath.split('/').filter(Boolean);
}

function getFilePathParts(file: File) {
  const relativePath =
    'webkitRelativePath' in file && file.webkitRelativePath
      ? file.webkitRelativePath
      : file.name;

  return getPathParts(relativePath);
}

function isIgnoredLocalFile(file: File) {
  const pathParts = getFilePathParts(file);

  return pathParts.some((part) =>
    part === '.DS_Store'
    || part === '__MACOSX'
    || part.startsWith('._')
    || part === 'Thumbs.db',
  );
}

function hasSupportedAudioExtension(file: File) {
  const fileName = file.name.trim().toLowerCase();
  const extension = fileName.includes('.') ? fileName.split('.').pop() ?? '' : '';
  return AUDIO_FILE_EXTENSIONS.has(extension);
}

function isSupportedLocalAudioFile(file: File) {
  if (isIgnoredLocalFile(file)) {
    return false;
  }

  return file.type.startsWith('audio/') || hasSupportedAudioExtension(file);
}

function buildLiveDirectoryTrackFromFile(file: File): LiveDirectoryTrack {
  const relativePath =
    'webkitRelativePath' in file && file.webkitRelativePath
      ? file.webkitRelativePath
      : file.name;

  return {
    name: file.name,
    relativePath,
    sourceUrl: URL.createObjectURL(file),
    revokeOnClear: true,
  };
}

async function resolveStreamUrl(sourceUrl: string) {
  const trimmedUrl = sourceUrl.trim();

  if (!trimmedUrl) {
    return '';
  }

  if (!/\.m3u($|\?)/i.test(trimmedUrl) && !/\.pls($|\?)/i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), STREAM_FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(trimmedUrl, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
  if (!response.ok) {
    throw new Error('playlist_fetch_failed');
  }

  const playlistText = await response.text();
  const lines = playlistText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const streamLine = lines.find((line) => /^https?:\/\//i.test(line))
    ?? lines.find((line) => /^File\d+=https?:\/\//i.test(line));

  if (!streamLine) {
    throw new Error('playlist_parse_failed');
  }

  return streamLine.replace(/^File\d+=/i, '');
}

function getStationStreamCandidates(station: LautFmStation) {
  const trimmedUrl = station.url.trim();
  if (!trimmedUrl) {
    return [];
  }

  const candidates = [trimmedUrl];

  if (station.provider === 'lautfm' && !/\.(m3u|pls)($|\?)/i.test(trimmedUrl)) {
    candidates.push(`${trimmedUrl}.m3u`, `${trimmedUrl}.pls`);
  }

  return Array.from(new Set(candidates));
}

async function prepareStationStreamUrls(station: LautFmStation) {
  const resolvedUrls = await Promise.all(
    getStationStreamCandidates(station).map(async (candidateUrl) => {
      try {
        return await resolveStreamUrl(candidateUrl);
      } catch {
        return null;
      }
    }),
  );

  return resolvedUrls.filter((url): url is string => Boolean(url));
}

async function playAudioFromCandidates(
  candidateUrls: string[],
  options?: {
    preload?: HTMLMediaElement['preload'];
    loop?: boolean;
    preferCrossOrigin?: boolean;
    audioElement?: HTMLAudioElement | null;
  },
) {
  let lastError: unknown = null;

  for (const candidateUrl of candidateUrls) {
    const crossOriginModes = options?.preferCrossOrigin === false
      ? [null, 'anonymous'] as const
      : ['anonymous', null] as const;
    for (const crossOriginMode of crossOriginModes) {
      const audio = options?.audioElement ?? new Audio();
      logDesktopMediaDebug('playAudioFromCandidates:attempt', {
        candidateUrl,
        crossOriginMode: crossOriginMode ?? 'none',
        reusingAudioElement: Boolean(options?.audioElement),
        snapshotBefore: buildAudioDebugSnapshot(audio),
      });
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.preload = options?.preload ?? 'none';
      audio.loop = options?.loop ?? false;
      if (crossOriginMode) {
        audio.crossOrigin = crossOriginMode;
      } else {
        audio.removeAttribute('crossorigin');
      }
      audio.src = candidateUrl;

      let timeoutId: number | null = null;

      try {
        await Promise.race([
          audio.play(),
          new Promise<never>((_, reject) => {
            timeoutId = window.setTimeout(
              () => reject(new Error('audio_play_timeout')),
              STREAM_PLAY_TIMEOUT_MS,
            );
          }),
        ]);
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        logDesktopMediaDebug('playAudioFromCandidates:success', {
          candidateUrl,
          crossOriginMode: crossOriginMode ?? 'none',
          snapshotAfter: buildAudioDebugSnapshot(audio),
        });
        return audio;
      } catch (error) {
        lastError = error;
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        logDesktopMediaDebug('playAudioFromCandidates:failure', {
          candidateUrl,
          crossOriginMode: crossOriginMode ?? 'none',
          error: error instanceof Error ? error.message : String(error),
          snapshotAfter: buildAudioDebugSnapshot(audio),
        });
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    }
  }

  throw lastError ?? new Error('audio_playback_failed');
}

function normalizeLautFmStation(station: {
  name?: unknown;
  display_name?: unknown;
  format?: unknown;
  genres?: unknown;
  page_url?: unknown;
}): LautFmStation | null {
  const id = typeof station.name === 'string' ? station.name.trim() : '';
  if (!id) {
    return null;
  }

  const displayName =
    typeof station.display_name === 'string' && station.display_name.trim()
      ? station.display_name.trim()
      : id;
  const format = typeof station.format === 'string' ? station.format.trim() : '';
  const genres = Array.isArray(station.genres)
    ? station.genres.filter(
        (genre): genre is string => typeof genre === 'string' && genre.trim().length > 0,
      )
    : [];
  const style = format || genres.slice(0, 3).join(' / ') || 'Station laut.fm';
  const pageUrl =
    typeof station.page_url === 'string' && station.page_url.trim()
      ? station.page_url.trim()
      : `https://laut.fm/${id}`;

  return {
    id,
    name: displayName,
    style,
    url: `https://stream.laut.fm/${id}`,
    pageUrl,
    provider: 'lautfm',
  };
}

async function searchLautFmStations(query: string, signal?: AbortSignal) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return DEFAULT_LAUT_FM_STATIONS;
  }

  const response = await fetch(
    `https://api.laut.fm/search/stations?query=${encodeURIComponent(trimmedQuery)}&limit=30`,
    { signal },
  );
  if (!response.ok) {
    throw new Error('laut_fm_search_failed');
  }

  const payload = (await response.json()) as {
    results?: Array<{
      items?: Array<{
        station?: {
          name?: unknown;
          display_name?: unknown;
          format?: unknown;
          genres?: unknown;
          page_url?: unknown;
        };
      }>;
    }>;
  };

  const stations = new Map<string, LautFmStation>();

  payload.results?.forEach((result) => {
    result.items?.forEach((item) => {
      const station = normalizeLautFmStation(item.station ?? {});
      if (station) {
        stations.set(station.id, station);
      }
    });
  });

  return Array.from(stations.values());
}

async function fetchLautFmCurrentSong(
  stationId: string,
  signal?: AbortSignal,
): Promise<LautFmCurrentSong | null> {
  const response = await fetch(
    `https://api.laut.fm/station/${encodeURIComponent(stationId)}/current_song`,
    { signal },
  );

  if (!response.ok) {
    throw new Error('laut_fm_current_song_failed');
  }

  const song = (await response.json()) as {
    title?: string;
    artist?: {
      name?: string;
    };
  };
  const artistName = song.artist?.name?.trim() ?? '';
  const title = song.title?.trim() ?? '';

  if (!artistName && !title) {
    return null;
  }

  return {
    artistName,
    title,
  };
}

async function fetchCustomCurrentSong(
  station: LautFmStation,
  signal?: AbortSignal,
): Promise<LautFmCurrentSong | null> {
  if (station.metadataStrategy === 'bigfm-html' && station.metadataUrl) {
    try {
      const response = await fetch(station.metadataUrl, { signal });
      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      const artistMatch =
        html.match(/<div class="artist"><span>(.*?)<\/span><\/div>/i)
        ?? html.match(/trackInfo-track">([^<]+?) mit ([^<]+)</i);
      const songMatch = html.match(/<div class="song"><span>(.*?)<\/span><\/div>/i);

      const decodeHtmlEntities = (value: string) =>
        value
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');

      const artistName = decodeHtmlEntities(
        artistMatch
          ? artistMatch.length > 2
            ? artistMatch[1]
            : artistMatch[1]
          : '',
      ).trim();
      const title = decodeHtmlEntities(
        songMatch?.[1] ?? (artistMatch && artistMatch.length > 2 ? artistMatch[2] : ''),
      ).trim();

      if (artistName || title) {
        return {
          artistName,
          title,
        };
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      return null;
    }
  }

  const metadataUrls = [station.metadataUrl, station.metadataFallbackUrl].filter(
    (url): url is string => typeof url === 'string' && url.trim().length > 0,
  );

  for (const metadataUrl of metadataUrls) {
    try {
      const response = await fetch(metadataUrl, { signal });
      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as {
        result?: {
          artist?: string;
          title?: string;
          metadataArtist?: string;
          metadataTitle?: string;
        };
      };

      const artistName =
        payload.result?.artist?.trim()
        || payload.result?.metadataArtist?.trim()
        || '';
      const title =
        payload.result?.title?.trim()
        || payload.result?.metadataTitle?.trim()
        || '';

      if (artistName || title) {
        return {
          artistName,
          title,
        };
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
    }
  }

  return null;
}

function formatStationCurrentSong(song: LautFmCurrentSong | null) {
  if (!song) {
    return '';
  }

  if (song.artistName && song.title) {
    return `${song.artistName} - ${song.title}`;
  }

  return song.artistName || song.title;
}

function supportsStationCurrentSong(station: LautFmStation) {
  if (station.provider === 'lautfm') {
    return true;
  }

  return Boolean(station.metadataUrl || station.metadataFallbackUrl);
}

function getNextLiveDirectoryPlaybackMode(
  currentMode: LiveDirectoryPlaybackMode,
): LiveDirectoryPlaybackMode {
  if (currentMode === 'normal') {
    return 'repeat';
  }

  if (currentMode === 'repeat') {
    return 'shuffle';
  }

  return 'normal';
}

function getLiveDirectoryPlaybackModeLabel(mode: LiveDirectoryPlaybackMode) {
  if (mode === 'normal') {
    return 'Lecture normale';
  }

  if (mode === 'repeat') {
    return 'Lecture en boucle';
  }

  return 'Lecture aleatoire';
}

function findStationById(stations: LautFmStation[], stationId: string) {
  return stations.find((station) => station.id === stationId) ?? null;
}

function mergeStations(primary: LautFmStation[], secondary: LautFmStation[]) {
  const stations = new Map<string, LautFmStation>();
  [...primary, ...secondary].forEach((station) => {
    stations.set(station.id, station);
  });
  return Array.from(stations.values());
}

function getStationSuggestions(
  stations: LautFmStation[],
  query: string,
  selectedStationId: string,
  limit = 10,
) {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return [];
  }

  return stations
    .filter((station) => {
      const haystack = `${station.name} ${station.style} ${station.id}`.toLowerCase();
      return haystack.includes(trimmedQuery);
    })
    .sort((left, right) => {
      if (left.id === selectedStationId) {
        return -1;
      }
      if (right.id === selectedStationId) {
        return 1;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, limit);
}

function getFeaturedAlternativeStations(
  stations: LautFmStation[],
  selectedStationId: string,
  limit = 10,
) {
  const stationMap = new Map(stations.map((station) => [station.id, station]));
  const featuredStations = FEATURED_ALTERNATIVE_STATION_IDS
    .filter((stationId) => stationId !== selectedStationId)
    .map((stationId) => stationMap.get(stationId))
    .filter((station): station is LautFmStation => Boolean(station));

  const fallbackStations = stations.filter(
    (station) =>
      station.id !== selectedStationId
      && !featuredStations.some((featuredStation) => featuredStation.id === station.id),
  );

  return [...featuredStations, ...fallbackStations].slice(0, limit);
}

type StationComboboxProps = {
  buttonId: string;
  searchId: string;
  label?: string;
  selectedStation: LautFmStation;
  suggestions: LautFmStation[];
  alternativeStations: LautFmStation[];
  searchValue: string;
  searchState?: 'idle' | 'loading' | 'error';
  currentSongLabel?: string;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onSelect: (stationId: string) => void;
  className?: string;
  detailsRef?: (element: HTMLDetailsElement | null) => void;
};

function StationCombobox({
  buttonId,
  searchId,
  label,
  selectedStation,
  suggestions,
  alternativeStations,
  searchValue,
  searchState = 'idle',
  currentSongLabel = '',
  disabled = false,
  open,
  onOpenChange,
  onSearchChange,
  onSelect,
  className,
  detailsRef,
}: StationComboboxProps) {
  const displayedStations = searchValue.trim() ? suggestions : alternativeStations;

  return (
    <div className={className}>
      {label ? <span className="field-label">{label}</span> : null}
      <details
        ref={detailsRef}
        className={`station-combobox${open ? ' station-combobox--open' : ''}`}
        open={open}
        onToggle={(event) => onOpenChange((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary
          id={buttonId}
          className={`station-combobox-trigger${disabled ? ' station-combobox-trigger--disabled' : ''}`}
        >
          <span className="station-combobox-trigger-summary">
            <span>{selectedStation.name}</span>
            <span className="station-combobox-trigger-separator" aria-hidden="true">
              {' '}
              -{' '}
            </span>
            <span className="station-combobox-trigger-style">{selectedStation.style}</span>
          </span>
          {currentSongLabel ? (
            <span className="station-combobox-trigger-meta">{currentSongLabel}</span>
          ) : null}
        </summary>

        <div className="station-combobox-panel">
          <input
            id={searchId}
            className="text-field-input station-combobox-search"
            type="search"
            inputMode="search"
            placeholder="Nom, genre, artiste..."
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            disabled={disabled}
          />

          <p className="station-suggestions-label">
            {searchValue.trim() ? 'Occurrences' : '10 radios alternatives'}
          </p>

          <div className="station-suggestions" role="listbox" aria-labelledby={buttonId}>
            {displayedStations.length > 0 ? (
              displayedStations.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  className={`station-suggestion${
                    station.id === selectedStation.id ? ' station-suggestion--active' : ''
                  }`}
                  onClick={() => onSelect(station.id)}
                  disabled={disabled}
                >
                  <span>{station.name}</span>
                  <span>{station.style}</span>
                </button>
              ))
            ) : (
              <p className="station-suggestions-empty">
                {searchState === 'loading'
                  ? 'Recherche en cours...'
                  : searchState === 'error'
                    ? 'Recherche indisponible.'
                    : 'Aucune occurrence pour cette recherche.'}
              </p>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

function createAlarmDefinition(partial?: Partial<AlarmDefinition>): AlarmDefinition {
  return {
    id: partial?.id ?? `alarm-${Math.random().toString(36).slice(2, 10)}`,
    time: partial?.time ?? '07:00',
    name: partial?.name ?? '',
    frequency: partial?.frequency ?? 'once',
    color: partial?.color ?? '#ff8a3d',
    mode: partial?.mode ?? 'visual',
    radioStationId: partial?.radioStationId ?? DEFAULT_LAUT_FM_STATIONS[0].id,
    fileName: partial?.fileName ?? '',
  };
}

function getNextAlarmColor(alarms: AlarmDefinition[]) {
  const usedColors = new Set(alarms.map((alarm) => alarm.color));
  const availableColors = ALARM_BADGE_COLOR_PALETTE.filter((color) => !usedColors.has(color));

  if (availableColors.length === 0) {
    return ALARM_BADGE_COLOR_PALETTE[Math.floor(Math.random() * ALARM_BADGE_COLOR_PALETTE.length)];
  }

  return availableColors[Math.floor(Math.random() * availableColors.length)];
}

function normalizeStoredAlarms(
  storedAlarms: unknown,
  fallbackEnabled: boolean,
  fallbackTime: string,
) {
  if (Array.isArray(storedAlarms)) {
    const normalized = storedAlarms
      .map((alarm) => {
        if (!alarm || typeof alarm !== 'object') {
          return null;
        }

        const candidate = alarm as Partial<AlarmDefinition>;
        if (typeof candidate.time !== 'string' || !candidate.time.trim()) {
          return null;
        }

        return createAlarmDefinition({
          id: typeof candidate.id === 'string' ? candidate.id : undefined,
          time: candidate.time,
          name: typeof candidate.name === 'string' ? candidate.name : '',
          frequency:
            candidate.frequency === 'weekdays' || candidate.frequency === 'daily'
              ? candidate.frequency
              : 'once',
          color:
            typeof candidate.color === 'string' && candidate.color.trim()
              ? candidate.color
              : '#ff8a3d',
          mode:
            candidate.mode === 'radio' || candidate.mode === 'file'
              ? candidate.mode
              : 'visual',
          radioStationId:
            typeof candidate.radioStationId === 'string' && candidate.radioStationId.trim()
              ? candidate.radioStationId
              : DEFAULT_LAUT_FM_STATIONS[0].id,
          fileName:
            typeof candidate.fileName === 'string' ? candidate.fileName : '',
        });
      })
      .filter((alarm): alarm is AlarmDefinition => Boolean(alarm))
      .slice(0, 5);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return fallbackEnabled ? [createAlarmDefinition({ time: fallbackTime })] : [];
}

function readStoredAlarmSettings() {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(ALARM_SETTINGS_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as {
      alarms?: AlarmDefinition[];
      alarmEnabled?: boolean;
      alarmTime?: string;
      recentRadioStationIds?: string[];
      liveAudioSource?: LiveAudioSource;
      liveRadioStationId?: string;
      showDate?: boolean;
      use24HourFormat?: boolean;
      activeDisplayId?: ClockDisplayId;
      activeThemeName?: string;
      vuMeterEnabled?: boolean;
      vuMeterDisplay?: VuMeterDisplay;
      vuMeterMode?: VuMeterMode;
      vuMeterStyle?: VuMeterStyle;
    };
  } catch {
    return null;
  }
}

function getStoredDisplayId(candidate: unknown): ClockDisplayId {
  if (typeof candidate !== 'string') {
    return 'analog';
  }

  const matchingDisplay = DISPLAY_MODES.find((display) => display.id === candidate);
  return matchingDisplay?.id ?? 'analog';
}

function getStoredThemeName(candidate: unknown) {
  if (typeof candidate !== 'string') {
    return DEFAULT_THEME_NAME;
  }

  return candidate in THEMES ? candidate : DEFAULT_THEME_NAME;
}

function alarmMatchesFrequency(alarm: AlarmDefinition, currentTime: Date) {
  if (alarm.frequency === 'daily' || alarm.frequency === 'once') {
    return true;
  }

  const currentDay = currentTime.getDay();
  return currentDay >= 1 && currentDay <= 5;
}

function App() {
  const storedAlarmSettings = readStoredAlarmSettings();
  const [activeDisplayId, setActiveDisplayId] = useState<ClockDisplayId>(() =>
    getStoredDisplayId(storedAlarmSettings?.activeDisplayId),
  );
  const [activeThemeName, setActiveThemeName] = useState(() =>
    getStoredThemeName(storedAlarmSettings?.activeThemeName),
  );
  const [isTauriApp, setIsTauriApp] = useState(() => isTauriRuntime());
  const [showDate, setShowDate] = useState(storedAlarmSettings?.showDate ?? false);
  const [use24HourFormat, setUse24HourFormat] = useState(
    storedAlarmSettings?.use24HourFormat ?? true,
  );
  const [vuMeterEnabled, setVuMeterEnabled] = useState(false);
  const [vuMeterDisplay, setVuMeterDisplay] = useState<VuMeterDisplay>(
    storedAlarmSettings?.vuMeterDisplay ?? 'clock',
  );
  const [vuMeterMode, setVuMeterMode] = useState<VuMeterMode>(
    storedAlarmSettings?.vuMeterMode ?? 'floating',
  );
  const [vuMeterStyle, setVuMeterStyle] = useState<VuMeterStyle>(
    storedAlarmSettings?.vuMeterStyle ?? 'needle-duo',
  );
  const [vuMeterLevels, setVuMeterLevels] = useState<number[]>([]);
  const [vuMeterWaveform, setVuMeterWaveform] = useState<number[]>([]);
  const [nativeVuMeterLevels, setNativeVuMeterLevels] = useState<number[]>([]);
  const [nativeVuMeterWaveform, setNativeVuMeterWaveform] = useState<number[]>([]);
  const [appSignature, setAppSignature] = useState(APP_SIGNATURE_FALLBACK);
  const [isMobileSplashVisible, setIsMobileSplashVisible] = useState(isProbablyMobileDevice);
  const [alarms, setAlarms] = useState<AlarmDefinition[]>(
    normalizeStoredAlarms(
      storedAlarmSettings?.alarms,
      storedAlarmSettings?.alarmEnabled ?? false,
      storedAlarmSettings?.alarmTime ?? '07:00',
    ),
  );
  const [alarmPlaybackState, setAlarmPlaybackState] = useState<
    'idle' | 'ringing' | 'error'
  >('idle');
  const [alarmStatusMessage, setAlarmStatusMessage] = useState('');
  const [activeAlarmLabel, setActiveAlarmLabel] = useState('');
  const [activeAlarmColor, setActiveAlarmColor] = useState('#ff2a2a');
  const [liveRadioStationId, setLiveRadioStationId] = useState(
    storedAlarmSettings?.liveRadioStationId ?? DEFAULT_LAUT_FM_STATIONS[0].id,
  );
  const [liveAudioSource, setLiveAudioSource] = useState<LiveAudioSource>(
    storedAlarmSettings?.liveAudioSource ?? 'radio',
  );
  const [liveRadioPlaybackState, setLiveRadioPlaybackState] = useState<
    'idle' | 'loading' | 'playing' | 'paused' | 'error'
  >('idle');
  const [liveRadioCurrentSong, setLiveRadioCurrentSong] =
    useState<LautFmCurrentSong | null>(null);
  const [liveDirectoryFiles, setLiveDirectoryFiles] = useState<LiveDirectoryTrack[]>([]);
  const [liveDirectoryName, setLiveDirectoryName] = useState('');
  const [liveDirectoryTrackLabel, setLiveDirectoryTrackLabel] = useState('');
  const [liveDirectorySelectionMessage, setLiveDirectorySelectionMessage] = useState('');
  const [liveDirectoryPlaybackMode, setLiveDirectoryPlaybackMode] =
    useState<LiveDirectoryPlaybackMode>('normal');
  const [liveRadioSearch, setLiveRadioSearch] = useState('');
  const [liveRadioStations, setLiveRadioStations] = useState(DEFAULT_LAUT_FM_STATIONS);
  const [recentRadioStationIds, setRecentRadioStationIds] = useState(
    storedAlarmSettings?.recentRadioStationIds ?? [],
  );
  const [playerOpen, setPlayerOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsTab, setOptionsTab] = useState<OptionsTabId>('appearance');
  const [liveRadioComboboxOpen, setLiveRadioComboboxOpen] = useState(false);
  const currentTime = useSystemTime();
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmObjectUrlRef = useRef<string | null>(null);
  const alarmFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const alarmFilesRef = useRef<Record<string, File | null>>({});
  const triggeredAlarmKeysRef = useRef<Set<string>>(new Set());
  const liveAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const liveRadioAudioRef = useRef<HTMLAudioElement | null>(null);
  const liveDirectoryInputRef = useRef<HTMLInputElement | null>(null);
  const liveDirectoryFilesRef = useRef<LiveDirectoryTrack[]>([]);
  const vuMeterAudioContextRef = useRef<AudioContext | null>(null);
  const vuMeterLeftAnalyserRef = useRef<AnalyserNode | null>(null);
  const vuMeterRightAnalyserRef = useRef<AnalyserNode | null>(null);
  const vuMeterChannelSplitterRef = useRef<ChannelSplitterNode | null>(null);
  const vuMeterSourceRef = useRef<AudioNode | null>(null);
  const vuMeterConnectedAudioRef = useRef<HTMLAudioElement | null>(null);
  const vuMeterFrameRef = useRef<number | null>(null);
  const vuMeterSmoothedLevelsRef = useRef<number[]>([]);
  const vuMeterLastPaintTimeRef = useRef(0);
  const vuMeterSilentSinceRef = useRef(0);
  const vuMeterGraphBuildVersionRef = useRef(0);
  const vuMeterReconnectInFlightRef = useRef(false);
  const [vuMeterReconnectToken, setVuMeterReconnectToken] = useState(0);
  const nativeVuMeterLastUpdateRef = useRef(0);
  const liveAudioStoppingRef = useRef(false);
  const liveDirectoryTrackIndexRef = useRef(0);
  const liveDirectoryPlaybackModeRef = useRef<LiveDirectoryPlaybackMode>('normal');
  const pendingLiveAutoplayRef = useRef<LiveAudioSource | null>(null);
  const playerMenuRef = useRef<HTMLDetailsElement | null>(null);
  const optionsMenuRef = useRef<HTMLDetailsElement | null>(null);
  const liveRadioStageComboboxRef = useRef<HTMLDetailsElement | null>(null);
  const liveRadioOptionsComboboxRef = useRef<HTMLDetailsElement | null>(null);
  const displayStageRef = useRef<HTMLElement | null>(null);
  const lastDisplayTapRef = useRef(0);
  const deferredLiveRadioSearch = useDeferredValue(liveRadioSearch);

  useEffect(() => {
    const audio = liveAudioElementRef.current;
    if (!audio || !isTauriApp) {
      return;
    }

    const audioEvents = [
      'loadstart',
      'loadedmetadata',
      'loadeddata',
      'canplay',
      'canplaythrough',
      'play',
      'playing',
      'pause',
      'waiting',
      'stalled',
      'suspend',
      'seeking',
      'seeked',
      'ended',
      'error',
    ] as const;

    const cleanupFns = audioEvents.map((eventName) => {
      const handler = () => {
        logDesktopMediaDebug(`audio-element:${eventName}`, {
          source: liveAudioSource,
          playbackState: liveRadioPlaybackState,
          snapshot: buildAudioDebugSnapshot(audio),
        });
      };
      audio.addEventListener(eventName, handler);
      return () => {
        audio.removeEventListener(eventName, handler);
      };
    });

    logDesktopMediaDebug('audio-element:attached', {
      snapshot: buildAudioDebugSnapshot(audio),
    });

    return () => {
      cleanupFns.forEach((cleanup) => {
        cleanup();
      });
    };
  }, [isTauriApp, liveAudioSource, liveRadioPlaybackState]);

  useEffect(() => {
    if (!isProbablyMobileDevice()) {
      setIsMobileSplashVisible(false);
      return;
    }

    const hideTimer = window.setTimeout(() => {
      setIsMobileSplashVisible(false);
    }, 1800);

    return () => {
      window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      import('@tauri-apps/api/app'),
      import('@tauri-apps/api/core'),
    ])
      .then(async ([appApi, coreApi]) => {
        if (!coreApi.isTauri()) {
          throw new Error('Not running inside Tauri');
        }

        const version = await appApi.getVersion();
        if (!cancelled) {
          setAppSignature(`Clock.l.m v${version}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppSignature(APP_SIGNATURE_FALLBACK);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const input = liveDirectoryInputRef.current;
    if (!input) {
      return;
    }

    input.setAttribute('directory', '');
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('mozdirectory', '');
    input.setAttribute('multiple', '');

    type DirectoryCapableInput = HTMLInputElement & {
      directory?: boolean;
      webkitdirectory?: boolean;
      mozdirectory?: boolean;
    };

    const directoryInput = input as DirectoryCapableInput;
    directoryInput.directory = true;
    directoryInput.webkitdirectory = true;
    directoryInput.mozdirectory = true;
    input.multiple = true;
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target;
      if (!(targetNode instanceof Node)) {
        return;
      }

      if (
        playerOpen
        && playerMenuRef.current
        && !playerMenuRef.current.contains(targetNode)
      ) {
        setPlayerOpen(false);
      }

      if (
        optionsOpen
        && optionsMenuRef.current
        && !optionsMenuRef.current.contains(targetNode)
      ) {
        setOptionsOpen(false);
      }

      if (
        liveRadioComboboxOpen
        && ![
          liveRadioStageComboboxRef.current,
          liveRadioOptionsComboboxRef.current,
        ].some((element) => element?.contains(targetNode))
      ) {
        setLiveRadioComboboxOpen(false);
      }

    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [liveRadioComboboxOpen, optionsOpen, playerOpen]);

  const activeDisplay = useMemo(
    () =>
      DISPLAY_MODES.find((display) => display.id === activeDisplayId) ??
      DISPLAY_MODES[0],
    [activeDisplayId],
  );
  const activeTheme = THEMES[activeThemeName] ?? THEMES[DEFAULT_THEME_NAME];
  const selectedLiveRadioStation =
    findStationById(liveRadioStations, liveRadioStationId) ??
    findStationById(DEFAULT_LAUT_FM_STATIONS, liveRadioStationId) ??
    DEFAULT_LAUT_FM_STATIONS[0];
  const liveRadioSuggestions = useMemo(
    () =>
      getStationSuggestions(
        mergeStations(liveRadioStations, DEFAULT_LAUT_FM_STATIONS),
        liveRadioSearch,
        liveRadioStationId,
      ),
    [liveRadioSearch, liveRadioStationId, liveRadioStations],
  );
  const liveRadioAlternativeStations = useMemo(
    () =>
      getFeaturedAlternativeStations(
        mergeStations(liveRadioStations, DEFAULT_LAUT_FM_STATIONS),
        liveRadioStationId,
      ),
    [liveRadioStationId, liveRadioStations],
  );
  const analogAlarmPreviews = useMemo(
    () => alarms.map((alarm) => ({ time: alarm.time, color: alarm.color })),
    [alarms],
  );
  const liveRadioCurrentSongLabel = formatStationCurrentSong(liveRadioCurrentSong);
  const liveTransportTitle =
    liveAudioSource === 'radio'
      ? selectedLiveRadioStation.name
      : liveDirectoryTrackLabel || liveDirectoryName || 'Aucun dossier audio selectionne';
  const livePlaybackActive =
    liveRadioPlaybackState === 'loading'
    || liveRadioPlaybackState === 'playing'
    || liveRadioPlaybackState === 'paused';
  const playerSummaryPrimary =
    liveAudioSource === 'radio'
      ? selectedLiveRadioStation.name
      : liveDirectoryName || 'Musique locale';
  const playerSummarySecondary =
    liveAudioSource === 'radio'
      ? liveRadioPlaybackState === 'loading'
        ? 'Connexion au flux...'
        : liveRadioCurrentSongLabel || 'Artiste et morceau indisponibles'
      : liveDirectoryTrackLabel || 'Lecture locale en cours';
  const nextLiveDirectoryPlaybackMode = getNextLiveDirectoryPlaybackMode(
    liveDirectoryPlaybackMode,
  );
  const themeFamily = getThemeFamily(activeThemeName);
  const { isAppleWebKit, supportsColorMix } = detectRenderEnvironment();
  const renderEnvironmentClasses = [
    isAppleWebKit ? 'app-shell--apple-webkit' : '',
    supportsColorMix ? '' : 'app-shell--no-color-mix',
  ].filter(Boolean).join(' ');
  const clockLayoutClasses = [
    'clock-layout',
    isAppleWebKit ? 'clock-layout--apple-webkit' : '',
    supportsColorMix ? '' : 'clock-layout--no-color-mix',
  ].filter(Boolean).join(' ');
  const shouldUseExternalVuMeterWindow = false;
  const shouldShowClockDisplay = !vuMeterEnabled || vuMeterDisplay !== 'vu-meter';
  const shouldShowVuMeterDisplay = vuMeterEnabled && vuMeterDisplay !== 'clock';
  const nativeVuMeterIsFresh = Date.now() - nativeVuMeterLastUpdateRef.current < 2500;
  const shouldPreferNativeVuMeter = nativeVuMeterIsFresh && nativeVuMeterLevels.length > 0;
  const isLinuxDesktopTauri =
    isTauriApp
    && typeof window !== 'undefined'
    && /\bLinux\b/i.test(window.navigator.userAgent);
  const isMacDesktopTauri =
    isTauriApp
    && typeof window !== 'undefined'
    && /\bMacintosh\b|\bMac OS X\b/i.test(window.navigator.userAgent);
  const activeVuMeterLevels = shouldPreferNativeVuMeter ? nativeVuMeterLevels : vuMeterLevels;
  const activeVuMeterWaveform = shouldPreferNativeVuMeter
    ? nativeVuMeterWaveform
    : vuMeterWaveform;
  const themeStyle = {
    '--theme-bg': activeTheme.BG,
    '--theme-panel': activeTheme.PANEL,
    '--theme-field': activeTheme.FIELD,
    '--theme-fg': activeTheme.FG,
    '--theme-field-fg': activeTheme.FIELD_FG,
    '--theme-accent': activeTheme.ACCENT,
    '--alarm-visual-color': activeAlarmColor,
  } as CSSProperties;

  const toggleMobileFullscreen = async () => {
    if (!isProbablyMobileDevice() || !displayStageRef.current) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await displayStageRef.current.requestFullscreen();
    } catch {
      // Some mobile webviews may ignore fullscreen requests.
    }
  };

  const handleDisplayStagePointerUp = () => {
    if (!isProbablyMobileDevice()) {
      return;
    }

    const now = Date.now();
    if (now - lastDisplayTapRef.current <= 280) {
      lastDisplayTapRef.current = 0;
      void toggleMobileFullscreen();
      return;
    }

    lastDisplayTapRef.current = now;
  };

  const stopAlarmPlayback = () => {
    const activeAudio = alarmAudioRef.current;
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.src = '';
      alarmAudioRef.current = null;
    }

    if (alarmObjectUrlRef.current) {
      URL.revokeObjectURL(alarmObjectUrlRef.current);
      alarmObjectUrlRef.current = null;
    }

    setAlarmPlaybackState('idle');
    setAlarmStatusMessage('');
    setActiveAlarmLabel('');
    setActiveAlarmColor('#ff2a2a');
  };

  const stopLiveRadioPlayback = () => {
    const activeAudio = liveRadioAudioRef.current;
    logDesktopMediaDebug('stopLiveRadioPlayback:start', {
      source: liveAudioSource,
      playbackState: liveRadioPlaybackState,
      snapshot: buildAudioDebugSnapshot(activeAudio),
    });
    liveAudioStoppingRef.current = true;
    if (activeAudio) {
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.pause();
      if (liveAudioSource === 'directory') {
        try {
          activeAudio.currentTime = 0;
        } catch {
          // Keep the current source attached on desktop WebKit to avoid transport crashes.
        }
      } else {
        activeAudio.src = '';
        activeAudio.load();
        liveRadioAudioRef.current = null;
      }
    }

    setLiveRadioPlaybackState('idle');
    window.setTimeout(() => {
      liveAudioStoppingRef.current = false;
    }, 0);
    logDesktopMediaDebug('stopLiveRadioPlayback:end', {
      source: liveAudioSource,
      playbackState: 'idle',
    });
  };

  const getNextDirectoryTrackIndex = (
    currentIndex: number,
    direction: 'next' | 'previous',
    mode: LiveDirectoryPlaybackMode,
  ) => {
    const trackCount = liveDirectoryFiles.length;
    if (trackCount === 0) {
      return null;
    }

    if (mode === 'shuffle') {
      if (trackCount === 1) {
        return 0;
      }

      let nextIndex = currentIndex;
      while (nextIndex === currentIndex) {
        nextIndex = Math.floor(Math.random() * trackCount);
      }
      return nextIndex;
    }

    if (direction === 'previous') {
      if (currentIndex > 0) {
        return currentIndex - 1;
      }
      return mode === 'repeat' ? trackCount - 1 : 0;
    }

    if (currentIndex < trackCount - 1) {
      return currentIndex + 1;
    }

    return mode === 'repeat' ? 0 : null;
  };

  const clearLiveDirectoryObjectUrls = () => {
    liveDirectoryFilesRef.current.forEach((track) => {
      if (track.revokeOnClear) {
        URL.revokeObjectURL(track.sourceUrl);
      }
    });
    liveDirectoryFilesRef.current = [];
    liveDirectoryTrackIndexRef.current = 0;
  };

  const startAlarmPlayback = async (alarm: AlarmDefinition, triggerLabel: string, alarmLabel = '') => {
    stopAlarmPlayback();
    stopLiveRadioPlayback();

    setActiveAlarmLabel(alarmLabel);
    setActiveAlarmColor(alarm.color);

    if (alarm.mode === 'visual') {
      setAlarmPlaybackState('ringing');
      setAlarmStatusMessage(triggerLabel);
      return;
    }

    let sourceUrl = '';
    let isLooping = false;

    if (alarm.mode === 'file') {
      const selectedFile = alarmFilesRef.current[alarm.id];

      if (selectedFile) {
        const objectUrl = URL.createObjectURL(selectedFile);
        alarmObjectUrlRef.current = objectUrl;
        sourceUrl = objectUrl;
      } else {
        setAlarmPlaybackState('ringing');
        setAlarmStatusMessage(`${triggerLabel} Aucun fichier local n'est selectionne.`);
        return;
      }

      isLooping = true;
    } else {
      const selectedStation =
        findStationById(DEFAULT_LAUT_FM_STATIONS, alarm.radioStationId) ??
        DEFAULT_LAUT_FM_STATIONS[0];

      const candidateUrls = await prepareStationStreamUrls(selectedStation);

      if (candidateUrls.length === 0) {
        setAlarmPlaybackState('ringing');
        setAlarmStatusMessage(`${triggerLabel} Aucune radio n'est selectionnee.`);
        return;
      }

      try {
        const audio = await playAudioFromCandidates(candidateUrls, {
          preload: 'auto',
          loop: false,
        });
        alarmAudioRef.current = audio;
        setAlarmPlaybackState('ringing');
        setAlarmStatusMessage(triggerLabel);
        return;
      } catch {
        setAlarmPlaybackState('ringing');
        setAlarmStatusMessage(`${triggerLabel} Impossible de charger le flux radio.`);
        return;
      }
    }

    const audio = new Audio(sourceUrl);
    audio.loop = isLooping;
    audio.preload = 'auto';
    alarmAudioRef.current = audio;

    try {
      await audio.play();
      setAlarmPlaybackState('ringing');
      setAlarmStatusMessage(triggerLabel);
    } catch {
      stopAlarmPlayback();
      setActiveAlarmLabel(alarmLabel);
      setActiveAlarmColor(alarm.color);
      setAlarmPlaybackState('ringing');
      setAlarmStatusMessage(
        'Lecture bloquee par le navigateur. Interagis avec la page puis relance l’alarme.',
      );
    }
  };

  const handleAlarmFileSelection = (alarmId: string, files: FileList | null) => {
    const file = files?.[0] ?? null;
    alarmFilesRef.current[alarmId] = file;

    updateAlarm(alarmId, {
      fileName: file?.name ?? '',
    });
  };

  const handleAlarmFileBrowse = (alarmId: string) => {
    alarmFileInputRefs.current[alarmId]?.click();
  };

  const updateAlarm = (alarmId: string, updates: Partial<AlarmDefinition>) => {
    setAlarms((currentAlarms) =>
      currentAlarms.map((alarm) =>
        alarm.id === alarmId ? { ...alarm, ...updates } : alarm,
      ),
    );
  };

  const addAlarm = () => {
    setAlarms((currentAlarms) => {
      if (currentAlarms.length >= 5) {
        return currentAlarms;
      }

      return [
        ...currentAlarms,
        createAlarmDefinition({ color: getNextAlarmColor(currentAlarms) }),
      ];
    });
  };

  const removeAlarm = (alarmId: string) => {
    setAlarms((currentAlarms) => currentAlarms.filter((alarm) => alarm.id !== alarmId));

    delete alarmFilesRef.current[alarmId];
    delete alarmFileInputRefs.current[alarmId];

    triggeredAlarmKeysRef.current.forEach((key) => {
      if (key.startsWith(`${alarmId}:`)) {
        triggeredAlarmKeysRef.current.delete(key);
      }
    });

    if (activeAlarmLabel && alarmPlaybackState === 'ringing') {
      stopAlarmPlayback();
    }
  };

  const startLiveRadioPlayback = async () => {
    if (liveRadioPlaybackState === 'loading') {
      logDesktopMediaDebug('startLiveRadioPlayback:ignored-loading');
      return;
    }

    if (
      liveRadioPlaybackState === 'paused' &&
      liveRadioAudioRef.current &&
      liveAudioSource === 'radio'
    ) {
      try {
        logDesktopMediaDebug('startLiveRadioPlayback:resume-attempt', {
          snapshot: buildAudioDebugSnapshot(liveRadioAudioRef.current),
        });
        await liveRadioAudioRef.current.play();
        setLiveRadioPlaybackState('playing');
        logDesktopMediaDebug('startLiveRadioPlayback:resume-success', {
          snapshot: buildAudioDebugSnapshot(liveRadioAudioRef.current),
        });
      } catch {
        logDesktopMediaDebug('startLiveRadioPlayback:resume-failure', {
          snapshot: buildAudioDebugSnapshot(liveRadioAudioRef.current),
        });
        stopLiveRadioPlayback();
        setLiveRadioPlaybackState('error');
      }
      return;
    }

    stopLiveRadioPlayback();
    stopAlarmPlayback();
    setLiveRadioPlaybackState('loading');

    try {
      const candidateUrls = await prepareStationStreamUrls(selectedLiveRadioStation);
      logDesktopMediaDebug('startLiveRadioPlayback:candidates', {
        stationId: selectedLiveRadioStation.id,
        candidateUrls,
      });
      if (candidateUrls.length === 0) {
        throw new Error('station_stream_unavailable');
      }
      const audioElement = liveAudioElementRef.current;
      const audio = await playAudioFromCandidates(candidateUrls, {
        preload: 'none',
        preferCrossOrigin: !isTauriApp,
        audioElement,
      });
      liveRadioAudioRef.current = audio;
      setLiveRadioPlaybackState('playing');
      logDesktopMediaDebug('startLiveRadioPlayback:playing', {
        stationId: selectedLiveRadioStation.id,
        snapshot: buildAudioDebugSnapshot(audio),
      });
    } catch (error) {
      logDesktopMediaDebug('startLiveRadioPlayback:error', {
        stationId: selectedLiveRadioStation.id,
        error: error instanceof Error ? error.message : String(error),
      });
      stopLiveRadioPlayback();
      setLiveRadioPlaybackState('error');
    }
  };

  const playLiveDirectoryTrack = async (trackIndex = 0) => {
    const availableTracks = liveDirectoryFilesRef.current;

    if (availableTracks.length === 0) {
      setLiveRadioPlaybackState('error');
      return;
    }

    if (
      liveRadioPlaybackState === 'paused' &&
      liveRadioAudioRef.current &&
      liveAudioSource === 'directory' &&
      trackIndex === liveDirectoryTrackIndexRef.current
    ) {
      try {
        logDesktopMediaDebug('playLiveDirectoryTrack:resume-attempt', {
          trackIndex,
          snapshot: buildAudioDebugSnapshot(liveRadioAudioRef.current),
        });
        await liveRadioAudioRef.current.play();
        setLiveRadioPlaybackState('playing');
        logDesktopMediaDebug('playLiveDirectoryTrack:resume-success', {
          trackIndex,
          snapshot: buildAudioDebugSnapshot(liveRadioAudioRef.current),
        });
      } catch (error) {
        logDesktopMediaDebug('playLiveDirectoryTrack:resume-failure', {
          trackIndex,
          error: error instanceof Error ? error.message : String(error),
          snapshot: buildAudioDebugSnapshot(liveRadioAudioRef.current),
        });
        stopLiveRadioPlayback();
        setLiveRadioPlaybackState('error');
      }
      return;
    }

    stopAlarmPlayback();

    try {
      const selectedTrack = availableTracks[trackIndex];
      if (!selectedTrack) {
        const nextIndex = getNextDirectoryTrackIndex(
          trackIndex,
          'next',
          liveDirectoryPlaybackModeRef.current,
        );
        if (nextIndex === null || nextIndex === trackIndex) {
          stopLiveRadioPlayback();
          setLiveRadioPlaybackState('error');
          return;
        }
        void playLiveDirectoryTrack(nextIndex);
        return;
      }

      liveDirectoryTrackIndexRef.current = trackIndex;

      const audio = liveRadioAudioRef.current ?? liveAudioElementRef.current ?? new Audio();
      liveAudioStoppingRef.current = false;
      logDesktopMediaDebug('playLiveDirectoryTrack:prepare', {
        trackIndex,
        fileName: selectedTrack.name,
        sourceUrl: selectedTrack.sourceUrl,
        reusingAudioElement: audio === liveAudioElementRef.current,
        snapshotBefore: buildAudioDebugSnapshot(audio),
      });
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.preload = 'auto';
      if (!isTauriApp) {
        audio.crossOrigin = 'anonymous';
      }

      if (audio.src !== selectedTrack.sourceUrl) {
        audio.src = selectedTrack.sourceUrl;
      }
      audio.currentTime = 0;

      audio.preload = 'auto';
      audio.onended = () => {
        if (liveAudioStoppingRef.current) {
          return;
        }
        const nextIndex = getNextDirectoryTrackIndex(
          trackIndex,
          'next',
          liveDirectoryPlaybackModeRef.current,
        );
        if (nextIndex === null) {
          stopLiveRadioPlayback();
          return;
        }
        void playLiveDirectoryTrack(nextIndex);
      };
      audio.onerror = () => {
        if (liveAudioStoppingRef.current) {
          return;
        }
        const nextIndex = getNextDirectoryTrackIndex(
          trackIndex,
          'next',
          liveDirectoryPlaybackModeRef.current,
        );
        if (nextIndex === null || nextIndex === trackIndex) {
          stopLiveRadioPlayback();
          setLiveRadioPlaybackState('error');
          return;
        }
        void playLiveDirectoryTrack(nextIndex);
      };
      liveRadioAudioRef.current = audio;
      setLiveDirectoryTrackLabel(selectedTrack.name || liveDirectoryName);
      await audio.play();
      setLiveRadioPlaybackState('playing');
      logDesktopMediaDebug('playLiveDirectoryTrack:playing', {
        trackIndex,
        fileName: selectedTrack.name,
        snapshotAfter: buildAudioDebugSnapshot(liveRadioAudioRef.current),
      });
    } catch (error) {
      logDesktopMediaDebug('playLiveDirectoryTrack:error', {
        trackIndex,
        error: error instanceof Error ? error.message : String(error),
        snapshot: buildAudioDebugSnapshot(liveRadioAudioRef.current),
      });
      stopLiveRadioPlayback();
      setLiveRadioPlaybackState('error');
    }
  };

  const startLivePlayback = async () => {
    if (liveAudioSource === 'directory') {
      await playLiveDirectoryTrack(liveDirectoryTrackIndexRef.current);
      return;
    }

    await startLiveRadioPlayback();
  };

  const pauseLiveRadioPlayback = () => {
    const activeAudio = liveRadioAudioRef.current;
    if (!activeAudio) {
      return;
    }

    activeAudio.pause();
    setLiveRadioPlaybackState('paused');
  };

  const applyLiveDirectorySelection = (selectedTracks: LiveDirectoryTrack[], directoryName: string) => {
    liveDirectoryFilesRef.current = selectedTracks;
    setLiveDirectoryFiles(selectedTracks);
    setLiveDirectoryTrackLabel('');

    if (selectedTracks.length === 0) {
      setLiveDirectorySelectionMessage(
        'Dossier charge, mais aucun fichier audio compatible n a ete trouve.',
      );
      pendingLiveAutoplayRef.current = null;
      setLiveDirectoryName(directoryName);
      return;
    }

    setLiveDirectorySelectionMessage('');
    pendingLiveAutoplayRef.current = null;
    setLiveDirectoryName(directoryName || 'Musique disque dur');
    void playLiveDirectoryTrack(0);
  };

  const handleLiveDirectorySelection = (files: FileList | null) => {
    clearLiveDirectoryObjectUrls();
    stopLiveRadioPlayback();

    const receivedFiles = Array.from(files ?? []);

    const selectedFiles = receivedFiles
      .filter(isSupportedLocalAudioFile)
      .map(buildLiveDirectoryTrackFromFile)
      .sort((left, right) => {
        return left.relativePath.localeCompare(right.relativePath, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });

    if (receivedFiles.length === 0) {
      setLiveDirectorySelectionMessage('Aucun dossier selectionne.');
      pendingLiveAutoplayRef.current = null;
      liveDirectoryFilesRef.current = [];
      setLiveDirectoryFiles([]);
      setLiveDirectoryName('');
      return;
    }

    const firstFile = selectedFiles[0];
    const [directoryName] = getPathParts(firstFile.relativePath);
    applyLiveDirectorySelection(selectedFiles, directoryName || 'Musique disque dur');
  };

  const handleNativeLiveDirectoryBrowse = async () => {
    try {
      const coreApi = await import('@tauri-apps/api/core');
      if (!coreApi.isTauri()) {
        return;
      }

      const selection = await coreApi.invoke<NativeDirectorySelectionPayload | null>(
        'pick_audio_directory',
      );

      if (!selection) {
        return;
      }

      clearLiveDirectoryObjectUrls();
      stopLiveRadioPlayback();

      const selectedTracks = selection.tracks
        .map((track) => ({
          name: track.name,
          relativePath: track.relativePath,
          sourceUrl: coreApi.convertFileSrc(track.path),
        }))
        .sort((left, right) =>
          left.relativePath.localeCompare(right.relativePath, undefined, {
            numeric: true,
            sensitivity: 'base',
          }),
        );

      applyLiveDirectorySelection(selectedTracks, selection.directoryName || 'Musique disque dur');
    } catch {
      setLiveDirectorySelectionMessage(
        'Le selecteur de dossier natif est indisponible sur cette plateforme.',
      );
    }
  };

  const handleBrowseLiveAudio = () => {
    if (liveAudioSource === 'directory') {
      if (isTauriApp) {
        void handleNativeLiveDirectoryBrowse();
        return;
      }
      if (liveDirectoryInputRef.current) {
        liveDirectoryInputRef.current.value = '';
        liveDirectoryInputRef.current.click();
      }
      return;
    }

    setLiveRadioComboboxOpen((currentOpen) => !currentOpen);
  };

  const playPreviousLiveDirectoryTrack = () => {
    const previousIndex = getNextDirectoryTrackIndex(
      liveDirectoryTrackIndexRef.current,
      'previous',
      liveDirectoryPlaybackMode,
    );

    if (previousIndex === null) {
      return;
    }

    void playLiveDirectoryTrack(previousIndex);
  };

  const playNextLiveDirectoryTrack = () => {
    const nextIndex = getNextDirectoryTrackIndex(
      liveDirectoryTrackIndexRef.current,
      'next',
      liveDirectoryPlaybackMode,
    );

    if (nextIndex === null) {
      stopLiveRadioPlayback();
      return;
    }

    void playLiveDirectoryTrack(nextIndex);
  };

  const cycleLiveDirectoryPlaybackMode = () => {
    setLiveDirectoryPlaybackMode((currentMode) => {
      if (currentMode === 'normal') {
        return 'repeat';
      }

      if (currentMode === 'repeat') {
        return 'shuffle';
      }

      return 'normal';
    });
  };

  useEffect(() => {
    liveDirectoryPlaybackModeRef.current = liveDirectoryPlaybackMode;
  }, [liveDirectoryPlaybackMode]);

  const rememberRecentStation = (stationId: string) => {
    setRecentRadioStationIds((currentIds) => [stationId, ...currentIds.filter((id) => id !== stationId)].slice(0, 10));
  };

  useEffect(() => {
    void import('@tauri-apps/api/core').then((coreApi) => {
      setIsTauriApp(coreApi.isTauri());
    }).catch(() => {
      setIsTauriApp(false);
    });
  }, []);

  useEffect(() => {
    return () => {
      stopAlarmPlayback();
      stopLiveRadioPlayback();
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      ALARM_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        alarms,
        recentRadioStationIds,
        liveAudioSource,
        liveRadioStationId,
        showDate,
        use24HourFormat,
        vuMeterDisplay,
        vuMeterMode,
        vuMeterStyle,
        activeDisplayId,
        activeThemeName,
      }),
    );
  }, [
    alarms,
    recentRadioStationIds,
    liveAudioSource,
    liveRadioStationId,
    showDate,
    use24HourFormat,
    vuMeterDisplay,
    vuMeterMode,
    vuMeterStyle,
    activeDisplayId,
    activeThemeName,
  ]);

  useEffect(() => {
    if (alarms.length === 0) {
      stopAlarmPlayback();
    }
  }, [alarms.length]);

  useEffect(() => {
    if (alarmPlaybackState !== 'ringing') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      stopAlarmPlayback();
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [alarmPlaybackState]);

  useEffect(() => {
    if (
      liveAudioSource !== 'radio'
      || pendingLiveAutoplayRef.current !== 'radio'
    ) {
      return;
    }

    pendingLiveAutoplayRef.current = null;
    void startLiveRadioPlayback();
  }, [liveAudioSource, liveRadioStationId]);

  useEffect(() => {
    if (
      liveAudioSource !== 'radio'
      || liveRadioPlaybackState !== 'playing'
      || !supportsStationCurrentSong(selectedLiveRadioStation)
    ) {
      setLiveRadioCurrentSong(null);
      return;
    }

    const controller = new AbortController();
    let refreshTimer: number | null = null;

    const loadCurrentSong = async () => {
      try {
        const song =
          selectedLiveRadioStation.provider === 'custom'
            ? await fetchCustomCurrentSong(selectedLiveRadioStation, controller.signal)
            : await fetchLautFmCurrentSong(selectedLiveRadioStation.id, controller.signal);
        setLiveRadioCurrentSong(song);
      } catch (error) {
        if ((error as DOMException).name !== 'AbortError') {
          setLiveRadioCurrentSong(null);
        }
      }
    };

    setLiveRadioCurrentSong(null);
    void loadCurrentSong();
    refreshTimer = window.setInterval(() => {
      void loadCurrentSong();
    }, 15000);

    return () => {
      controller.abort();
      if (refreshTimer !== null) {
        window.clearInterval(refreshTimer);
      }
    };
  }, [liveAudioSource, liveRadioPlaybackState, selectedLiveRadioStation.id]);

  useEffect(() => {
    return () => {
      liveDirectoryFiles.forEach((track) => {
        if (track.revokeOnClear) {
          URL.revokeObjectURL(track.sourceUrl);
        }
      });
    };
  }, [liveDirectoryFiles]);

  useEffect(() => {
    liveDirectoryFilesRef.current = liveDirectoryFiles;
  }, [liveDirectoryFiles]);

  useEffect(() => {
    let stopped = false;

    void Promise.all([
      import('@tauri-apps/api/core'),
    ]).then(async ([coreApi]) => {
      if (!coreApi.isTauri() || !isLinuxDesktopTauri) {
        return;
      }

      if (vuMeterEnabled) {
        await coreApi.invoke('start_system_vu_meter').catch(() => undefined);
        return;
      }

      await coreApi.invoke('stop_system_vu_meter').catch(() => undefined);
    }).catch(() => undefined);

    return () => {
      if (stopped) {
        return;
      }
      stopped = true;
      void Promise.all([
        import('@tauri-apps/api/core'),
      ]).then(async ([coreApi]) => {
        if (!coreApi.isTauri() || !isLinuxDesktopTauri) {
          return;
        }

        await coreApi.invoke('stop_system_vu_meter').catch(() => undefined);
      }).catch(() => undefined);
    };
  }, [isLinuxDesktopTauri, vuMeterEnabled]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/event'),
    ]).then(async ([coreApi, eventApi]) => {
      if (!coreApi.isTauri()) {
        return;
      }

      unlisten = await eventApi.listen<NativeVuMeterPayload>(VU_METER_SYSTEM_EVENT, (event) => {
        const payload = event.payload;
        const left = clamp01(payload.left ?? 0);
        const right = clamp01(payload.right ?? left);
        nativeVuMeterLastUpdateRef.current = payload.timestamp ?? Date.now();
        setNativeVuMeterLevels([left, right]);
        setNativeVuMeterWaveform(Array.isArray(payload.waveform) ? payload.waveform : []);
      });
    }).catch(() => undefined);

    return () => {
      if (unlisten) {
        void unlisten();
      }
    };
  }, []);

  useEffect(() => {
    const activeAudio = liveRadioAudioRef.current;
    let cancelled = false;

    if (
      !vuMeterEnabled
      || !activeAudio
      || liveRadioPlaybackState !== 'playing'
      || isLinuxDesktopTauri
      || isMacDesktopTauri
    ) {
      if (vuMeterFrameRef.current !== null) {
        window.cancelAnimationFrame(vuMeterFrameRef.current);
        vuMeterFrameRef.current = null;
      }
      vuMeterSourceRef.current?.disconnect();
      vuMeterChannelSplitterRef.current?.disconnect();
      vuMeterLeftAnalyserRef.current?.disconnect();
      vuMeterRightAnalyserRef.current?.disconnect();
      vuMeterSourceRef.current = null;
      vuMeterChannelSplitterRef.current = null;
      vuMeterLeftAnalyserRef.current = null;
      vuMeterRightAnalyserRef.current = null;
      vuMeterConnectedAudioRef.current = null;
      vuMeterSmoothedLevelsRef.current = [];
      vuMeterLastPaintTimeRef.current = 0;
      vuMeterSilentSinceRef.current = 0;
      vuMeterReconnectInFlightRef.current = false;
      setVuMeterLevels([]);
      setVuMeterWaveform([]);
      logDesktopMediaDebug('vu-meter:disabled', {
        vuMeterEnabled,
        hasActiveAudio: Boolean(activeAudio),
        playbackState: liveRadioPlaybackState,
        isLinuxDesktopTauri,
        isMacDesktopTauri,
      });
      return;
    }

    void (async () => {
      try {
        const AudioContextCtor = window.AudioContext ?? (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

        if (!AudioContextCtor) {
          logDesktopMediaDebug('vu-meter:no-audio-context');
          return;
        }

        const shouldRebuildGraph =
          vuMeterConnectedAudioRef.current !== activeAudio
          || vuMeterGraphBuildVersionRef.current !== vuMeterReconnectToken;

        if (shouldRebuildGraph) {
          if (vuMeterFrameRef.current !== null) {
            window.cancelAnimationFrame(vuMeterFrameRef.current);
            vuMeterFrameRef.current = null;
          }

          vuMeterSourceRef.current?.disconnect();
          vuMeterChannelSplitterRef.current?.disconnect();
          vuMeterLeftAnalyserRef.current?.disconnect();
          vuMeterRightAnalyserRef.current?.disconnect();
          vuMeterSourceRef.current = null;
          vuMeterChannelSplitterRef.current = null;
          vuMeterLeftAnalyserRef.current = null;
          vuMeterRightAnalyserRef.current = null;

          const previousContext = vuMeterAudioContextRef.current;
          vuMeterAudioContextRef.current = null;
          if (previousContext && previousContext.state !== 'closed') {
            await previousContext.close().catch(() => undefined);
          }
        }

        const audioContext = vuMeterAudioContextRef.current ?? new AudioContextCtor();
        vuMeterAudioContextRef.current = audioContext;
        logDesktopMediaDebug('vu-meter:context-ready', {
          state: audioContext.state,
          shouldRebuildGraph,
          snapshot: buildAudioDebugSnapshot(activeAudio),
        });

        if (audioContext.state === 'suspended') {
          await audioContext.resume().catch(() => undefined);
          logDesktopMediaDebug('vu-meter:context-resume-attempt', {
            state: audioContext.state,
          });
        }

        if (cancelled) {
          return;
        }

        if (shouldRebuildGraph) {
          type CaptureCapableAudio = HTMLAudioElement & {
            captureStream?: () => MediaStream;
            mozCaptureStream?: () => MediaStream;
          };

          const captureAudio = activeAudio as CaptureCapableAudio;
          const capturedStreamCandidate =
            captureAudio.captureStream?.()
            ?? captureAudio.mozCaptureStream?.()
            ?? null;
          const capturedStream = capturedStreamCandidate;
          logDesktopMediaDebug('vu-meter:build-graph', {
            strategy: capturedStream ? 'captureStream' : 'mediaElementSource',
            snapshot: buildAudioDebugSnapshot(activeAudio),
          });

          const source = capturedStream
            ? audioContext.createMediaStreamSource(capturedStream)
            : audioContext.createMediaElementSource(activeAudio);

          const splitter = audioContext.createChannelSplitter(2);
          const leftAnalyser = audioContext.createAnalyser();
          const rightAnalyser = audioContext.createAnalyser();
          leftAnalyser.fftSize = 256;
          rightAnalyser.fftSize = 256;
          leftAnalyser.smoothingTimeConstant = 0.82;
          rightAnalyser.smoothingTimeConstant = 0.82;

          source.connect(splitter);
          splitter.connect(leftAnalyser, 0);
          splitter.connect(rightAnalyser, 1);
          if (!capturedStream) {
            source.connect(audioContext.destination);
          }

          vuMeterSourceRef.current = source;
          vuMeterChannelSplitterRef.current = splitter;
          vuMeterLeftAnalyserRef.current = leftAnalyser;
          vuMeterRightAnalyserRef.current = rightAnalyser;
          vuMeterConnectedAudioRef.current = activeAudio;
          vuMeterGraphBuildVersionRef.current = vuMeterReconnectToken;
          vuMeterSmoothedLevelsRef.current = [];
          vuMeterSilentSinceRef.current = 0;
          vuMeterReconnectInFlightRef.current = false;
        }

        const leftAnalyser = vuMeterLeftAnalyserRef.current;
        const rightAnalyser = vuMeterRightAnalyserRef.current;
        if (!leftAnalyser || !rightAnalyser) {
          return;
        }

        const leftFrequencyData = new Uint8Array(leftAnalyser.frequencyBinCount);
        const rightFrequencyData = new Uint8Array(rightAnalyser.frequencyBinCount);
        const leftWaveformData = new Uint8Array(leftAnalyser.fftSize);
        const rightWaveformData = new Uint8Array(rightAnalyser.fftSize);

        const updateMeter = (frameTime = performance.now()) => {
          if (cancelled) {
            return;
          }

          const minFrameInterval = 1000 / VU_METER_TARGET_FPS;
          if (frameTime - vuMeterLastPaintTimeRef.current < minFrameInterval) {
            vuMeterFrameRef.current = window.requestAnimationFrame(updateMeter);
            return;
          }

          const currentContext = vuMeterAudioContextRef.current;
          if (currentContext?.state === 'suspended') {
            void currentContext.resume().catch(() => undefined);
          }

          vuMeterLastPaintTimeRef.current = frameTime;
          leftAnalyser.getByteFrequencyData(leftFrequencyData);
          rightAnalyser.getByteFrequencyData(rightFrequencyData);
          leftAnalyser.getByteTimeDomainData(leftWaveformData);
          rightAnalyser.getByteTimeDomainData(rightWaveformData);

          const monoFrequencyData = averageFrequencyData(leftFrequencyData, rightFrequencyData);
          const monoWaveformData = averageWaveformData(leftWaveformData, rightWaveformData);
          const leftLevel = computeRmsLevel(leftWaveformData);
          const rightLevel = computeRmsLevel(rightWaveformData);
          const monoLevel = clamp01(Math.sqrt(((leftLevel ** 2) + (rightLevel ** 2)) / 2));

          if (
            monoLevel < 0.006
            && !activeAudio.paused
            && !activeAudio.ended
            && activeAudio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            if (vuMeterSilentSinceRef.current === 0) {
              vuMeterSilentSinceRef.current = frameTime;
            } else if (
              frameTime - vuMeterSilentSinceRef.current > 3000
              && !vuMeterReconnectInFlightRef.current
            ) {
              vuMeterReconnectInFlightRef.current = true;
              vuMeterConnectedAudioRef.current = null;
              vuMeterGraphBuildVersionRef.current = -1;
              if (vuMeterFrameRef.current !== null) {
                window.cancelAnimationFrame(vuMeterFrameRef.current);
                vuMeterFrameRef.current = null;
              }
              startTransition(() => {
                setVuMeterReconnectToken((currentValue) => currentValue + 1);
              });
              logDesktopMediaDebug('vu-meter:reconnect-requested', {
                monoLevel,
                playbackState: liveRadioPlaybackState,
                snapshot: buildAudioDebugSnapshot(activeAudio),
              });
              return;
            }
          } else {
            vuMeterSilentSinceRef.current = 0;
            vuMeterReconnectInFlightRef.current = false;
          }

          const nextLevels =
            vuMeterStyle === 'needle-duo'
            || vuMeterStyle === 'led-stereo'
            || vuMeterStyle === 'led-horizontal-stereo'
              ? [leftLevel, rightLevel]
              : vuMeterStyle === 'led-mono' || vuMeterStyle === 'led-horizontal-mono'
                ? [monoLevel]
                : buildVuMeterColumns(monoFrequencyData, 20);
          const smoothedLevels = smoothVuLevels(nextLevels, vuMeterSmoothedLevelsRef.current);

          vuMeterSmoothedLevelsRef.current = smoothedLevels;
          setVuMeterLevels(smoothedLevels);
          setVuMeterWaveform(sampleWaveform(monoWaveformData, 52));
          vuMeterFrameRef.current = window.requestAnimationFrame(updateMeter);
        };

        updateMeter();
      } catch (error) {
        logDesktopMediaDebug('vu-meter:error', {
          error: error instanceof Error ? error.message : String(error),
          snapshot: buildAudioDebugSnapshot(activeAudio),
          contextState: vuMeterAudioContextRef.current?.state ?? 'missing',
        });
        vuMeterSmoothedLevelsRef.current = [];
        vuMeterLastPaintTimeRef.current = 0;
        vuMeterSilentSinceRef.current = 0;
        vuMeterReconnectInFlightRef.current = false;
        setVuMeterLevels([]);
        setVuMeterWaveform([]);
      }
    })();

    return () => {
      cancelled = true;
      if (vuMeterFrameRef.current !== null) {
        window.cancelAnimationFrame(vuMeterFrameRef.current);
        vuMeterFrameRef.current = null;
      }
      logDesktopMediaDebug('vu-meter:cleanup', {
        snapshot: buildAudioDebugSnapshot(activeAudio),
      });
    };
  }, [
    isLinuxDesktopTauri,
    isMacDesktopTauri,
    liveRadioPlaybackState,
    vuMeterEnabled,
    vuMeterStyle,
    vuMeterReconnectToken,
  ]);

  useEffect(() => {
    void Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/webviewWindow'),
    ]).then(async ([coreApi, webviewWindowApi]) => {
      if (!coreApi.isTauri()) {
        return;
      }

      const existingWindow = await webviewWindowApi.WebviewWindow.getByLabel(VU_METER_WINDOW_LABEL);

      if (!shouldUseExternalVuMeterWindow) {
        await existingWindow?.hide().catch(() => {});
        return;
      }

      if (existingWindow) {
        await existingWindow.setDecorations(true).catch(() => {});
        await existingWindow.show().catch(() => {});
        await existingWindow.setFocus().catch(() => {});
        return;
      }

      const vuWindow = new webviewWindowApi.WebviewWindow(VU_METER_WINDOW_LABEL, {
        url: 'vu-meter.html',
        title: 'Clocklm VU-metre',
        width: 560,
        height: 320,
        minWidth: 360,
        minHeight: 220,
        resizable: true,
        decorations: true,
        titleBarStyle: 'visible',
        center: true,
        focus: true,
      });
      void vuWindow.once('tauri://error', (error) => {
        console.error('Clocklm: impossible de creer la fenetre flottante du VU-metre.', error);
      });
    }).catch((error) => {
      console.error('Clocklm: creation de la fenetre flottante indisponible.', error);
    });

    return undefined;
  }, [shouldUseExternalVuMeterWindow]);

  useEffect(() => {
    if (!shouldUseExternalVuMeterWindow) {
      return;
    }

    void Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/event'),
    ]).then(async ([coreApi, eventApi]) => {
      if (!coreApi.isTauri()) {
        return;
      }

      await eventApi.emitTo(VU_METER_WINDOW_LABEL, VU_METER_EVENT, {
        style: vuMeterStyle,
        levels: activeVuMeterLevels,
        waveform: activeVuMeterWaveform,
        theme: activeTheme,
        playing: liveRadioPlaybackState === 'playing',
      } satisfies VuMeterWindowPayload);
    }).catch(() => {});
  }, [
    activeTheme,
    activeVuMeterLevels,
    activeVuMeterWaveform,
    liveRadioPlaybackState,
    shouldUseExternalVuMeterWindow,
    vuMeterStyle,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    const trimmedQuery = deferredLiveRadioSearch.trim();

    if (!trimmedQuery) {
      setLiveRadioStations(
        mergeStations(
          DEFAULT_LAUT_FM_STATIONS,
          selectedLiveRadioStation ? [selectedLiveRadioStation] : [],
        ),
      );
      return () => {
        controller.abort();
      };
    }

    searchLautFmStations(trimmedQuery, controller.signal)
      .then((stations) => {
        setLiveRadioStations(
          mergeStations(stations, selectedLiveRadioStation ? [selectedLiveRadioStation] : []),
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      });

    return () => {
      controller.abort();
    };
  }, [deferredLiveRadioSearch, selectedLiveRadioStation]);

  useEffect(() => {
    if (alarms.length === 0) {
      return;
    }

    const currentMinute = currentTime.toTimeString().slice(0, 5);
    const minuteKey = formatAlarmMinuteKey(currentTime);
    const activeAlarm = alarms.find((alarm) => {
      if (alarm.time !== currentMinute || !alarmMatchesFrequency(alarm, currentTime)) {
        return false;
      }

      const triggeredKey = `${alarm.id}:${minuteKey}`;
      if (triggeredAlarmKeysRef.current.has(triggeredKey)) {
        return false;
      }

      triggeredAlarmKeysRef.current.add(triggeredKey);
      return true;
    });

    if (!activeAlarm) {
      return;
    }

    if (activeAlarm.frequency === 'once') {
      setAlarms((currentAlarms) =>
        currentAlarms.filter((alarm) => alarm.id !== activeAlarm.id),
      );
    }

    void startAlarmPlayback(
      activeAlarm,
      `Alarme declenchee a ${activeAlarm.time}.`,
      activeAlarm.name.trim() || `Alarme ${alarms.indexOf(activeAlarm) + 1}`,
    );
  }, [alarms, currentTime]);

  return (
    <AppShell
      className={renderEnvironmentClasses}
      style={themeStyle}
      appSignature={appSignature}
      appSignatureHref={APP_REPOSITORY_URL}
    >
      {isMobileSplashVisible ? (
        <div className="mobile-splash" role="status" aria-live="polite">
          <div className="mobile-splash__card">
            <img
              className="mobile-splash__logo"
              src={clocklmIconUrl}
              alt="Clocklm"
            />
            <p className="mobile-splash__brand">Clock.l.m</p>
            <p className="mobile-splash__version">{appSignature}</p>
          </div>
        </div>
      ) : null}
      <input
        ref={liveDirectoryInputRef}
        className="sr-only"
        type="file"
        accept="audio/*"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => handleLiveDirectorySelection(event.target.files)}
        {...DIRECTORY_INPUT_ATTRIBUTES}
      />
      <section
        className={clockLayoutClasses}
        data-theme-family={themeFamily}
        data-theme-name={activeThemeName}
      >
        <article
          ref={displayStageRef}
          className={`display-stage-card ${
            alarmPlaybackState === 'ringing'
              ? 'display-stage-card--alarm'
              : ''
          } ${vuMeterEnabled && vuMeterDisplay === 'vu-meter' ? 'display-stage-card--vu-only' : ''}`}
          data-display-id={activeDisplayId}
          onPointerUp={handleDisplayStagePointerUp}
        >
          {alarmPlaybackState === 'ringing' && activeAlarmLabel ? (
            <div className="alarm-overlay-label" role="status" aria-live="assertive">
              {activeAlarmLabel}
            </div>
          ) : null}

          <VuMeter
            enabled={shouldShowVuMeterDisplay && vuMeterMode === 'integrated'}
            mode={vuMeterMode}
            style={vuMeterStyle}
            levels={activeVuMeterLevels}
            waveform={activeVuMeterWaveform}
          />

          <details
            ref={playerMenuRef}
            className="live-radio-controls"
            open={playerOpen}
            onToggle={(event) =>
              setPlayerOpen((event.currentTarget as HTMLDetailsElement).open)
            }
          >
            <summary className="live-player-button" aria-label="Lecteur" title="Lecteur">
              <span className="live-player-button-icon" aria-hidden="true">♪</span>
              {livePlaybackActive ? (
                <span className="live-player-collapsed-summary">
                  <span>{playerSummaryPrimary}</span>
                  <span>{playerSummarySecondary}</span>
                </span>
              ) : null}
            </summary>

            <div className="live-player-panel">
              {liveAudioSource === 'radio' ? (
                <StationCombobox
                  detailsRef={(element) => {
                    liveRadioStageComboboxRef.current = element;
                  }}
                  buttonId="live-radio-select"
                  searchId="live-radio-search"
                  selectedStation={selectedLiveRadioStation}
                  suggestions={liveRadioSuggestions}
                  alternativeStations={liveRadioAlternativeStations}
                  searchValue={liveRadioSearch}
                  searchState={deferredLiveRadioSearch !== liveRadioSearch ? 'loading' : 'idle'}
                  currentSongLabel={liveRadioCurrentSongLabel}
                  open={liveRadioComboboxOpen}
                  onOpenChange={setLiveRadioComboboxOpen}
                  onSearchChange={setLiveRadioSearch}
                  onSelect={(stationId) => {
                    pendingLiveAutoplayRef.current = 'radio';
                    setLiveRadioStationId(stationId);
                    rememberRecentStation(stationId);
                    setLiveRadioSearch('');
                    setLiveRadioComboboxOpen(false);
                  }}
                  className="live-radio-select"
                />
              ) : (
                <div className="live-audio-summary">
                  <span>{liveDirectoryName || 'Musique disque dur'}</span>
                  <span>{liveTransportTitle}</span>
                </div>
              )}

              <div className="transport-controls">
                <button
                  type="button"
                  className="transport-button transport-button--browse"
                  aria-label={
                    liveAudioSource === 'directory'
                      ? 'Parcourir un dossier audio'
                      : 'Choisir une radio'
                  }
                  title={
                    liveAudioSource === 'directory'
                      ? 'Parcourir un dossier audio'
                      : 'Choisir une radio'
                  }
                  onClick={handleBrowseLiveAudio}
                >
                  <span className="transport-button-browse-icon" aria-hidden="true">
                    <span className="transport-button-browse-triangle" />
                    <span className="transport-button-browse-bar" />
                  </span>
                </button>

                <button
                  type="button"
                  className="transport-button transport-button--toggle"
                  aria-label={
                    liveRadioPlaybackState === 'playing'
                      ? 'Mettre la lecture en pause'
                      : 'Lire la selection'
                  }
                  title={
                    liveRadioPlaybackState === 'playing'
                      ? 'Mettre la lecture en pause'
                      : liveRadioPlaybackState === 'loading'
                        ? 'Connexion au flux en cours'
                      : 'Lire la selection'
                  }
                  disabled={liveRadioPlaybackState === 'loading'}
                  onClick={() => {
                    if (liveRadioPlaybackState === 'playing') {
                      pauseLiveRadioPlayback();
                      return;
                    }

                    void startLivePlayback();
                  }}
                  >
                  <span
                    className={`transport-button-icon${
                      liveRadioPlaybackState === 'playing' ? '' : ' transport-button-icon--active'
                    }`}
                    aria-hidden="true"
                  >
                    {liveRadioPlaybackState === 'loading' ? '…' : '▶'}
                  </span>
                  <span
                    className={`transport-button-icon${
                      liveRadioPlaybackState === 'playing'
                        ? ' transport-button-icon--active'
                        : ''
                    }`}
                    aria-hidden="true"
                  >
                    ❚❚
                  </span>
                </button>

                {liveAudioSource === 'directory' ? (
                  <>
                    <button
                      type="button"
                      className="transport-button transport-button--secondary"
                      aria-label="Piste precedente"
                      title="Piste precedente"
                      onClick={playPreviousLiveDirectoryTrack}
                      disabled={liveDirectoryFiles.length === 0}
                    >
                      ⏮
                    </button>

                    <button
                      type="button"
                      className="transport-button transport-button--secondary"
                      aria-label="Piste suivante"
                      title="Piste suivante"
                      onClick={playNextLiveDirectoryTrack}
                      disabled={liveDirectoryFiles.length === 0}
                    >
                      ⏭
                    </button>

                    <button
                      type="button"
                      className="transport-button transport-button--stop"
                      aria-label="Arreter la lecture"
                      title="Arreter la lecture"
                      onClick={stopLiveRadioPlayback}
                      disabled={liveRadioPlaybackState === 'idle'}
                    >
                      ■
                    </button>

                    <button
                      type="button"
                      className={`transport-button transport-button--mode transport-button--mode-${liveDirectoryPlaybackMode}`}
                      aria-label="Changer le mode de lecture"
                      title={`Passer a : ${getLiveDirectoryPlaybackModeLabel(nextLiveDirectoryPlaybackMode)}`}
                      onClick={cycleLiveDirectoryPlaybackMode}
                      disabled={liveDirectoryFiles.length === 0}
                    >
                      {liveDirectoryPlaybackMode === 'normal'
                        ? '➜'
                        : liveDirectoryPlaybackMode === 'repeat'
                          ? '↻'
                          : '⇄'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="transport-button transport-button--stop"
                    aria-label="Arreter la lecture"
                    title="Arreter la lecture"
                    onClick={stopLiveRadioPlayback}
                    disabled={liveRadioPlaybackState === 'idle'}
                  >
                    ■
                  </button>
                )}
              </div>
            </div>
          </details>

          <div className="top-controls">
            <details
              ref={optionsMenuRef}
              className="options-menu"
              open={optionsOpen}
              onToggle={(event) =>
                setOptionsOpen((event.currentTarget as HTMLDetailsElement).open)
              }
            >
              <summary className="options-button" aria-label="Options" title="Options">
                <span aria-hidden="true">⚙</span>
              </summary>

              <div className="options-panel">
                <div className="options-header">
                  <img className="options-header-icon" src={optionsIconUrl} alt="" />
                  <p className="options-header-version">{appSignature}</p>
                </div>

                <div className="options-tabs" role="tablist" aria-label="Sections options">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={optionsTab === 'appearance'}
                    className={`options-tab${optionsTab === 'appearance' ? ' options-tab--active' : ''}`}
                    onClick={() => setOptionsTab('appearance')}
                  >
                    Apparence
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={optionsTab === 'music'}
                    className={`options-tab${optionsTab === 'music' ? ' options-tab--active' : ''}`}
                    onClick={() => setOptionsTab('music')}
                  >
                    Musique
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={optionsTab === 'alarms'}
                    className={`options-tab${optionsTab === 'alarms' ? ' options-tab--active' : ''}`}
                    onClick={() => setOptionsTab('alarms')}
                  >
                    Alarmes
                  </button>
                </div>

                {optionsTab === 'appearance' ? (
                  <section className="options-section">
                    <label
                      className="select-field select-field--compact"
                      htmlFor="theme-select"
                    >
                      <span className="field-label">Theme</span>
                      <select
                        id="theme-select"
                        value={activeThemeName}
                        onChange={(event) => setActiveThemeName(event.target.value)}
                      >
                        {Object.keys(THEMES).map((themeName) => (
                          <option key={themeName} value={themeName}>
                            {themeName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label
                      className="select-field select-field--compact"
                      htmlFor="clock-display-select"
                    >
                      <span className="field-label">Type d&apos;horloge</span>
                      <select
                        id="clock-display-select"
                        value={activeDisplayId}
                        onChange={(event) =>
                          setActiveDisplayId(event.target.value as ClockDisplayId)
                        }
                      >
                        {DISPLAY_MODES.map((display) => (
                          <option key={display.id} value={display.id}>
                            {display.name}
                          </option>
                        ))}
                      </select>
                    </label>

	                    <label className="field-label field-label--checkbox-row" htmlFor="show-date-checkbox">
	                      <input
	                        id="show-date-checkbox"
	                        type="checkbox"
	                        checked={showDate}
	                        onChange={(event) => setShowDate(event.target.checked)}
	                      />
	                      <span>Afficher la date</span>
	                    </label>

	                    <label className="field-label field-label--checkbox-row" htmlFor="time-format-checkbox">
	                      <input
                        id="time-format-checkbox"
                        type="checkbox"
                        checked={use24HourFormat}
                        onChange={(event) => setUse24HourFormat(event.target.checked)}
                      />
                      <span>Affichage 12/24</span>
                    </label>

	                    <label className="field-label field-label--checkbox-row" htmlFor="vu-meter-checkbox">
	                      <input
	                        id="vu-meter-checkbox"
	                        type="checkbox"
	                        checked={vuMeterEnabled}
	                        onChange={(event) => setVuMeterEnabled(event.target.checked)}
	                      />
	                      <span>VU-metre</span>
	                    </label>

	                    {vuMeterEnabled ? (
	                      <>
	                        <label
	                          className="select-field select-field--compact"
	                          htmlFor="vu-meter-display-select"
	                        >
	                          <span className="field-label">Affichage</span>
	                          <select
	                            id="vu-meter-display-select"
	                            value={vuMeterDisplay}
	                            onChange={(event) =>
	                              setVuMeterDisplay(event.target.value as VuMeterDisplay)
	                            }
	                          >
	                            {VU_METER_DISPLAY_OPTIONS.map((option) => (
	                              <option key={option.value} value={option.value}>
	                                {option.label}
	                              </option>
	                            ))}
	                          </select>
	                        </label>

	                        <label
	                          className="select-field select-field--compact"
	                          htmlFor="vu-meter-mode-select"
	                        >
	                          <span className="field-label">Mode VU-metre</span>
	                          <select
	                            id="vu-meter-mode-select"
	                            value={vuMeterMode}
	                            onChange={(event) =>
	                              setVuMeterMode(event.target.value as VuMeterMode)
	                            }
	                          >
	                            <option value="floating">Fenetre</option>
	                            <option value="integrated">Plein ecran</option>
	                          </select>
	                        </label>

	                        <label
	                          className="select-field select-field--compact"
	                          htmlFor="vu-meter-style-select"
	                        >
	                          <span className="field-label">Type de VU-metre</span>
	                          <select
	                            id="vu-meter-style-select"
	                            value={vuMeterStyle}
	                            onChange={(event) =>
	                              setVuMeterStyle(event.target.value as VuMeterStyle)
	                            }
	                          >
	                            {VU_METER_STYLE_OPTIONS.map((option) => (
	                              <option key={option.value} value={option.value}>
	                                {option.label}
	                              </option>
	                            ))}
	                          </select>
	                        </label>
	                      </>
	                    ) : null}

                  </section>
                ) : null}

                {optionsTab === 'music' ? (
                  <section className="options-section">
                    <label className="select-field select-field--compact" htmlFor="live-audio-source-select">
                      <span className="field-label">Source</span>
                      <select
                        id="live-audio-source-select"
                        value={liveAudioSource}
                        onChange={(event) => {
                          const nextSource = event.target.value as LiveAudioSource;
                          stopLiveRadioPlayback();
                          setLiveAudioSource(nextSource);
                          setLiveRadioCurrentSong(null);
                        }}
                      >
                        <option value="radio">Radio @</option>
                        <option value="directory">Musique locale</option>
                      </select>
                    </label>

                    {liveAudioSource === 'radio' ? (
                      <div className="select-field select-field--compact">
                        <StationCombobox
                          detailsRef={(element) => {
                            liveRadioOptionsComboboxRef.current = element;
                          }}
                          buttonId="options-live-radio-select"
                          searchId="options-live-radio-search"
                          label="Selection radio"
                          selectedStation={selectedLiveRadioStation}
                          suggestions={liveRadioSuggestions}
                          alternativeStations={liveRadioAlternativeStations}
                          searchValue={liveRadioSearch}
                          searchState={deferredLiveRadioSearch !== liveRadioSearch ? 'loading' : 'idle'}
                          currentSongLabel={liveRadioCurrentSongLabel}
                          open={liveRadioComboboxOpen}
                          onOpenChange={setLiveRadioComboboxOpen}
                          onSearchChange={setLiveRadioSearch}
                          onSelect={(stationId) => {
                            pendingLiveAutoplayRef.current = 'radio';
                            setLiveRadioStationId(stationId);
                            rememberRecentStation(stationId);
                            setLiveRadioSearch('');
                            setLiveRadioComboboxOpen(false);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="select-field select-field--compact">
                        <span className="field-label">Selection son local</span>
                        <button
                          type="button"
                          className="text-field-input text-field-input--file"
                          onClick={handleBrowseLiveAudio}
                        >
                          Parcourir un dossier audio
                        </button>
                        <span className="field-hint">
                          {liveDirectoryFiles.length > 0
                            ? `${liveDirectoryFiles.length} fichier(s) audio dans ${liveDirectoryName || 'le dossier selectionne'}.`
                            : liveDirectorySelectionMessage || 'Clique sur Parcourir puis choisis un dossier contenant tes musiques.'}
                        </span>
                      </div>
                    )}
                  </section>
                ) : null}

                {optionsTab === 'alarms' ? (
                  <section className="options-section">
                    <button
                      type="button"
                      className="action-button alarm-add-button"
                      onClick={addAlarm}
                      disabled={alarms.length >= 5}
                    >
                      + Ajouter une alarme
                    </button>

                    {alarms.length > 0 ? (
                      <div className="alarm-list">
                        {alarms.map((alarm, index) => (
                          <div
                            key={alarm.id}
                            className="alarm-row"
                            style={{ '--alarm-row-accent': alarm.color } as CSSProperties}
                          >
                            <div className="alarm-row-header">
                              <div className="alarm-title-group">
                                <span className="alarm-badge">
                                  Alarme {index + 1}
                                </span>

                                <label className="alarm-badge-color-field" htmlFor={`alarm-color-${alarm.id}`}>
                                  <span className="sr-only">Couleur de l&apos;alarme {index + 1}</span>
                                  <span className="alarm-badge-color-icon" aria-hidden="true">
                                    <img src={pinceauIconUrl} alt="" />
                                  </span>
                                  <input
                                    id={`alarm-color-${alarm.id}`}
                                    type="color"
                                    value={alarm.color}
                                    onChange={(event) =>
                                      updateAlarm(alarm.id, { color: event.target.value })
                                    }
                                  />
                                </label>
                              </div>

                              <input
                                className="text-field-input alarm-name-input"
                                type="text"
                                value={alarm.name}
                                onChange={(event) =>
                                  updateAlarm(alarm.id, { name: event.target.value })
                                }
                                placeholder="Nom de l'alarme"
                                aria-label={`Nom de l'alarme ${index + 1}`}
                              />
                            </div>

                            <div className="alarm-row-controls">
                              <label className="select-field select-field--compact" htmlFor={`alarm-frequency-${alarm.id}`}>
                                <span className="sr-only">Frequence de l&apos;alarme {index + 1}</span>
                                <select
                                  id={`alarm-frequency-${alarm.id}`}
                                  value={alarm.frequency}
                                  onChange={(event) =>
                                    updateAlarm(alarm.id, {
                                      frequency: event.target.value as AlarmDefinition['frequency'],
                                    })
                                  }
                                >
                                  <option value="once">Unique</option>
                                  <option value="weekdays">Du lundi au vendredi</option>
                                  <option value="daily">Tous les jours</option>
                                </select>
                              </label>

                              <input
                                id={`alarm-time-${alarm.id}`}
                                className="text-field-input alarm-time-input"
                                type="time"
                                value={alarm.time}
                                onChange={(event) =>
                                  updateAlarm(alarm.id, { time: event.target.value })
                                }
                              />

                              <button
                                type="button"
                                className="action-button action-button--secondary alarm-row-remove"
                                onClick={() => removeAlarm(alarm.id)}
                                aria-label={`Supprimer l'alarme ${index + 1}`}
                                title="Supprimer cette alarme"
                              >
                                ×
                              </button>
                            </div>

                            <div className="alarm-row-source">
                              <label className="select-field select-field--compact" htmlFor={`alarm-mode-${alarm.id}`}>
                                <span className="sr-only">Mode de l&apos;alarme {index + 1}</span>
                                <select
                                  id={`alarm-mode-${alarm.id}`}
                                  value={alarm.mode}
                                  onChange={(event) =>
                                    updateAlarm(alarm.id, {
                                      mode: event.target.value as AlarmMode,
                                    })
                                  }
                                >
                                  <option value="visual">Alarme visuelle uniquement</option>
                                  <option value="radio">Alarme visuelle + radio @</option>
                                  <option value="file">Alarme visuelle + musique locale</option>
                                </select>
                              </label>

                              {alarm.mode === 'radio' ? (
                                <label className="select-field select-field--compact" htmlFor={`alarm-radio-${alarm.id}`}>
                                  <span className="field-label">Choisir la radio</span>
                                  <select
                                    id={`alarm-radio-${alarm.id}`}
                                    value={alarm.radioStationId}
                                    onChange={(event) =>
                                      updateAlarm(alarm.id, {
                                        radioStationId: event.target.value,
                                      })
                                    }
                                  >
                                    {DEFAULT_LAUT_FM_STATIONS.map((station) => (
                                      <option key={station.id} value={station.id}>
                                        {station.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}

                              {alarm.mode === 'file' ? (
                                <div className="alarm-local-file">
                                  <input
                                    ref={(element) => {
                                      alarmFileInputRefs.current[alarm.id] = element;
                                    }}
                                    id={`alarm-file-${alarm.id}`}
                                    className="alarm-local-file-input"
                                    type="file"
                                    accept="audio/*"
                                    onChange={(event) =>
                                      handleAlarmFileSelection(alarm.id, event.target.files)
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="action-button action-button--secondary alarm-file-button"
                                    onClick={() => handleAlarmFileBrowse(alarm.id)}
                                  >
                                    Parcourir
                                  </button>
                                  <span className="field-hint">
                                    {alarm.fileName || 'Aucun son local selectionne.'}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {alarmStatusMessage ? (
                      <p
                        className={`alarm-status alarm-status--${alarmPlaybackState}`}
                        role="status"
                      >
                        {alarmStatusMessage}
                      </p>
                    ) : null}
                  </section>
                ) : null}
              </div>
            </details>
          </div>

          {shouldShowClockDisplay
            ? renderActiveDisplay(
              activeDisplay,
              currentTime,
              activeTheme,
              alarms.map((alarm) => alarm.color),
              analogAlarmPreviews,
              showDate,
              use24HourFormat,
            )
            : null}
        </article>
      </section>
      <VuMeter
        enabled={
          shouldShowVuMeterDisplay
          && vuMeterMode === 'floating'
          && !shouldUseExternalVuMeterWindow
        }
        mode={vuMeterMode}
        style={vuMeterStyle}
        levels={activeVuMeterLevels}
        waveform={activeVuMeterWaveform}
      />
      <audio
        ref={liveAudioElementRef}
        className="sr-only"
        preload="none"
        aria-hidden="true"
      />
    </AppShell>
  );
}

export default App;
