// ---------------------------------------------------------------------------
// A module-level cache from a render job's content to its already-rendered
// data URL. Module-level state survives page navigation (SvelteKit destroys
// and recreates the fills/lines page components, and with them their
// RenderQueue and LayerBar instances) — so switching pages and back can
// reuse the last render instead of redoing the WebGL work, as long as the
// style and data config haven't changed.
//
// The cache is intentionally content-keyed (paint/layout/geojson/dimensions)
// rather than tied to a layer id — two layers that happen to render
// pixel-identically should share one entry.
// ---------------------------------------------------------------------------

interface CacheableJob {
	layerType: 'fill' | 'line';
	paint: Record<string, unknown>;
	layout: Record<string, unknown>;
	geojson: unknown;
	width: number;
	height: number;
}

const cache = new Map<string, string>();

/** Recursively sorts object keys so structurally-identical values with
 * differently-ordered keys (e.g. data config fields applied in a different
 * order across visits) still hash to the same string. Array order is left
 * untouched — order is meaningful there (geojson features, expressions). */
function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value !== null && typeof value === 'object') {
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
		}
		return sorted;
	}
	return value;
}

export function renderCacheKey(job: CacheableJob): string {
	return JSON.stringify(canonicalize(job));
}

export function getCachedRender(key: string): string | undefined {
	return cache.get(key);
}

export function setCachedRender(key: string, dataUrl: string): void {
	cache.set(key, dataUrl);
}
