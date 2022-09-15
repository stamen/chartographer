import { writable } from 'svelte/store';

export const propertyValueComboLimitStore = writable(10);

export const loadingStore = writable({ loading: false, progress: null });

export const displayLayersStore = writable({
  style: null,
  layers: [],
  limitHit: []
});
