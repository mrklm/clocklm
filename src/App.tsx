import {
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
  createLautFmStation('natureadio', 'Naturadio', 'Ambient / folk / chill'),
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
  createLautFmStation('soulmama', 'Soulmama', 'Soul / funk / jazz'),
  createLautFmStation('delasoul', 'Delasoul', 'Soul / funk / R&B'),
  createLautFmStation('soulfood', 'Soulfood', 'Soul / funk / jazz'),
  createLautFmStation('jazzrockfusion', 'Jazz Rock Fusion', 'Jazz fusion / funk'),
  createLautFmStation('bluesrockcafe', 'Blues Rock Cafe', 'Blues / rock'),
  createCustomStation(
    'mutant-radio',
    'Mutant Radio',
    'Ambient / leftfield / experimental / underground',
    'https://stream.mutantradio.net/memfs/052585f9-6013-4e45-b094-0f03b215814c.m3u8',
    'https://www.mutantradio.net/',
  ),
  createLautFmStation('vaporwave', 'Vaporwave', 'Vaporwave / retro'),
];
const FEATURED_ALTERNATIVE_STATION_IDS = [
  'nts-slow-focus',
  'nts-low-key',
  'lofi',
  'natureadio',
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

function getFilePathParts(file: File) {
  const relativePath =
    'webkitRelativePath' in file && file.webkitRelativePath
      ? file.webkitRelativePath
      : file.name;

  return relativePath.split('/').filter(Boolean);
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
  },
) {
  let lastError: unknown = null;

  for (const candidateUrl of candidateUrls) {
    const audio = new Audio();
    audio.preload = options?.preload ?? 'none';
    audio.loop = options?.loop ?? false;
    audio.src = candidateUrl;

    try {
      await audio.play();
      return audio;
    } catch (error) {
      lastError = error;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
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
  const [showDate, setShowDate] = useState(storedAlarmSettings?.showDate ?? false);
  const [use24HourFormat, setUse24HourFormat] = useState(
    storedAlarmSettings?.use24HourFormat ?? true,
  );
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
    'idle' | 'playing' | 'paused' | 'error'
  >('idle');
  const [liveRadioCurrentSong, setLiveRadioCurrentSong] =
    useState<LautFmCurrentSong | null>(null);
  const [liveDirectoryFiles, setLiveDirectoryFiles] = useState<File[]>([]);
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
  const liveRadioAudioRef = useRef<HTMLAudioElement | null>(null);
  const liveDirectoryInputRef = useRef<HTMLInputElement | null>(null);
  const liveDirectoryObjectUrlsRef = useRef<string[]>([]);
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
  const livePlaybackActive = liveRadioPlaybackState === 'playing' || liveRadioPlaybackState === 'paused';
  const playerSummaryPrimary =
    liveAudioSource === 'radio'
      ? selectedLiveRadioStation.name
      : liveDirectoryName || 'Musique locale';
  const playerSummarySecondary =
    liveAudioSource === 'radio'
      ? liveRadioCurrentSongLabel || 'Artiste et morceau indisponibles'
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
      const candidateUrls = await prepareStationStreamUrls(selectedLiveRadioStation);
      const audio = await playAudioFromCandidates(candidateUrls, {
        preload: 'none',
      });
      liveRadioAudioRef.current = audio;
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

    stopAlarmPlayback();

    try {
      const selectedTrack = liveDirectoryFiles[trackIndex];
      if (!selectedTrack || !isSupportedLocalAudioFile(selectedTrack)) {
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

      const objectUrl =
        liveDirectoryObjectUrlsRef.current[trackIndex] ??
        URL.createObjectURL(selectedTrack);
      liveDirectoryObjectUrlsRef.current[trackIndex] = objectUrl;
      liveDirectoryTrackIndexRef.current = trackIndex;

      const audio = liveRadioAudioRef.current ?? new Audio();
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.preload = 'auto';

      if (audio.src !== objectUrl) {
        audio.src = objectUrl;
      }
      audio.currentTime = 0;

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
      audio.onerror = () => {
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

    const receivedFiles = Array.from(files ?? []);

    const selectedFiles = receivedFiles
      .filter(isSupportedLocalAudioFile)
      .sort((left, right) => {
        const leftPath =
          'webkitRelativePath' in left && left.webkitRelativePath
            ? left.webkitRelativePath
            : left.name;
        const rightPath =
          'webkitRelativePath' in right && right.webkitRelativePath
            ? right.webkitRelativePath
            : right.name;

        return leftPath.localeCompare(rightPath, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });

    setLiveDirectoryFiles(selectedFiles);
    setLiveDirectoryTrackLabel('');

    if (receivedFiles.length === 0) {
      setLiveDirectorySelectionMessage('Aucun dossier selectionne.');
      pendingLiveAutoplayRef.current = null;
      setLiveDirectoryName('');
      return;
    }

    if (selectedFiles.length === 0) {
      setLiveDirectorySelectionMessage(
        'Dossier charge, mais aucun fichier audio compatible n a ete trouve.',
      );
      pendingLiveAutoplayRef.current = null;
      setLiveDirectoryName('');
      return;
    }

    setLiveDirectorySelectionMessage('');
    pendingLiveAutoplayRef.current = 'directory';
    const firstFile = selectedFiles[0];
    const relativePath =
      'webkitRelativePath' in firstFile ? firstFile.webkitRelativePath : '';
    const [directoryName] = relativePath.split('/');
    setLiveDirectoryName(directoryName || 'Musique disque dur');
  };

  const handleBrowseLiveAudio = () => {
    if (liveAudioSource === 'directory') {
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
    if (liveAudioSource !== 'radio' || !supportsStationCurrentSong(selectedLiveRadioStation)) {
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
  }, [liveAudioSource, selectedLiveRadioStation.id]);

  useEffect(() => {
    return () => {
      clearLiveDirectoryObjectUrls();
    };
  }, []);

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
      <section className={clockLayoutClasses} data-theme-family={themeFamily}>
        <article
          ref={displayStageRef}
          className={`display-stage-card ${
            alarmPlaybackState === 'ringing'
              ? 'display-stage-card--alarm'
              : ''
          }`}
          data-display-id={activeDisplayId}
          onPointerUp={handleDisplayStagePointerUp}
        >
          {alarmPlaybackState === 'ringing' && activeAlarmLabel ? (
            <div className="alarm-overlay-label" role="status" aria-live="assertive">
              {activeAlarmLabel}
            </div>
          ) : null}

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

          {renderActiveDisplay(
            activeDisplay,
            currentTime,
            activeTheme,
            alarms.map((alarm) => alarm.color),
            analogAlarmPreviews,
            showDate,
            use24HourFormat,
          )}
        </article>
      </section>
    </AppShell>
  );
}

export default App;
