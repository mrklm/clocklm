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

function getTurnRotation(turnFraction: number) {
  return `rotate(${turnFraction}turn)`;
}

function formatDateLabel(currentTime: Date) {
  const capitalizeWords = (value: string) =>
    value
      .split(/\s+/)
      .map((word) =>
        word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word,
      )
      .join(' ');

  const weekday = capitalizeWords(
    currentTime.toLocaleDateString('fr-FR', { weekday: 'long' }),
  );
  const day = currentTime.toLocaleDateString('fr-FR', { day: 'numeric' });
  const month = capitalizeWords(
    currentTime.toLocaleDateString('fr-FR', { month: 'long' }),
  );

  return [weekday, day, month];
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
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const previewDate = new Date();

  previewDate.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );

  return previewDate;
}

function getMiniClockPosition(index: number, total: number) {
  if (total <= 1) {
    return { x: 50, y: 18 };
  }

  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  return {
    x: 50 + Math.cos(angle) * 36,
    y: 50 + Math.sin(angle) * 36,
  };
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
        <div className="analog-fallback__clock">
          <div className="analog-fallback__face" />

          <div className="analog-fallback__markers" aria-hidden="true">
            {Array.from({ length: 60 }, (_, index) => (
              <span
                key={`marker-${index}`}
                className={`analog-fallback__marker${index % 5 === 0 ? ' analog-fallback__marker--hour' : ''}`}
                style={{ transform: getTurnRotation(index / 60) }}
              />
            ))}
          </div>

          <div className="analog-fallback__labels" aria-hidden="true">
            {LABELS.map((label, index) => (
              <span
                key={label}
                className="analog-fallback__label"
                style={{ transform: getTurnRotation(index / 12) }}
              >
                <span style={{ transform: getTurnRotation(-(index / 12)) }}>{label}</span>
              </span>
            ))}
          </div>

          {showDate ? (
            <div className="analog-fallback__date">
              {dateLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          ) : null}

          <div
            className="analog-fallback__hand analog-fallback__hand--hour"
            style={{ transform: getTurnRotation(hoursProgress) }}
          />
          <div
            className="analog-fallback__hand analog-fallback__hand--minute"
            style={{ transform: getTurnRotation(minutesProgress) }}
          />
          <div
            className="analog-fallback__hand analog-fallback__hand--second"
            style={{ transform: getTurnRotation(secondsProgress) }}
          />
          <div className="analog-fallback__center" />

          {alarmPreviews.map((alarmPreview, index) => {
            const previewDate = getAlarmPreviewDate(alarmPreview.time);
            const miniHours = previewDate.getHours() % 12;
            const miniMinutes = previewDate.getMinutes();
            const miniMinutesProgress = miniMinutes / 60;
            const miniHoursProgress = (miniHours + miniMinutesProgress) / 12;
            const position = getMiniClockPosition(index, alarmPreviews.length);

            return (
              <div
                key={`${alarmPreview.time}-${index}`}
                className="analog-fallback__mini"
                style={
                  {
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    '--analog-fallback-mini-accent': alarmPreview.color || theme.ACCENT,
                  } as CSSProperties
                }
                aria-label={`Alarme ${alarmPreview.time}`}
              >
                <div
                  className="analog-fallback__mini-hand analog-fallback__mini-hand--hour"
                  style={{ transform: getTurnRotation(miniHoursProgress) }}
                />
                <div
                  className="analog-fallback__mini-hand analog-fallback__mini-hand--minute"
                  style={{ transform: getTurnRotation(miniMinutesProgress) }}
                />
                <span className="analog-fallback__mini-center" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
