import type { FeatureCollection, Feature, Polygon, LineString } from 'geojson';

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

/** Map a zoom level (0–22) to a longitude (-180 to +180). */
function zoomToLon(zoom: number): number {
	return -180 + (zoom / ZOOM_MAX) * 360;
}

/**
 * Build fill GeoJSON: 220 vertical rectangle strips spanning the full
 * Mercator latitude extent (-85.05 to +85.05).
 *
 * Using the full latitude range ensures the polygons fill the bar height
 * regardless of the container's aspect ratio.
 *
 * The "zoom" property on each feature drives fill-color after expression
 * rewriting.
 */
export function buildFillGeoJSON(): FeatureCollection {
	const features: Feature<Polygon>[] = [];

	for (let i = 0; i < SEGMENT_COUNT; i++) {
		// Round to avoid floating-point noise (e.g. 0.30000000000000004)
		const zoom = parseFloat((i * ZOOM_STEP).toFixed(2));
		const lonA = zoomToLon(zoom);
		const lonB = zoomToLon(zoom + ZOOM_STEP);

		features.push({
			type: 'Feature',
			properties: { zoom },
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
 */
export function buildLineGeoJSON(): FeatureCollection {
	const features: Feature<LineString>[] = [];

	for (let i = 0; i < SEGMENT_COUNT; i++) {
		const zoom = parseFloat((i * ZOOM_STEP).toFixed(2));
		const lonA = zoomToLon(zoom);
		const lonB = zoomToLon(zoom + ZOOM_STEP);

		features.push({
			type: 'Feature',
			properties: { zoom },
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
