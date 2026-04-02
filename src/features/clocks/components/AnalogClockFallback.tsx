import type { CSSProperties } from 'react';
import type { ThemePalette } from '../../../types/theme';

type AnalogClockFallbackProps = {
  currentTime: Date;
  theme: ThemePalette;
  alarmPreviews?: Array<{
    time: string;
    color: string;
  }>;
  showDate?: boolean;
};

function formatDateLabel(currentTime: Date) {
  const capitalizeWords = (value: string) =>
    value
      .split(/\s+/)
      .map((word) =>
        word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word,
      )
      .join(' ');

  return [
    capitalizeWords(currentTime.toLocaleDateString('fr-FR', { weekday: 'long' })),
    currentTime.toLocaleDateString('fr-FR', { day: 'numeric' }),
    capitalizeWords(currentTime.toLocaleDateString('fr-FR', { month: 'long' })),
  ];
}

function getClockProgress(currentTime: Date) {
  const hours = currentTime.getHours() % 12;
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();
  const milliseconds = currentTime.getMilliseconds();

  const secondsProgress = (seconds + milliseconds / 1000) / 60;
  const minutesProgress = (minutes + secondsProgress) / 60;
  const hoursProgress = (hours + minutesProgress) / 12;

  return { hoursProgress, minutesProgress, secondsProgress };
}

function getAlarmPreviewDate(alarmTime: string) {
  const [hoursText = '0', minutesText = '0'] = alarmTime.split(':');
  const previewDate = new Date();
  previewDate.setHours(Number(hoursText) || 0, Number(minutesText) || 0, 0, 0);
  return previewDate;
}

function polarToCartesian(angleTurn: number, radius: number) {
  const angle = angleTurn * Math.PI * 2 - Math.PI / 2;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius,
  };
}

function getHandLine(turn: number, length: number) {
  const end = polarToCartesian(turn, length);
  return { x1: 50, y1: 50, x2: end.x, y2: end.y };
}

const LABELS = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

export function AnalogClockFallback({
  currentTime,
  theme,
  alarmPreviews = [],
  showDate = false,
}: AnalogClockFallbackProps) {
  const { hoursProgress, minutesProgress, secondsProgress } = getClockProgress(currentTime);
  const dateLines = formatDateLabel(currentTime);

  return (
    <div
      className="three-preview three-preview--fallback analog-fallback"
      style={
        {
          '--analog-fallback-bg': theme.BG,
          '--analog-fallback-panel': theme.PANEL,
          '--analog-fallback-fg': theme.FG,
          '--analog-fallback-accent': theme.ACCENT,
        } as CSSProperties
      }
    >
      <div className="analog-fallback__stage" aria-label="Horloge analogique de secours">
        <svg
          className="analog-fallback__svg"
          viewBox="0 0 100 100"
          role="img"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="analog-fallback-face" cx="50%" cy="35%" r="70%">
              <stop offset="0%" stopColor="color-mix(in srgb, var(--analog-fallback-panel) 60%, white 10%)" />
              <stop offset="100%" stopColor="var(--analog-fallback-bg)" />
            </radialGradient>
          </defs>

          <circle cx="50" cy="50" r="47.8" className="analog-fallback__rim" />
          <circle cx="50" cy="50" r="44.5" className="analog-fallback__face" />

          {Array.from({ length: 60 }, (_, index) => {
            const isHourMarker = index % 5 === 0;
            const outer = polarToCartesian(index / 60, 40.5);
            const inner = polarToCartesian(index / 60, isHourMarker ? 34.5 : 36.9);

            return (
              <line
                key={`marker-${index}`}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                className={isHourMarker ? 'analog-fallback__marker analog-fallback__marker--hour' : 'analog-fallback__marker'}
              />
            );
          })}

          {LABELS.map((label, index) => {
            const point = polarToCartesian(index / 12, 29.5);

            return (
              <text
                key={label}
                x={point.x}
                y={point.y}
                className="analog-fallback__label"
                dominantBaseline="middle"
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}

          {showDate ? (
            <>
              <rect x="33" y="18" width="34" height="16" rx="4" className="analog-fallback__date-box" />
              <text x="50" y="22.8" className="analog-fallback__date-line analog-fallback__date-line--small" textAnchor="middle">
                {dateLines[0]}
              </text>
              <text x="50" y="28.3" className="analog-fallback__date-line analog-fallback__date-line--large" textAnchor="middle">
                {dateLines[1]}
              </text>
              <text x="50" y="32.7" className="analog-fallback__date-line analog-fallback__date-line--small" textAnchor="middle">
                {dateLines[2]}
              </text>
            </>
          ) : null}

          <line {...getHandLine(hoursProgress, 21)} className="analog-fallback__hand analog-fallback__hand--hour" />
          <line {...getHandLine(minutesProgress, 31)} className="analog-fallback__hand analog-fallback__hand--minute" />
          <line {...getHandLine(secondsProgress, 34)} className="analog-fallback__hand analog-fallback__hand--second" />

          <circle cx="50" cy="50" r="2.2" className="analog-fallback__center-ring" />
          <circle cx="50" cy="50" r="1.15" className="analog-fallback__center-dot" />

          {alarmPreviews.map((alarmPreview, index) => {
            const previewDate = getAlarmPreviewDate(alarmPreview.time);
            const miniMinutesProgress = previewDate.getMinutes() / 60;
            const miniHoursProgress = ((previewDate.getHours() % 12) + miniMinutesProgress) / 12;
            const angleTurn = alarmPreviews.length <= 1 ? 0.75 : index / alarmPreviews.length;
            const center = polarToCartesian(angleTurn, 35.5);
            const miniHourHand = getHandLine(miniHoursProgress, 3.2);
            const miniMinuteHand = getHandLine(miniMinutesProgress, 4.7);

            return (
              <g key={`${alarmPreview.time}-${index}`} transform={`translate(${center.x - 50} ${center.y - 50})`}>
                <circle cx="50" cy="50" r="5.6" className="analog-fallback__mini-ring" />
                <circle cx="50" cy="50" r="5" className="analog-fallback__mini-face" />
                <line
                  x1={miniHourHand.x1}
                  y1={miniHourHand.y1}
                  x2={miniHourHand.x2}
                  y2={miniHourHand.y2}
                  className="analog-fallback__mini-hand"
                  style={{ '--analog-fallback-mini-accent': alarmPreview.color || theme.ACCENT } as CSSProperties}
                />
                <line
                  x1={miniMinuteHand.x1}
                  y1={miniMinuteHand.y1}
                  x2={miniMinuteHand.x2}
                  y2={miniMinuteHand.y2}
                  className="analog-fallback__mini-hand"
                  style={{ '--analog-fallback-mini-accent': alarmPreview.color || theme.ACCENT } as CSSProperties}
                />
                <circle
                  cx="50"
                  cy="50"
                  r="0.7"
                  className="analog-fallback__mini-center"
                  style={{ '--analog-fallback-mini-accent': alarmPreview.color || theme.ACCENT } as CSSProperties}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
