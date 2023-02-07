import { writable } from 'svelte/store';

export const styleStore = writable(null);

export const propertyValueComboLimitStore = writable(10);

export const loadingStore = writable({ loading: false, progress: null });

export const displayLayersStoreInitialState = {
  style: null,
  layers: [],
  limitHit: [],
};
export const displayLayersStore = writable(displayLayersStoreInitialState);

export const svgStoreInitialState = {
  fills: {
    background: null,
    svgs: [],
    gradients: [],
    chartHeight: null,
    yScale: null,
    adjustedYScale: null,
  },
  lines: {
    background: null,
    svgs: [],
    gradients: [],
    chartHeight: null,
    yScale: null,
    adjustedYScale: null,
  },
};
export const svgStore = writable(svgStoreInitialState);

export let rendererStore = writable('mapbox-gl');
