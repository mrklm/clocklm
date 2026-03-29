export type ClockDisplayId = 'analog' | 'seven-segment' | 'flip';

export type ClockShape = 'round' | 'rectangle';

export type ClockRenderer = 'react' | 'three';

export type ClockDisplayDefinition = {
  id: ClockDisplayId;
  name: string;
  summary: string;
  shape: ClockShape;
  renderer: ClockRenderer;
};
