import { useEffect, useState } from 'react';
import type { ClockDisplayDefinition } from '../../../types/clock';

type FlipClockCardProps = {
  currentTime: Date;
  display: ClockDisplayDefinition;
  showDate?: boolean;
  alarmColors?: string[];
  use24HourFormat?: boolean;
};

type FlipDigitTileProps = {
  value: string;
};

function AlarmBell({ color }: { color: string }) {
  return (
    <svg
      className="flip-alarm-bell"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ color }}
    >
      <path
        fill="currentColor"
        d="M12 3a4 4 0 0 0-4 4v1.14a7 7 0 0 1-1.64 4.49L4.7 14.6a1 1 0 0 0 .76 1.65h13.08a1 1 0 0 0 .76-1.65l-1.66-1.97A7 7 0 0 1 16 8.14V7a4 4 0 0 0-4-4m0 19a3 3 0 0 0 2.82-2H9.18A3 3 0 0 0 12 22"
      />
    </svg>
  );
}

function FlipDigitTile({ value }: FlipDigitTileProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [nextValue, setNextValue] = useState(value);
  const [flipPhase, setFlipPhase] = useState<'idle' | 'top' | 'bottom'>('idle');

  useEffect(() => {
    if (value === displayValue) {
      return;
    }

    setNextValue(value);
    setFlipPhase('top');

    const halfwayTimeoutId = window.setTimeout(() => {
      setDisplayValue(value);
      setFlipPhase('bottom');
    }, 260);

    const completeTimeoutId = window.setTimeout(() => {
      setDisplayValue(value);
      setFlipPhase('idle');
    }, 520);

    return () => {
      window.clearTimeout(halfwayTimeoutId);
      window.clearTimeout(completeTimeoutId);
    };
  }, [value, displayValue]);

  return (
    <div className={`flip-tile flip-phase-${flipPhase}`}>
      <div className="flip-half top">
        <span className="flip-texture" />
        <span className="flip-static-digit">{displayValue}</span>
      </div>
      <div className="flip-half bottom">
        <span className="flip-texture" />
        <span className="flip-static-digit">{displayValue}</span>
      </div>
      <div className="flip-divider">
        <span className="flip-pin left" />
        <span className="flip-pin right" />
      </div>
      <div className="flip-flap flip-flap-top">
        <span className="flip-texture" />
        <span className="flip-animated-digit">{displayValue}</span>
        <span className="flip-shadow flip-shadow-top" />
      </div>
      <div className="flip-flap flip-flap-bottom">
        <span className="flip-texture" />
        <span className="flip-animated-digit">{nextValue}</span>
        <span className="flip-shadow flip-shadow-bottom" />
      </div>
    </div>
  );
}

export function FlipClockCard({
  currentTime,
  display,
  showDate = false,
  alarmColors = [],
  use24HourFormat = true,
}: FlipClockCardProps) {
  const timeParts = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24HourFormat,
  }).formatToParts(currentTime);
  const hours = timeParts.find((part) => part.type === 'hour')?.value ?? '00';
  const minutes = timeParts.find((part) => part.type === 'minute')?.value ?? '00';
  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(currentTime);
  const [day, month, year] = dateLabel.split('/');

  return (
    <>
      <div className="card-copy">
        <p className="card-tag">{display.renderer}</p>
        <h3>{display.name}</h3>
        <p>{display.summary}</p>
      </div>
      <div className="flip-preview" aria-hidden="true">
        <div className="flip-stage-cluster">
          <div className="flip-time-row">
            <div className="flip-group">
              {hours.split('').map((char, index) => (
                <FlipDigitTile key={`hours-${index}`} value={char} />
              ))}
            </div>

            <div className="flip-separator">
              <span />
              <span />
            </div>

            <div className="flip-group">
              {minutes.split('').map((char, index) => (
                <FlipDigitTile key={`minutes-${index}`} value={char} />
              ))}
            </div>
          </div>
          {alarmColors.length > 0 ? (
            <div className="flip-alarm-bells">
              {alarmColors.map((color, index) => (
                <AlarmBell key={`${color}-${index}`} color={color} />
              ))}
            </div>
          ) : null}
        </div>
        {showDate ? (
          <div className="flip-date-row">
            <div className="flip-date-group">
              {day?.split('').map((char, index) => (
                <FlipDigitTile key={`day-${index}`} value={char} />
              ))}
            </div>
            <div className="flip-date-separator" aria-hidden="true">
              /
            </div>
            <div className="flip-date-group">
              {month?.split('').map((char, index) => (
                <FlipDigitTile key={`month-${index}`} value={char} />
              ))}
            </div>
            <div className="flip-date-separator" aria-hidden="true">
              /
            </div>
            <div className="flip-date-group">
              {year?.split('').map((char, index) => (
                <FlipDigitTile key={`year-${index}`} value={char} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
