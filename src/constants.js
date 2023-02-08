export let MIN_ZOOM = 0;
export let MAX_ZOOM = 24;
export let CHART_WIDTH = 1000;
export let MARGIN = {
  bottom: 25,
  left: 250,
  right: 50,
  top: 25,
};
export const DISPLAY_CHUNK_SIZE = 100;
export const renderers = [
  {
    name: 'Mapbox GL',
    value: 'mapbox-gl',
  },
  {
    name: 'Maplibre GL',
    value: 'maplibre-gl',
  },
];
