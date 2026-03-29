import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AppShell } from './components/AppShell';
import { AnalogClockCard } from './features/clocks/components/AnalogClockCard';
import { FlipClockCard } from './features/clocks/components/FlipClockCard';
import { SevenSegmentClockCard } from './features/clocks/components/SevenSegmentClockCard';
import { DISPLAY_MODES } from './features/clocks/constants';
import { useSystemTime } from './features/clocks/hooks/useSystemTime';
import { DEFAULT_THEME_NAME, THEMES } from './themes/themes';
import type { ClockDisplayDefinition, ClockDisplayId } from './types/clock';
import type { ThemePalette } from './types/theme';
import defaultAlarmSoundUrl from '../assets/alarm.mp3';
import './styles/app.css';

type AlarmSource = 'file' | 'radio';

const RADIO_PRESETS = [
  {
    id: 'groove-salad',
    name: 'Groove Salad',
    style: 'Chill ambient / downtempo',
    url: 'https://somafm.com/m3u/groovesalad256.m3u',
  },
  {
    id: 'indie-pop-rocks',
    name: 'Indie Pop Rocks!',
    style: 'Indie pop doux',
    url: 'https://somafm.com/m3u/indiepop.m3u',
  },
  {
    id: 'poptron',
    name: 'PopTron',
    style: 'Electro pop / indie dance',
    url: 'https://somafm.com/m3u/poptron.m3u',
  },
  {
    id: 'drone-zone',
    name: 'Drone Zone',
    style: 'Ambient profond',
    url: 'https://somafm.com/m3u/dronezone256.m3u',
  },
  {
    id: 'deep-space-one',
    name: 'Deep Space One',
    style: 'Ambient spatial',
    url: 'https://somafm.com/m3u/deepspaceone.m3u',
  },
  {
    id: 'groove-salad-classic',
    name: 'Groove Salad Classic',
    style: 'Chillout classique',
    url: 'https://somafm.com/m3u/gsclassic.m3u',
  },
  {
    id: 'space-station-soma',
    name: 'Space Station Soma',
    style: 'Electronica spacieuse',
    url: 'https://somafm.com/m3u/spacestation.m3u',
  },
  {
    id: 'underground-80s',
    name: 'Underground 80s',
    style: 'Synthpop / new wave',
    url: 'https://somafm.com/m3u/u80s.m3u',
  },
  {
    id: 'secret-agent',
    name: 'Secret Agent',
    style: 'Lounge espion',
    url: 'https://somafm.com/m3u/secretagent.m3u',
  },
  {
    id: 'lush',
    name: 'Lush',
    style: 'Voix feminines / mellow',
    url: 'https://somafm.com/m3u/lush.m3u',
  },
  {
    id: 'left-coast-70s',
    name: 'Left Coast 70s',
    style: 'Soft rock seventies',
    url: 'https://somafm.com/m3u/seventies320.m3u',
  },
  {
    id: 'synphaera-radio',
    name: 'Synphaera Radio',
    style: 'Ambient moderne',
    url: 'https://somafm.com/m3u/synphaera256.m3u',
  },
  {
    id: 'folk-forward',
    name: 'Folk Forward',
    style: 'Indie folk',
    url: 'https://somafm.com/m3u/folkfwd.m3u',
  },
  {
    id: 'def-con-radio',
    name: 'DEF CON Radio',
    style: 'Electronique / hacking',
    url: 'https://somafm.com/m3u/defcon256.m3u',
  },
  {
    id: 'beat-blender',
    name: 'Beat Blender',
    style: 'Deep house / chill nocturne',
    url: 'https://somafm.com/m3u/beatblender.m3u',
  },
  {
    id: 'thistle-radio',
    name: 'ThistleRadio',
    style: 'Celtique',
    url: 'https://somafm.com/m3u/thistle.m3u',
  },
  {
    id: 'boot-liquor',
    name: 'Boot Liquor',
    style: 'Americana / roots',
    url: 'https://somafm.com/m3u/bootliquor320.m3u',
  },
  {
    id: 'sonic-universe',
    name: 'Sonic Universe',
    style: 'Jazz aventureux',
    url: 'https://somafm.com/m3u/sonicuniverse256.m3u',
  },
  {
    id: 'bossa-beyond',
    name: 'Bossa Beyond',
    style: 'Bossa / samba douce',
    url: 'https://somafm.com/m3u/bossa256.m3u',
  },
  {
    id: 'the-dark-zone',
    name: 'The Dark Zone',
    style: 'Dark ambient',
    url: 'https://somafm.com/m3u/darkzone256.m3u',
  },
  {
    id: 'the-trip',
    name: 'The Trip',
    style: 'Progressive house / trance',
    url: 'https://somafm.com/m3u/thetrip.m3u',
  },
  {
    id: 'heavyweight-reggae',
    name: 'Heavyweight Reggae',
    style: 'Reggae / ska / rocksteady',
    url: 'https://somafm.com/m3u/reggae256.m3u',
  },
  {
    id: 'suburbs-of-goa',
    name: 'Suburbs of Goa',
    style: 'World beats / desi',
    url: 'https://somafm.com/m3u/suburbsofgoa.m3u',
  },
  {
    id: 'fluid',
    name: 'Fluid',
    style: 'Instrumental hip-hop / future soul',
    url: 'https://somafm.com/m3u/fluid.m3u',
  },
  {
    id: 'illinois-street-lounge',
    name: 'Illinois Street Lounge',
    style: 'Exotica / lounge vintage',
    url: 'https://somafm.com/m3u/illstreet.m3u',
  },
] as const;

type AlarmRadioPresetId = (typeof RADIO_PRESETS)[number]['id'];
const ALARM_SETTINGS_STORAGE_KEY = 'clocklm.alarm-settings';

function renderActiveDisplay(
  display: ClockDisplayDefinition,
  currentTime: Date,
  theme: ThemePalette,
  alarmTime: string,
  alarmEnabled: boolean,
) {
  switch (display.id) {
    case 'analog':
      return (
        <AnalogClockCard
          currentTime={currentTime}
          display={display}
          theme={theme}
          alarmTime={alarmTime}
          alarmEnabled={alarmEnabled}
        />
      );
    case 'seven-segment':
      return (
        <SevenSegmentClockCard currentTime={currentTime} display={display} />
      );
    case 'flip':
      return <FlipClockCard currentTime={currentTime} display={display} />;
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

async function resolveStreamUrl(sourceUrl: string) {
  const trimmedUrl = sourceUrl.trim();

  if (!trimmedUrl) {
    return '';
  }

  if (!/\.m3u($|\?)/i.test(trimmedUrl) && !/\.pls($|\?)/i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  const response = await fetch(trimmedUrl);
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
      alarmEnabled?: boolean;
      alarmTime?: string;
      alarmAudioEnabled?: boolean;
      alarmSource?: AlarmSource;
      alarmRadioPresetId?: AlarmRadioPresetId;
      alarmRadioUrl?: string;
      alarmVisualEnabled?: boolean;
      alarmVisualColor?: string;
    };
  } catch {
    return null;
  }
}

function App() {
  const storedAlarmSettings = readStoredAlarmSettings();
  const [activeDisplayId, setActiveDisplayId] = useState<ClockDisplayId>('analog');
  const [activeThemeName, setActiveThemeName] = useState(DEFAULT_THEME_NAME);
  const [alarmEnabled, setAlarmEnabled] = useState(
    storedAlarmSettings?.alarmEnabled ?? false,
  );
  const [alarmTime, setAlarmTime] = useState(storedAlarmSettings?.alarmTime ?? '07:00');
  const [alarmAudioEnabled, setAlarmAudioEnabled] = useState(
    storedAlarmSettings?.alarmAudioEnabled ?? true,
  );
  const [alarmSource, setAlarmSource] = useState<AlarmSource>(
    storedAlarmSettings?.alarmSource ?? 'file',
  );
  const [alarmFile, setAlarmFile] = useState<File | null>(null);
  const [alarmRadioPresetId, setAlarmRadioPresetId] = useState<AlarmRadioPresetId>(
    storedAlarmSettings?.alarmRadioPresetId ?? RADIO_PRESETS[0].id,
  );
  const [alarmRadioUrl, setAlarmRadioUrl] = useState(
    storedAlarmSettings?.alarmRadioUrl ?? '',
  );
  const [alarmVisualEnabled, setAlarmVisualEnabled] = useState(
    storedAlarmSettings?.alarmVisualEnabled ?? true,
  );
  const [alarmVisualColor, setAlarmVisualColor] = useState(
    storedAlarmSettings?.alarmVisualColor ?? '#ff2a2a',
  );
  const [alarmPlaybackState, setAlarmPlaybackState] = useState<
    'idle' | 'ringing' | 'error'
  >('idle');
  const [alarmStatusMessage, setAlarmStatusMessage] = useState('');
  const [liveRadioPresetId, setLiveRadioPresetId] = useState<AlarmRadioPresetId>(
    RADIO_PRESETS[0].id,
  );
  const [liveRadioPlaybackState, setLiveRadioPlaybackState] = useState<
    'idle' | 'playing' | 'paused' | 'error'
  >('idle');
  const currentTime = useSystemTime();
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmObjectUrlRef = useRef<string | null>(null);
  const lastTriggeredAlarmMinuteRef = useRef<string | null>(null);
  const liveRadioAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeDisplay = useMemo(
    () =>
      DISPLAY_MODES.find((display) => display.id === activeDisplayId) ??
      DISPLAY_MODES[0],
    [activeDisplayId],
  );
  const activeTheme = THEMES[activeThemeName] ?? THEMES[DEFAULT_THEME_NAME];
  const selectedRadioPreset =
    RADIO_PRESETS.find((preset) => preset.id === alarmRadioPresetId) ?? RADIO_PRESETS[0];
  const selectedLiveRadioPreset =
    RADIO_PRESETS.find((preset) => preset.id === liveRadioPresetId) ?? RADIO_PRESETS[0];
  const effectiveRadioUrl = alarmRadioUrl.trim() || selectedRadioPreset.url;
  const themeFamily = getThemeFamily(activeThemeName);
  const themeStyle = {
    '--theme-bg': activeTheme.BG,
    '--theme-panel': activeTheme.PANEL,
    '--theme-field': activeTheme.FIELD,
    '--theme-fg': activeTheme.FG,
    '--theme-field-fg': activeTheme.FIELD_FG,
    '--theme-accent': activeTheme.ACCENT,
    '--alarm-visual-color': alarmVisualColor,
  } as CSSProperties;

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
  };

  const stopLiveRadioPlayback = () => {
    const activeAudio = liveRadioAudioRef.current;
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.src = '';
      liveRadioAudioRef.current = null;
    }

    setLiveRadioPlaybackState('idle');
  };

  const startAlarmPlayback = async (triggerLabel: string) => {
    stopAlarmPlayback();
    stopLiveRadioPlayback();

    if (!alarmAudioEnabled) {
      setAlarmPlaybackState('ringing');
      setAlarmStatusMessage(triggerLabel);
      return;
    }

    let sourceUrl = '';
    let isLooping = false;

    if (alarmSource === 'file') {
      if (alarmFile) {
        const objectUrl = URL.createObjectURL(alarmFile);
        alarmObjectUrlRef.current = objectUrl;
        sourceUrl = objectUrl;
      } else {
        sourceUrl = defaultAlarmSoundUrl;
      }
      isLooping = true;
    } else {
      if (!effectiveRadioUrl) {
        setAlarmPlaybackState('error');
        setAlarmStatusMessage('Aucune URL de radio n’est renseignee.');
        return;
      }

      try {
        sourceUrl = await resolveStreamUrl(effectiveRadioUrl);
      } catch {
        setAlarmPlaybackState('error');
        setAlarmStatusMessage('Impossible de resoudre le flux radio selectionne.');
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
      setAlarmPlaybackState('error');
      setAlarmStatusMessage(
        'Lecture bloquee par le navigateur. Interagis avec la page puis relance le test.',
      );
    }
  };

  const startLiveRadioPlayback = async () => {
    stopLiveRadioPlayback();
    stopAlarmPlayback();

    try {
      const sourceUrl = await resolveStreamUrl(selectedLiveRadioPreset.url);
      const audio = new Audio(sourceUrl);
      audio.preload = 'none';
      liveRadioAudioRef.current = audio;
      await audio.play();
      setLiveRadioPlaybackState('playing');
    } catch {
      stopLiveRadioPlayback();
      setLiveRadioPlaybackState('error');
    }
  };

  const pauseLiveRadioPlayback = () => {
    const activeAudio = liveRadioAudioRef.current;
    if (!activeAudio) {
      return;
    }

    activeAudio.pause();
    setLiveRadioPlaybackState('paused');
  };

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
        alarmEnabled,
        alarmTime,
        alarmAudioEnabled,
        alarmSource,
        alarmRadioPresetId,
        alarmRadioUrl,
        alarmVisualEnabled,
        alarmVisualColor,
      }),
    );
  }, [
    alarmEnabled,
    alarmTime,
    alarmAudioEnabled,
    alarmSource,
    alarmRadioPresetId,
    alarmRadioUrl,
    alarmVisualEnabled,
    alarmVisualColor,
  ]);

  useEffect(() => {
    if (!alarmEnabled) {
      stopAlarmPlayback();
    }
  }, [alarmEnabled]);

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
    if (liveRadioPlaybackState !== 'playing') {
      return;
    }

    void startLiveRadioPlayback();
  }, [liveRadioPresetId]);

  useEffect(() => {
    if (!alarmEnabled) {
      return;
    }

    const currentMinute = currentTime.toTimeString().slice(0, 5);
    if (currentMinute !== alarmTime) {
      return;
    }

    const alarmMinuteKey = formatAlarmMinuteKey(currentTime);
    if (lastTriggeredAlarmMinuteRef.current === alarmMinuteKey) {
      return;
    }

    lastTriggeredAlarmMinuteRef.current = alarmMinuteKey;
    void startAlarmPlayback(`Alarme declenchee a ${alarmTime}.`);
  }, [alarmEnabled, alarmSource, alarmTime, currentTime, effectiveRadioUrl, alarmFile]);

  return (
    <AppShell style={themeStyle}>
      <section className="clock-layout" data-theme-family={themeFamily}>
        <article
          className={`display-stage-card ${
            alarmPlaybackState === 'ringing' && alarmVisualEnabled
              ? 'display-stage-card--alarm'
              : ''
          }`}
          data-display-id={activeDisplayId}
        >
          <div className="live-radio-controls">
            <label className="live-radio-select" htmlFor="live-radio-select">
              <span className="sr-only">Radio en lecture directe</span>
              <select
                id="live-radio-select"
                value={liveRadioPresetId}
                onChange={(event) =>
                  setLiveRadioPresetId(event.target.value as AlarmRadioPresetId)
                }
              >
                {RADIO_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="transport-button"
              aria-label="Lire la radio"
              onClick={() => void startLiveRadioPlayback()}
            >
              ▶
            </button>

            <button
              type="button"
              className="transport-button transport-button--pause"
              aria-label="Mettre la radio en pause"
              onClick={pauseLiveRadioPlayback}
              disabled={liveRadioPlaybackState !== 'playing'}
            >
              ❚❚
            </button>
          </div>

          <div className="top-controls">
            <details className="options-menu">
              <summary className="options-button">Options</summary>

              <div className="options-panel">
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

                <section className="options-section" aria-labelledby="alarm-settings-title">
                  <div className="section-heading">
                    <p className="section-kicker">Alarmes</p>
                    <h3 id="alarm-settings-title">Reglage de l&apos;alarme</h3>
                  </div>

                  <label className="select-field select-field--compact" htmlFor="alarm-time">
                    <span className="field-label field-label--checkbox-row">
                      <input
                        id="alarm-enabled"
                        type="checkbox"
                        checked={alarmEnabled}
                        onChange={(event) => {
                          setAlarmEnabled(event.target.checked);
                          if (!event.target.checked) {
                            lastTriggeredAlarmMinuteRef.current = null;
                          }
                        }}
                      />
                      <span>Heure de l&apos;alarme</span>
                    </span>
                    <input
                      id="alarm-time"
                      className="text-field-input"
                      type="time"
                      value={alarmTime}
                      onChange={(event) => setAlarmTime(event.target.value)}
                      disabled={!alarmEnabled}
                    />
                  </label>

                  <div className="alarm-visual-row">
                    <label className="field-label field-label--checkbox-row" htmlFor="alarm-visual-enabled">
                      <input
                        id="alarm-visual-enabled"
                        type="checkbox"
                        checked={alarmVisualEnabled}
                        onChange={(event) => setAlarmVisualEnabled(event.target.checked)}
                        disabled={!alarmEnabled}
                      />
                      <span>Alarme visuelle</span>
                    </label>

                    <label className="alarm-color-field" htmlFor="alarm-visual-color">
                      <span className="sr-only">Couleur de l&apos;alarme visuelle</span>
                      <input
                        id="alarm-visual-color"
                        type="color"
                        value={alarmVisualColor}
                        onChange={(event) => setAlarmVisualColor(event.target.value)}
                        disabled={!alarmEnabled || !alarmVisualEnabled}
                      />
                    </label>
                  </div>

                  <label className="select-field select-field--compact" htmlFor="alarm-source-select">
                    <span className="field-label field-label--checkbox-row">
                      <input
                        id="alarm-audio-enabled"
                        type="checkbox"
                        checked={alarmAudioEnabled}
                        onChange={(event) => setAlarmAudioEnabled(event.target.checked)}
                        disabled={!alarmEnabled}
                      />
                      <span>Source audio</span>
                    </span>
                    <select
                      id="alarm-source-select"
                      value={alarmSource}
                      onChange={(event) => setAlarmSource(event.target.value as AlarmSource)}
                      disabled={!alarmEnabled || !alarmAudioEnabled}
                    >
                      <option value="file">Son present sur le disque</option>
                      <option value="radio">Radio via URL</option>
                    </select>
                  </label>

                  {alarmSource === 'file' ? (
                    <label className="select-field select-field--compact" htmlFor="alarm-audio-file">
                      <span className="field-label">Fichier audio</span>
                      <input
                        id="alarm-audio-file"
                        className="text-field-input text-field-input--file"
                        type="file"
                        accept="audio/*"
                        disabled={!alarmEnabled}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          setAlarmFile(file ?? null);
                        }}
                      />
                      <span className="field-hint">
                        {alarmFile?.name ||
                          'Aucun fichier choisi : le son par defaut assets/alarm.mp3 sera utilise.'}
                      </span>
                    </label>
                  ) : (
                    <>
                      <label
                        className="select-field select-field--compact"
                        htmlFor="alarm-radio-preset"
                      >
                        <span className="field-label">Radio internet</span>
                        <select
                          id="alarm-radio-preset"
                          value={alarmRadioPresetId}
                          onChange={(event) =>
                            setAlarmRadioPresetId(event.target.value as AlarmRadioPresetId)
                          }
                          disabled={!alarmEnabled}
                        >
                          {RADIO_PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name} · {preset.style}
                            </option>
                          ))}
                        </select>
                        <span className="field-hint">
                          Flux selectionne : {selectedRadioPreset.url}
                        </span>
                      </label>

                      <label
                        className="select-field select-field--compact"
                        htmlFor="alarm-radio-url"
                      >
                        <span className="field-label">Ajouter une URL de radio</span>
                        <input
                          id="alarm-radio-url"
                          className="text-field-input"
                          type="url"
                          inputMode="url"
                          placeholder="https://..."
                          value={alarmRadioUrl}
                          onChange={(event) => setAlarmRadioUrl(event.target.value)}
                          disabled={!alarmEnabled}
                        />
                        <span className="field-hint">
                          Cette ligne permet de saisir un flux personnalise a la place
                          d&apos;une radio predefinie.
                        </span>
                      </label>
                    </>
                  )}

                  <div className="alarm-actions">
                    <button
                      type="button"
                      className="action-button"
                      disabled={!alarmEnabled}
                      onClick={() => void startAlarmPlayback('Lecture de test de l’alarme.')}
                    >
                      Tester l&apos;alarme
                    </button>

                    <button
                      type="button"
                      className="action-button action-button--secondary"
                      disabled={alarmPlaybackState !== 'ringing'}
                      onClick={stopAlarmPlayback}
                    >
                      Arreter le son
                    </button>
                  </div>

                  {alarmStatusMessage ? (
                    <p
                      className={`alarm-status alarm-status--${alarmPlaybackState}`}
                      role="status"
                    >
                      {alarmStatusMessage}
                    </p>
                  ) : null}
                </section>
              </div>
            </details>
          </div>

          {renderActiveDisplay(
            activeDisplay,
            currentTime,
            activeTheme,
            alarmTime,
            alarmEnabled,
          )}
        </article>
      </section>
    </AppShell>
  );
}

export default App;
