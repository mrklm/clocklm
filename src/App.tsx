import { useMemo, useState, type CSSProperties } from 'react';
import { AppShell } from './components/AppShell';
import { AnalogClockCard } from './features/clocks/components/AnalogClockCard';
import { FlipClockCard } from './features/clocks/components/FlipClockCard';
import { SevenSegmentClockCard } from './features/clocks/components/SevenSegmentClockCard';
import { DISPLAY_MODES } from './features/clocks/constants';
import { useSystemTime } from './features/clocks/hooks/useSystemTime';
import { DEFAULT_THEME_NAME, THEMES } from './themes/themes';
import type { ClockDisplayDefinition, ClockDisplayId } from './types/clock';
import type { ThemePalette } from './types/theme';
import './styles/app.css';

function renderActiveDisplay(
  display: ClockDisplayDefinition,
  currentTime: Date,
  theme: ThemePalette,
) {
  switch (display.id) {
    case 'analog':
      return (
        <AnalogClockCard
          currentTime={currentTime}
          display={display}
          theme={theme}
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

function App() {
  const [activeDisplayId, setActiveDisplayId] = useState<ClockDisplayId>('analog');
  const [activeThemeName, setActiveThemeName] = useState(DEFAULT_THEME_NAME);
  const currentTime = useSystemTime();

  const activeDisplay = useMemo(
    () =>
      DISPLAY_MODES.find((display) => display.id === activeDisplayId) ??
      DISPLAY_MODES[0],
    [activeDisplayId],
  );
  const activeTheme = THEMES[activeThemeName] ?? THEMES[DEFAULT_THEME_NAME];
  const themeFamily = getThemeFamily(activeThemeName);
  const themeStyle = {
    '--theme-bg': activeTheme.BG,
    '--theme-panel': activeTheme.PANEL,
    '--theme-field': activeTheme.FIELD,
    '--theme-fg': activeTheme.FG,
    '--theme-field-fg': activeTheme.FIELD_FG,
    '--theme-accent': activeTheme.ACCENT,
  } as CSSProperties;

  return (
    <AppShell style={themeStyle}>
      <section className="clock-layout" data-theme-family={themeFamily}>
        <article className="display-stage-card">
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
              </div>
            </details>
          </div>

          {renderActiveDisplay(activeDisplay, currentTime, activeTheme)}
        </article>
      </section>
    </AppShell>
  );
}

export default App;
