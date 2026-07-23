import type { FeatureCollection, Feature, Polygon, LineString, Point } from 'geojson';
import type { DataFieldValue } from './dataFieldCollector';

// ---------------------------------------------------------------------------
// Fake GeoJSON builders
//
// We visualize a style's zoom-level behavior by creating fake features
// arranged horizontally across the full longitude range:
//
//   longitude -180  →  zoom 0
//   longitude +180  →  zoom 22
//
// Each feature carries a "zoom" property equal to its zoom level.
// After paint expressions are rewritten (["zoom"] → ["get", "zoom"]),
// the renderer evaluates the style against this property, showing how
// the layer looks at every zoom level across the bar.
// ---------------------------------------------------------------------------

/** Step size between zoom segments. 0.1 → 220 segments across 0–22. */
const ZOOM_STEP = 0.1;
const ZOOM_MAX = 22;
const SEGMENT_COUNT = Math.round(ZOOM_MAX / ZOOM_STEP); // 220

/**
 * Map a zoom level (0–22) to a longitude, stopping just short of +180
 * rather than reaching it exactly. MapLibre normalizes longitude to
 * [-180, 180) — +180 wraps down to exactly -180 — so a point or segment
 * boundary placed at true +180 renders on top of the zoom-0 one instead of
 * at the right edge. Only ~0.01° short of the true edge, imperceptible at
 * this scale.
 */
function zoomToLon(zoom: number): number {
	return -180 + (zoom / ZOOM_MAX) * 359.99;
}

/**
 * Build fill GeoJSON: 220 vertical rectangle strips spanning the full
 * Mercator latitude extent (-85.05 to +85.05).
 *
 * Using the full latitude range ensures the polygons fill the bar height
 * regardless of the container's aspect ratio.
 *
 * The "zoom" property on each feature drives fill-color after expression
 * rewriting. `dataConfig` adds any user-chosen data field overrides (see
 * DataConfigModal) so match/case expressions in the style evaluate against
 * real values instead of always hitting their fallback branch.
 */
export function buildFillGeoJSON(
	dataConfig: Record<string, DataFieldValue> = {}
): FeatureCollection {
	const features: Feature<Polygon>[] = [];

	for (let i = 0; i < SEGMENT_COUNT; i++) {
		// Round to avoid floating-point noise (e.g. 0.30000000000000004)
		const zoom = parseFloat((i * ZOOM_STEP).toFixed(2));
		const lonA = zoomToLon(zoom);
		const lonB = zoomToLon(zoom + ZOOM_STEP);

		features.push({
			type: 'Feature',
			properties: { zoom, ...dataConfig },
			geometry: {
				type: 'Polygon',
				coordinates: [
					[
						[lonA, -85.05],
						[lonB, -85.05],
						[lonB, 85.05],
						[lonA, 85.05],
						[lonA, -85.05] // GeoJSON rings must be closed
					]
				]
			}
		});
	}

	return { type: 'FeatureCollection', features };
}

/**
 * Build line GeoJSON: 220 short horizontal line segments along the equator.
 *
 * Each segment spans one zoom step in longitude. The "zoom" property drives
 * line-color and line-width after expression rewriting, making the line
 * visually thicker/thinner and change color from left to right as zoom grows.
 * `dataConfig` adds any user-chosen data field overrides (see
 * DataConfigModal) so match/case expressions in the style evaluate against
 * real values instead of always hitting their fallback branch.
 */
export function buildLineGeoJSON(
	dataConfig: Record<string, DataFieldValue> = {}
): FeatureCollection {
	const features: Feature<LineString>[] = [];

	for (let i = 0; i < SEGMENT_COUNT; i++) {
		const zoom = parseFloat((i * ZOOM_STEP).toFixed(2));
		const lonA = zoomToLon(zoom);
		const lonB = zoomToLon(zoom + ZOOM_STEP);

		features.push({
			type: 'Feature',
			properties: { zoom, ...dataConfig },
			geometry: {
				type: 'LineString',
				// A single short segment along latitude 0 (the equator)
				coordinates: [
					[lonA, 0],
					[lonB, 0]
				]
			}
		});
	}

	return { type: 'FeatureCollection', features };
}

/** Step size between symbol samples — every 2 zoom levels (12 points across
 * 0–22), much sparser than fill/line's 220 segments, since labels need real
 * horizontal room or every sample would overlap into an illegible smear. */
const SYMBOL_ZOOM_STEP = 2;

/**
 * Fraction of the bar width reserved as empty margin on each side, for
 * symbols only. Text labels are usually center-anchored, so a label at
 * zoom 0 or 22 (placed exactly at the world edge, like fill/line's content)
 * would have roughly half its width extending past the edge — and
 * MapLibre's symbol placement, observed directly, doesn't just clip that
 * overflow: it can wrap-place the label onto the *opposite* edge instead
 * (the antimeridian-equivalent position), since a label anchored right at
 * the edge is ambiguous between the two. Insetting zoom 0/22 away from the
 * true edges avoids that ambiguity. 0.15 leaves the middle 70% of the bar
 * for content — matches the zoom-ruler tick positions in +page.svelte.
 */
export const SYMBOL_MARGIN_FRACTION = 0.15;

function symbolZoomToLon(zoom: number): number {
	const usableSpan = 359.99 * (1 - 2 * SYMBOL_MARGIN_FRACTION);
	const startLon = -180 + 359.99 * SYMBOL_MARGIN_FRACTION;
	return startLon + (zoom / ZOOM_MAX) * usableSpan;
}

/**
 * Build symbol GeoJSON: one point every 2 zoom levels along the equator,
 * inset from the bar's true edges by SYMBOL_MARGIN_FRACTION (see above).
 *
 * The "zoom" property on each feature drives text-size/icon-size (and
 * anything else zoom-dependent) after expression rewriting. `dataConfig`
 * adds any user-chosen data field overrides, same as fill/line.
 */
export function buildSymbolGeoJSON(
	dataConfig: Record<string, DataFieldValue> = {}
): FeatureCollection {
	const features: Feature<Point>[] = [];

	for (let zoom = 0; zoom <= ZOOM_MAX; zoom += SYMBOL_ZOOM_STEP) {
		features.push({
			type: 'Feature',
			properties: { zoom, ...dataConfig },
			geometry: {
				type: 'Point',
				coordinates: [symbolZoomToLon(zoom), 0]
			}
		});
	}

	return { type: 'FeatureCollection', features };
}
