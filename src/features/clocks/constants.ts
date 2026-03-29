import type { ClockDisplayDefinition } from '../../types/clock';

export const DISPLAY_MODES: ClockDisplayDefinition[] = [
  {
    id: 'analog',
    name: 'Analogique',
    summary: 'Horloge ronde inspirée des cadrans classiques.',
    shape: 'round',
    renderer: 'three',
  },
  {
    id: 'seven-segment',
    name: 'Seven Segment',
    summary: 'Affichage rectangulaire numerique type afficheur LED.',
    shape: 'rectangle',
    renderer: 'react',
  },
  {
    id: 'flip',
    name: 'A Lamelles',
    summary: 'Affichage rectangulaire mecanique type flip clock.',
    shape: 'rectangle',
    renderer: 'react',
  },
];
