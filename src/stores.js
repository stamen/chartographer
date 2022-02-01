import { writable } from 'svelte/store';

// Store the background layer from fill tab so we don't need to calculate again
export const backgroundSvgData = writable({});