import type {
	StyleSpecification,
	FillLayerSpecification,
	LineLayerSpecification
} from 'maplibre-gl';
import { rewritePaint } from './expressionRewriter';

// ---------------------------------------------------------------------------
// Style parser
//
// Extracts fill and line layers from a loaded Mapbox/Maplibre style and
// transforms them for our zoom-level visualization.
//
// Transformations applied to every layer:
//
//   1. Strip `source` and `source-layer` — we substitute our own fake
//      GeoJSON source in LayerBar; the original tile source is irrelevant.
//
//   2. Strip `filter` — filters reference feature properties (like "class")
//      that don't exist on our fake features, so they'd hide everything.
//
//   3. Strip `minzoom` / `maxzoom` — we want to see the full paint expression
//      across the 0–22 range regardless of the layer's visibility limits.
//
//   4. Rewrite zoom expressions in `paint` — replaces ["zoom"] with
//      ["get", "zoom"] so the renderer reads the feature's "zoom" property
//      instead of the camera zoom (see expressionRewriter.ts).
//
//   5. Separate layout properties — line-cap, line-join, etc. are LAYOUT
//      properties in MapLibre, not paint properties. Putting them in the
//      wrong block causes MapLibre to silently ignore them.
// ---------------------------------------------------------------------------

export interface VisFillLayer {
	id: string;
	paint: Record<string, unknown>;
	layout: Record<string, unknown>;
	// Present when the layer has fill-outline-color. Remapped as fill-color
	// so a thin overlay bar can display it without polluting the main bar's
	// polygon edge rendering.
	outlinePaint: Record<string, unknown> | null;
}

export interface VisLineLayer {
	id: string;
	paint: Record<string, unknown>;
	layout: Record<string, unknown>;
}

export function extractFillLayers(style: StyleSpecification): VisFillLayer[] {
	return style.layers
		.filter((l): l is FillLayerSpecification => l.type === 'fill')
		.map((layer) => {
			const paint = rewritePaint((layer.paint ?? {}) as Record<string, never>);

			// Pull fill-outline-color out of the main paint before rendering.
			// Left in place, MapLibre draws it on every polygon edge — with 220
			// strips side by side that creates 220 visible seam lines. Instead we
			// remap it as fill-color in a separate thin overlay bar so it's shown
			// once, cleanly, at the bottom of the fill bar.
			const outlineColorExpr = paint['fill-outline-color'] ?? null;
			delete paint['fill-outline-color'];

			return {
				id: layer.id,
				paint,
				layout: {},
				outlinePaint: outlineColorExpr ? { 'fill-color': outlineColorExpr } : null
			};
		});
}

export function extractLineLayers(style: StyleSpecification): VisLineLayer[] {
	return style.layers
		.filter((l): l is LineLayerSpecification => l.type === 'line')
		.map((layer) => ({
			id: layer.id,
			paint: rewritePaint((layer.paint ?? {}) as Record<string, never>),
			// line-cap and line-join are LAYOUT properties (not paint).
			// "butt" caps prevent adjacent segments from visually overlapping
			// at high line-width values. "miter" join keeps segments flush.
			layout: {
				'line-cap': 'butt',
				'line-join': 'miter'
			}
		}));
}

/**
 * Extracts the style's background layer paint (if any), rewritten the same
 * way as every other layer, and remapped to fill-color/fill-opacity so it
 * can be drawn as a real fill layer over real geometry — see renderer.ts for
 * why that's necessary (MapLibre's background layer type is sourceless, so
 * it can't vary across our synthetic zoom segments the way every other
 * layer does). background-pattern is ignored — patterns need a sprite atlas
 * we don't load. Falls back to `fallbackColor` when the style has no
 * background layer, or the layer doesn't set a color.
 */
export function extractBackgroundPaint(
	style: StyleSpecification,
	fallbackColor: string
): Record<string, unknown> {
	const bgLayer = style.layers.find((l) => l.type === 'background') as
		| { paint?: Record<string, never> }
		| undefined;

	if (!bgLayer?.paint) return { 'fill-color': fallbackColor };

	const rewritten = rewritePaint(bgLayer.paint);
	const paint: Record<string, unknown> = {
		'fill-color': rewritten['background-color'] ?? fallbackColor
	};
	if ('background-opacity' in rewritten) {
		paint['fill-opacity'] = rewritten['background-opacity'];
	}
	return paint;
}
