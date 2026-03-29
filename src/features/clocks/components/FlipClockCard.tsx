import { useEffect, useState } from 'react';
import type { ClockDisplayDefinition } from '../../../types/clock';

type FlipClockCardProps = {
  currentTime: Date;
  display: ClockDisplayDefinition;
};

type FlipDigitTileProps = {
  value: string;
};

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

export function FlipClockCard({ currentTime, display }: FlipClockCardProps) {
  const [hours, minutes] = currentTime
    .toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .split(':');

  return (
    <>
      <div className="card-copy">
        <p className="card-tag">{display.renderer}</p>
        <h3>{display.name}</h3>
        <p>{display.summary}</p>
      </div>
      <div className="flip-preview" aria-hidden="true">
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
    </>
  );
}
