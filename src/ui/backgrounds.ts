import waves from '../assets/backgrounds/waves.svg?raw';
import mountains from '../assets/backgrounds/mountains.svg?raw';
import dunes from '../assets/backgrounds/dunes.svg?raw';
import forest from '../assets/backgrounds/forest.svg?raw';
import aurora from '../assets/backgrounds/aurora.svg?raw';
import sunset from '../assets/backgrounds/sunset.svg?raw';

const backgrounds = { waves, mountains, dunes, forest, aurora, sunset };

export function homeBackgroundPresetUrl(preset: string = 'waves'): string {
  const svg = backgrounds[preset as keyof typeof backgrounds] ?? waves;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
