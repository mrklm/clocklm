import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
} from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { AppShell } from './components/AppShell';
import { AnalogClockCard } from './features/clocks/components/AnalogClockCard';
import { FlipClockCard } from './features/clocks/components/FlipClockCard';
import { SevenSegmentClockCard } from './features/clocks/components/SevenSegmentClockCard';
import { DISPLAY_MODES } from './features/clocks/constants';
import { useSystemTime } from './features/clocks/hooks/useSystemTime';
import { DEFAULT_THEME_NAME, THEMES } from './themes/themes';
import type { ClockDisplayDefinition, ClockDisplayId } from './types/clock';
import type { ThemePalette } from './types/theme';
import clocklmIconUrl from '../assets/clocklm.png';
import defaultAlarmSoundUrl from '../assets/alarm.mp3';
import packageJson from '../package.json';
import './styles/app.css';

type AlarmSource = 'file' | 'radio';
type LiveAudioSource = 'radio' | 'directory';
type LiveDirectoryPlaybackMode = 'normal' | 'repeat' | 'shuffle';

type LautFmStation = {
  id: string;
  name: string;
  style: string;
  url: string;
  pageUrl: string;
  provider?: 'lautfm' | 'custom';
};

type LautFmCurrentSong = {
  artistName: string;
  title: string;
};

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
): LautFmStation {
  return {
    id,
    name,
    style,
    url,
    pageUrl,
    provider: 'custom',
  };
}

const DEFAULT_LAUT_FM_STATIONS: LautFmStation[] = [
  createLautFmStation('allstations', 'Allstations', 'Multi-style / decouverte'),
  createCustomStation(
    'djam-radio',
    'Le new Djam',
    'Soul / funk / jazz / world',
    'https://stream9.xdevel.com/audio1s976748-1515/stream/icecast.audio',
    'https://www.djam.radio/',
  ),
  createLautFmStation('light-radio', 'Light Radio', 'Pop / chill'),
  createLautFmStation('clubhits', 'Clubhits', 'Dance / electro'),
  createLautFmStation('sound', 'Sound', 'Country / americana'),
  createLautFmStation('gothica', 'Gothica', 'Rock gothique'),
  createLautFmStation('vaporwave', 'Vaporwave', 'Vaporwave / retro'),
  createLautFmStation('bluesrockcafe', 'Blues Rock Cafe', 'Blues / rock'),
  createLautFmStation('jazzrockfusion', 'Jazz Rock Fusion', 'Jazz fusion / funk'),
  createLautFmStation('natureadio', 'Naturadio', 'Ambient / folk / pop'),
  createLautFmStation('rockmag', 'Rockmag', 'Rock'),
];
const ALARM_SETTINGS_STORAGE_KEY = 'clocklm.alarm-settings';
const APP_SIGNATURE_FALLBACK = `Clocklm v${packageJson.version}`;
const APP_REPOSITORY_URL = 'https://github.com/mrklm/clocklm';
const DIRECTORY_INPUT_ATTRIBUTES = {
  webkitdirectory: '',
} as unknown as InputHTMLAttributes<HTMLInputElement>;

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

function formatStationCurrentSong(song: LautFmCurrentSong | null) {
  if (!song) {
    return '';
  }

  if (song.artistName && song.title) {
    return `${song.artistName} - ${song.title}`;
  }

  return song.artistName || song.title;
}

function supportsLautFmCurrentSong(station: LautFmStation) {
  return station.provider !== 'custom';
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

function getRecentStations(
  stations: LautFmStation[],
  recentStationIds: string[],
  selectedStationId: string,
  limit = 10,
) {
  const stationMap = new Map(stations.map((station) => [station.id, station]));
  const recentStations = recentStationIds
    .map((stationId) => stationMap.get(stationId))
    .filter((station): station is LautFmStation => Boolean(station));

  if (!recentStations.some((station) => station.id === selectedStationId)) {
    const selectedStation = stationMap.get(selectedStationId);
    if (selectedStation) {
      recentStations.unshift(selectedStation);
    }
  }

  const fallbackStations = stations.filter(
    (station) => !recentStations.some((recentStation) => recentStation.id === station.id),
  );

  return [...recentStations, ...fallbackStations].slice(0, limit);
}

type StationComboboxProps = {
  buttonId: string;
  searchId: string;
  label?: string;
  selectedStation: LautFmStation;
  suggestions: LautFmStation[];
  recentStations: LautFmStation[];
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
  recentStations,
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
  const displayedStations = searchValue.trim() ? suggestions : recentStations;

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
            {searchValue.trim() ? 'Occurrences' : 'Dernieres radios selectionnees'}
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
      alarmRadioStationId?: string;
      alarmRadioUrl?: string;
      alarmVisualEnabled?: boolean;
      alarmVisualColor?: string;
      recentRadioStationIds?: string[];
      liveAudioSource?: LiveAudioSource;
      liveRadioStationId?: string;
    };
  } catch {
    return null;
  }
}

function App() {
  const storedAlarmSettings = readStoredAlarmSettings();
  const [activeDisplayId, setActiveDisplayId] = useState<ClockDisplayId>('analog');
  const [activeThemeName, setActiveThemeName] = useState(DEFAULT_THEME_NAME);
  const [appSignature, setAppSignature] = useState(APP_SIGNATURE_FALLBACK);
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
  const [alarmRadioStationId, setAlarmRadioStationId] = useState(
    storedAlarmSettings?.alarmRadioStationId ?? DEFAULT_LAUT_FM_STATIONS[0].id,
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
  const [liveRadioStationId, setLiveRadioStationId] = useState(
    storedAlarmSettings?.liveRadioStationId ?? DEFAULT_LAUT_FM_STATIONS[0].id,
  );
  const [liveAudioSource, setLiveAudioSource] = useState<LiveAudioSource>(
    storedAlarmSettings?.liveAudioSource ?? 'radio',
  );
  const [liveRadioPlaybackState, setLiveRadioPlaybackState] = useState<
    'idle' | 'playing' | 'paused' | 'error'
  >('idle');
  const [liveRadioCurrentSong, setLiveRadioCurrentSong] =
    useState<LautFmCurrentSong | null>(null);
  const [liveDirectoryFiles, setLiveDirectoryFiles] = useState<File[]>([]);
  const [liveDirectoryName, setLiveDirectoryName] = useState('');
  const [liveDirectoryTrackLabel, setLiveDirectoryTrackLabel] = useState('');
  const [liveDirectoryPlaybackMode, setLiveDirectoryPlaybackMode] =
    useState<LiveDirectoryPlaybackMode>('normal');
  const [alarmRadioSearch, setAlarmRadioSearch] = useState('');
  const [liveRadioSearch, setLiveRadioSearch] = useState('');
  const [alarmRadioStations, setAlarmRadioStations] = useState(DEFAULT_LAUT_FM_STATIONS);
  const [liveRadioStations, setLiveRadioStations] = useState(DEFAULT_LAUT_FM_STATIONS);
  const [recentRadioStationIds, setRecentRadioStationIds] = useState(
    storedAlarmSettings?.recentRadioStationIds ?? [],
  );
  const [alarmRadioSearchState, setAlarmRadioSearchState] = useState<
    'idle' | 'loading' | 'error'
  >('idle');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [alarmRadioComboboxOpen, setAlarmRadioComboboxOpen] = useState(false);
  const [liveRadioComboboxOpen, setLiveRadioComboboxOpen] = useState(false);
  const currentTime = useSystemTime();
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmObjectUrlRef = useRef<string | null>(null);
  const lastTriggeredAlarmMinuteRef = useRef<string | null>(null);
  const liveRadioAudioRef = useRef<HTMLAudioElement | null>(null);
  const liveDirectoryInputRef = useRef<HTMLInputElement | null>(null);
  const liveDirectoryObjectUrlsRef = useRef<string[]>([]);
  const liveDirectoryTrackIndexRef = useRef(0);
  const liveDirectoryPlaybackModeRef = useRef<LiveDirectoryPlaybackMode>('normal');
  const pendingLiveAutoplayRef = useRef<LiveAudioSource | null>(null);
  const optionsMenuRef = useRef<HTMLDetailsElement | null>(null);
  const liveRadioStageComboboxRef = useRef<HTMLDetailsElement | null>(null);
  const liveRadioOptionsComboboxRef = useRef<HTMLDetailsElement | null>(null);
  const alarmRadioComboboxRef = useRef<HTMLDetailsElement | null>(null);
  const deferredAlarmRadioSearch = useDeferredValue(alarmRadioSearch);
  const deferredLiveRadioSearch = useDeferredValue(liveRadioSearch);

  useEffect(() => {
    let cancelled = false;

    void getVersion()
      .then((version) => {
        if (!cancelled) {
          setAppSignature(`Clocklm v${version}`);
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
    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target;
      if (!(targetNode instanceof Node)) {
        return;
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

      if (
        alarmRadioComboboxOpen
        && alarmRadioComboboxRef.current
        && !alarmRadioComboboxRef.current.contains(targetNode)
      ) {
        setAlarmRadioComboboxOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [alarmRadioComboboxOpen, liveRadioComboboxOpen, optionsOpen]);

  const activeDisplay = useMemo(
    () =>
      DISPLAY_MODES.find((display) => display.id === activeDisplayId) ??
      DISPLAY_MODES[0],
    [activeDisplayId],
  );
  const activeTheme = THEMES[activeThemeName] ?? THEMES[DEFAULT_THEME_NAME];
  const selectedAlarmRadioStation =
    findStationById(alarmRadioStations, alarmRadioStationId) ??
    findStationById(DEFAULT_LAUT_FM_STATIONS, alarmRadioStationId) ??
    DEFAULT_LAUT_FM_STATIONS[0];
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
  const alarmRadioSuggestions = useMemo(
    () =>
      getStationSuggestions(
        mergeStations(alarmRadioStations, DEFAULT_LAUT_FM_STATIONS),
        alarmRadioSearch,
        alarmRadioStationId,
      ),
    [alarmRadioSearch, alarmRadioStationId, alarmRadioStations],
  );
  const liveRadioRecentStations = useMemo(
    () =>
      getRecentStations(
        mergeStations(liveRadioStations, DEFAULT_LAUT_FM_STATIONS),
        recentRadioStationIds,
        liveRadioStationId,
      ),
    [liveRadioStationId, liveRadioStations, recentRadioStationIds],
  );
  const alarmRadioRecentStations = useMemo(
    () =>
      getRecentStations(
        mergeStations(alarmRadioStations, DEFAULT_LAUT_FM_STATIONS),
        recentRadioStationIds,
        alarmRadioStationId,
      ),
    [alarmRadioStationId, alarmRadioStations, recentRadioStationIds],
  );
  const effectiveRadioUrl = alarmRadioUrl.trim() || selectedAlarmRadioStation.url;
  const liveRadioCurrentSongLabel = formatStationCurrentSong(liveRadioCurrentSong);
  const liveTransportTitle =
    liveAudioSource === 'radio'
      ? selectedLiveRadioStation.name
      : liveDirectoryTrackLabel || liveDirectoryName || 'Aucun dossier audio selectionne';
  const nextLiveDirectoryPlaybackMode = getNextLiveDirectoryPlaybackMode(
    liveDirectoryPlaybackMode,
  );
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
      activeAudio.onended = null;
      activeAudio.pause();
      activeAudio.src = '';
      liveRadioAudioRef.current = null;
    }

    setLiveRadioPlaybackState('idle');
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
    liveDirectoryObjectUrlsRef.current.forEach((objectUrl) => {
      URL.revokeObjectURL(objectUrl);
    });
    liveDirectoryObjectUrlsRef.current = [];
    liveDirectoryTrackIndexRef.current = 0;
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
    if (
      liveRadioPlaybackState === 'paused' &&
      liveRadioAudioRef.current &&
      liveAudioSource === 'radio'
    ) {
      try {
        await liveRadioAudioRef.current.play();
        setLiveRadioPlaybackState('playing');
      } catch {
        stopLiveRadioPlayback();
        setLiveRadioPlaybackState('error');
      }
      return;
    }

    stopLiveRadioPlayback();
    stopAlarmPlayback();

    try {
      const sourceUrl = await resolveStreamUrl(selectedLiveRadioStation.url);
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

  const playLiveDirectoryTrack = async (trackIndex = 0) => {
    if (liveDirectoryFiles.length === 0) {
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
        await liveRadioAudioRef.current.play();
        setLiveRadioPlaybackState('playing');
      } catch {
        stopLiveRadioPlayback();
        setLiveRadioPlaybackState('error');
      }
      return;
    }

    stopLiveRadioPlayback();
    stopAlarmPlayback();

    try {
      const objectUrl =
        liveDirectoryObjectUrlsRef.current[trackIndex] ??
        URL.createObjectURL(liveDirectoryFiles[trackIndex]);
      liveDirectoryObjectUrlsRef.current[trackIndex] = objectUrl;
      liveDirectoryTrackIndexRef.current = trackIndex;

      const audio = new Audio(objectUrl);
      audio.preload = 'auto';
      audio.onended = () => {
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
      liveRadioAudioRef.current = audio;
      setLiveDirectoryTrackLabel(liveDirectoryFiles[trackIndex]?.name ?? liveDirectoryName);
      await audio.play();
      setLiveRadioPlaybackState('playing');
    } catch {
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

  const handleLiveDirectorySelection = (files: FileList | null) => {
    clearLiveDirectoryObjectUrls();
    stopLiveRadioPlayback();

    const selectedFiles = Array.from(files ?? []).filter((file) =>
      file.type.startsWith('audio/'),
    );

    setLiveDirectoryFiles(selectedFiles);
    setLiveDirectoryTrackLabel('');

    if (selectedFiles.length === 0) {
      pendingLiveAutoplayRef.current = null;
      setLiveDirectoryName('');
      return;
    }

    pendingLiveAutoplayRef.current = 'directory';
    const firstFile = selectedFiles[0];
    const relativePath =
      'webkitRelativePath' in firstFile ? firstFile.webkitRelativePath : '';
    const [directoryName] = relativePath.split('/');
    setLiveDirectoryName(directoryName || 'Musique disque dur');
  };

  const handleBrowseLiveAudio = () => {
    if (liveAudioSource === 'directory') {
      liveDirectoryInputRef.current?.click();
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
        alarmRadioStationId,
        alarmRadioUrl,
        alarmVisualEnabled,
        alarmVisualColor,
        recentRadioStationIds,
        liveAudioSource,
        liveRadioStationId,
      }),
    );
  }, [
    alarmEnabled,
    alarmTime,
    alarmAudioEnabled,
    alarmSource,
    alarmRadioStationId,
    alarmRadioUrl,
    alarmVisualEnabled,
    alarmVisualColor,
    recentRadioStationIds,
    liveAudioSource,
    liveRadioStationId,
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
      liveAudioSource !== 'directory'
      || pendingLiveAutoplayRef.current !== 'directory'
      || liveDirectoryFiles.length === 0
    ) {
      return;
    }

    pendingLiveAutoplayRef.current = null;
    void playLiveDirectoryTrack(0);
  }, [liveAudioSource, liveDirectoryFiles]);

  useEffect(() => {
    if (liveAudioSource !== 'radio' || !supportsLautFmCurrentSong(selectedLiveRadioStation)) {
      setLiveRadioCurrentSong(null);
      return;
    }

    const controller = new AbortController();
    let refreshTimer: number | null = null;

    const loadCurrentSong = async () => {
      try {
        const song = await fetchLautFmCurrentSong(
          selectedLiveRadioStation.id,
          controller.signal,
        );
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
  }, [liveAudioSource, selectedLiveRadioStation.id]);

  useEffect(() => {
    return () => {
      clearLiveDirectoryObjectUrls();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const trimmedQuery = deferredAlarmRadioSearch.trim();

    if (!trimmedQuery) {
      setAlarmRadioStations(
        mergeStations(
          DEFAULT_LAUT_FM_STATIONS,
          selectedAlarmRadioStation ? [selectedAlarmRadioStation] : [],
        ),
      );
      setAlarmRadioSearchState('idle');
      return () => {
        controller.abort();
      };
    }

    setAlarmRadioSearchState('loading');
    searchLautFmStations(trimmedQuery, controller.signal)
      .then((stations) => {
        setAlarmRadioStations(
          mergeStations(stations, selectedAlarmRadioStation ? [selectedAlarmRadioStation] : []),
        );
        setAlarmRadioSearchState('idle');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setAlarmRadioSearchState('error');
      });

    return () => {
      controller.abort();
    };
  }, [deferredAlarmRadioSearch, selectedAlarmRadioStation]);

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
    <AppShell
      style={themeStyle}
      appSignature={appSignature}
      appSignatureHref={APP_REPOSITORY_URL}
    >
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
            {liveAudioSource === 'radio' ? (
              <StationCombobox
                detailsRef={(element) => {
                  liveRadioStageComboboxRef.current = element;
                }}
                buttonId="live-radio-select"
                searchId="live-radio-search"
                selectedStation={selectedLiveRadioStation}
                suggestions={liveRadioSuggestions}
                recentStations={liveRadioRecentStations}
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
                    : 'Lire la selection'
                }
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
                  ▶
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
                  <img className="options-header-icon" src={clocklmIconUrl} alt="" />
                  <div className="options-header-copy">
                    <p className="options-header-title">Clocklm</p>
                    <p className="options-header-version">{appSignature}</p>
                  </div>
                </div>

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

                <section className="options-section" aria-labelledby="music-settings-title">
                  <div className="section-heading">
                    <p className="section-kicker">Musique</p>
                    <h3 id="music-settings-title">Lecture principale</h3>
                  </div>

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
                      <option value="directory">Musique disque dur</option>
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
                        label="Station"
                        selectedStation={selectedLiveRadioStation}
                        suggestions={liveRadioSuggestions}
                        recentStations={liveRadioRecentStations}
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
                    <label className="select-field select-field--compact" htmlFor="live-audio-directory">
                      <span className="field-label">Repertoire audio</span>
                      <input
                        ref={liveDirectoryInputRef}
                        id="live-audio-directory"
                        className="text-field-input text-field-input--file"
                        type="file"
                        accept="audio/*"
                        multiple
                        disabled={false}
                        onChange={(event) => handleLiveDirectorySelection(event.target.files)}
                        {...DIRECTORY_INPUT_ATTRIBUTES}
                      />
                      <span className="field-hint">
                        {liveDirectoryFiles.length > 0
                          ? `${liveDirectoryFiles.length} fichier(s) audio dans ${liveDirectoryName || 'le dossier selectionne'}.`
                          : 'Clique sur Parcourir puis choisis un dossier contenant tes musiques.'}
                      </span>
                    </label>
                  )}
                </section>

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
                      <div className="select-field select-field--compact">
                        <StationCombobox
                          detailsRef={(element) => {
                            alarmRadioComboboxRef.current = element;
                          }}
                          buttonId="alarm-radio-station"
                          searchId="alarm-radio-search"
                          label="Station laut.fm"
                          selectedStation={selectedAlarmRadioStation}
                          suggestions={alarmRadioSuggestions}
                          recentStations={alarmRadioRecentStations}
                          searchValue={alarmRadioSearch}
                          searchState={alarmRadioSearchState}
                          disabled={!alarmEnabled}
                          open={alarmRadioComboboxOpen}
                          onOpenChange={setAlarmRadioComboboxOpen}
                          onSearchChange={setAlarmRadioSearch}
                          onSelect={(stationId) => {
                            setAlarmRadioStationId(stationId);
                            rememberRecentStation(stationId);
                            setAlarmRadioSearch('');
                            setAlarmRadioComboboxOpen(false);
                          }}
                        />
                        <span className="field-hint">
                          {alarmRadioSearchState === 'loading'
                            ? 'Recherche laut.fm en cours...'
                            : alarmRadioSearchState === 'error'
                              ? 'Recherche indisponible, stations par defaut affichees.'
                              : `Flux selectionne : ${selectedAlarmRadioStation.url}`}
                        </span>
                      </div>

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
                          d&apos;une station laut.fm. Laisse vide pour utiliser la station
                          selectionnee.
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
