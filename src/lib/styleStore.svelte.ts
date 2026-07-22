import { migrate } from '@maplibre/maplibre-gl-style-spec';
import type { StyleSpecification } from 'maplibre-gl';

// ---------------------------------------------------------------------------
// Global reactive state for the currently loaded Mapbox / Maplibre style.
//
// Svelte 5 rune-based state in a .svelte.ts module is shared across all
// components that import it — mutations trigger reactive updates everywhere.
// ---------------------------------------------------------------------------

class StyleStore {
	/** The parsed style object, or null when nothing has been loaded yet. */
	current = $state<StyleSpecification | null>(null);

	/** Parse and store a style from a raw JSON string (e.g. from a dropped file). */
	loadFromJSON(json: string) {
		const raw = JSON.parse(json) as StyleSpecification;

		// Run the style through the MapLibre migrator before storing it.
		// Many real-world styles (especially older Mapbox ones) still use the
		// legacy "function" syntax — { base, stops } objects — instead of the
		// modern expression syntax. Our expression rewriter only understands
		// arrays, so it silently passes legacy functions through without
		// rewriting the zoom references.
		//
		// migrate() converts every { base, stops } function to the equivalent
		// ["interpolate", ["zoom"], ...] expression, giving our rewriter a
		// consistent tree to walk regardless of how old the source style is.
		this.current = migrate(raw) as StyleSpecification;
	}

	/** Discard the currently loaded style and return to the drop-zone screen. */
	clear() {
		this.current = null;
	}
}

export const styleStore = new StyleStore();
