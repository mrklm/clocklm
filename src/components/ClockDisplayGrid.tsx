import type { ClockDisplayDefinition } from '../types/clock';
import { AnalogClockCard } from '../features/clocks/components/AnalogClockCard';
import { FlipClockCard } from '../features/clocks/components/FlipClockCard';
import { SevenSegmentClockCard } from '../features/clocks/components/SevenSegmentClockCard';
import { useSystemTime } from '../features/clocks/hooks/useSystemTime';
import { DEFAULT_THEME_NAME, THEMES } from '../themes/themes';

type ClockDisplayGridProps = {
  displays: ClockDisplayDefinition[];
};

function renderClockCard(
  display: ClockDisplayDefinition,
  currentTime: Date,
  theme: (typeof THEMES)[keyof typeof THEMES],
) {
  switch (display.id) {
    case 'analog':
      return <AnalogClockCard currentTime={currentTime} display={display} theme={theme} />;
    case 'seven-segment':
      return <SevenSegmentClockCard currentTime={currentTime} display={display} />;
    case 'flip':
      return <FlipClockCard currentTime={currentTime} display={display} />;
    default:
      return null;
  }
}

export function ClockDisplayGrid({ displays }: ClockDisplayGridProps) {
  const currentTime = useSystemTime();
  const theme = THEMES[DEFAULT_THEME_NAME];

  return (
    <section className="clock-grid" aria-label="Modes d'affichage">
      {displays.map((display) => (
        <article key={display.id} className="clock-card">
          {renderClockCard(display, currentTime, theme)}
        </article>
      ))}
    </section>
  );
}
