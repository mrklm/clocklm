import type { ClockDisplayDefinition } from '../../../types/clock';
import { digitsToSegments } from '../utils/digitsToSegments';

type SevenSegmentClockCardProps = {
  currentTime: Date;
  display: ClockDisplayDefinition;
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

export function SevenSegmentClockCard({
  currentTime,
  display,
}: SevenSegmentClockCardProps) {
  const timeDigits = currentTime
    .toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .split('');

  return (
    <>
      <div className="card-copy">
        <p className="card-tag">{display.renderer}</p>
        <h3>{display.name}</h3>
        <p>{display.summary}</p>
      </div>
      <div className="segment-preview" aria-hidden="true">
        {timeDigits.map((digit, index) => (
          digit === ':' ? (
            <div key={`${digit}-${index}`} className="segment-colon-wrap">
              <div className="segment-colon">
                <span />
                <span />
              </div>
            </div>
          ) : (
            <SegmentDigit key={`${digit}-${index}`} digit={digit} />
          )
        ))}
      </div>
    </>
  );
}
