import type { ClockDisplayDefinition } from '../../../types/clock';
import type { ThemePalette } from '../../../types/theme';
import { ThreeClockPreview } from '../../../three/ThreeClockPreview';

type AnalogClockCardProps = {
  currentTime: Date;
  display: ClockDisplayDefinition;
  theme: ThemePalette;
  alarmTime: string;
  alarmEnabled: boolean;
};

export function AnalogClockCard({
  currentTime,
  display,
  theme,
  alarmTime,
  alarmEnabled,
}: AnalogClockCardProps) {
  return (
    <>
      <div className="card-copy">
        <p className="card-tag">{display.renderer}</p>
        <h3>{display.name}</h3>
        <p>{display.summary}</p>
      </div>
      <ThreeClockPreview
        currentTime={currentTime}
        theme={theme}
        alarmTime={alarmTime}
        alarmEnabled={alarmEnabled}
      />
    </>
  );
}
