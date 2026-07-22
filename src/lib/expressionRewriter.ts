// ---------------------------------------------------------------------------
// Expression rewriter: replaces every ["zoom"] node in a MapLibre
// paint/layout expression tree with ["get", "zoom"].
//
// Why:
//   In a real map render, ["zoom"] returns the camera's current zoom level.
//   We replace it with ["get", "zoom"] so it instead reads a "zoom" property
//   from each GeoJSON feature. Our fake features each carry a "zoom" value
//   representing the zoom level they visually stand for, so the renderer
//   evaluates the expression as if the map were at that zoom — giving us the
//   correct color/width at every point along the horizontal bar.
//
// Example transform:
//   ["interpolate", ["linear"], ["zoom"], 5, "#ff0000", 10, "#0000ff"]
//              becomes →
//   ["interpolate", ["linear"], ["get", "zoom"], 5, "#ff0000", 10, "#0000ff"]
//
// Both forms are valid MapLibre expressions. The second is data-driven, so it
// can appear anywhere in the expression tree (unlike the camera-only ["zoom"]).
// ---------------------------------------------------------------------------

/** Any node that can appear in a MapLibre expression tree. */
type ExprNode = string | number | boolean | null | ExprNode[];

/**
 * Walk an expression tree and replace every ["zoom"] leaf with ["get", "zoom"].
 * Returns the original value unchanged when there are no ["zoom"] nodes.
 */
export function rewriteZoom(expr: ExprNode): ExprNode {
	// Primitives have no nested structure — return as-is.
	if (!Array.isArray(expr)) return expr;

	// ["zoom"] is the one-element zoom camera expression; swap it out.
	if (expr.length === 1 && expr[0] === 'zoom') {
		return ['get', 'zoom'];
	}

	// Recurse into every child element of the array expression.
	return expr.map(rewriteZoom);
}

/**
 * Rewrite all zoom expressions across an entire paint block.
 * Returns a new object; the original is not mutated.
 */
export function rewritePaint(paint: Record<string, ExprNode>): Record<string, ExprNode> {
	const result: Record<string, ExprNode> = {};
	for (const [prop, value] of Object.entries(paint)) {
		result[prop] = rewriteZoom(value);
	}
	return result;
}
