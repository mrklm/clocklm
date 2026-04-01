import type { ClockDisplayDefinition } from '../../../types/clock';
import { digitsToSegments } from '../utils/digitsToSegments';

type SevenSegmentClockCardProps = {
  currentTime: Date;
  display: ClockDisplayDefinition;
  alarmColors?: string[];
  showDate?: boolean;
};

const segmentShapes = [
  '22,10 32,2 88,2 98,10 88,18 32,18',
  '100,14 108,24 108,82 100,92 92,82 92,24',
  '100,108 108,118 108,176 100,186 92,176 92,118',
  '22,190 32,182 88,182 98,190 88,198 32,198',
  '10,108 18,118 18,176 10,186 2,176 2,118',
  '10,14 18,24 18,82 10,92 2,82 2,24',
  '22,100 32,92 88,92 98,100 88,108 32,108',
] as const;

function SegmentDigit({ digit }: { digit: string }) {
  const segments = digitsToSegments(digit);

  return (
    <div className="segment-digit">
      <svg
        className="segment-digit-svg"
        viewBox="0 0 110 200"
        aria-hidden="true"
      >
        {segmentShapes.map((points, index) => (
          <polygon
            key={index}
            points={points}
            className={`segment-shape ${segments[index] ? 'on' : ''}`}
          />
        ))}
      </svg>
    </div>
  );
}

function SegmentSequence({
  chars,
  className = '',
}: {
  chars: string[];
  className?: string;
}) {
  return (
    <div className={`segment-row ${className}`.trim()}>
      {chars.map((char, index) =>
        char === ':' ? (
          <div key={`${char}-${index}`} className="segment-colon-wrap">
            <div className="segment-colon">
              <span />
              <span />
            </div>
          </div>
        ) : (
          <SegmentDigit key={`${char}-${index}`} digit={char} />
        ),
      )}
    </div>
  );
}

function AlarmBell({ color }: { color: string }) {
  return (
    <svg
      className="segment-alarm-bell"
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

export function SevenSegmentClockCard({
  currentTime,
  display,
  alarmColors = [],
  showDate = false,
}: SevenSegmentClockCardProps) {
  const timeDigits = currentTime
    .toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .split('');
  const dateParts = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(currentTime);
  const dateDigits = dateParts
    .filter((part) => part.type === 'day' || part.type === 'month' || part.type === 'year')
    .flatMap((part, index, parts) => [
      ...part.value.split(''),
      ...(index < parts.length - 1 ? ['-'] : []),
    ]);

  return (
    <>
      <div className="card-copy">
        <p className="card-tag">{display.renderer}</p>
        <h3>{display.name}</h3>
        <p>{display.summary}</p>
      </div>
      <div className="segment-preview" aria-hidden="true">
        <div className="segment-time-cluster">
          <SegmentSequence chars={timeDigits} className="segment-row--time" />
          {alarmColors.length > 0 ? (
            <div className="segment-alarm-bells">
              {alarmColors.map((color, index) => (
                <AlarmBell key={`${color}-${index}`} color={color} />
              ))}
            </div>
          ) : null}
        </div>
        {showDate ? (
          <SegmentSequence chars={dateDigits} className="segment-row--date" />
        ) : null}
      </div>
    </>
  );
}
