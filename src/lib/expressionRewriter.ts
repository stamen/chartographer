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

// ---------------------------------------------------------------------------
// text-field rewriter: replaces every ["get", field] that PRODUCES TEXT
// CONTENT with the literal string field, since we have no real data for
// arbitrary label fields (unlike match/case data, which the user configures
// via styleStore.dataConfig) — showing the field name lets a user see which
// property drives the label.
//
// ["get", ...] used inside a case/match CONDITION (deciding which branch to
// take, e.g. picking a name field based on ["get", "class"]) is left
// untouched — those should keep evaluating against the real, configurable
// feature properties, exactly like fill/line layers.
//
// Example transform:
//   ["get", "name_en"]                    becomes ->  "name_en"
//   ["match", ["get","class"],
//     "country", ["get","name_en"],       becomes ->  ["match", ["get","class"],
//     ["get","name"]]                                    "country", "name_en",
//                                                         "name"]
//   (the match's own input stays a real ["get","class"] — only the outputs,
//   which produce the displayed text, become literal field names)
// ---------------------------------------------------------------------------

/** A node that can appear in a text-field expression — broader than
 * ExprNode since "format" sections carry plain option objects too. */
type FieldNode = string | number | boolean | null | Record<string, unknown> | FieldNode[];

function isFieldArray(node: FieldNode): node is FieldNode[] {
	return Array.isArray(node);
}

export function rewriteTextField(expr: FieldNode): FieldNode {
	if (!isFieldArray(expr)) return expr;

	const op = expr[0];

	if (op === 'get' && typeof expr[1] === 'string') {
		return expr[1];
	}

	if (op === 'case') {
		// ["case", cond1, out1, cond2, out2, ..., fallback] — conditions are
		// left untouched; outputs and the fallback are content.
		const result: FieldNode[] = ['case'];
		for (let i = 1; i < expr.length - 1; i += 2) {
			result.push(expr[i], rewriteTextField(expr[i + 1] as FieldNode));
		}
		result.push(rewriteTextField(expr[expr.length - 1] as FieldNode));
		return result;
	}

	if (op === 'match') {
		// ["match", input, label1, out1, label2, out2, ..., fallback] — the
		// input being matched is left untouched (real, configurable data);
		// labels are already literals; outputs and the fallback are content.
		const result: FieldNode[] = ['match', expr[1] as FieldNode];
		for (let i = 2; i < expr.length - 1; i += 2) {
			result.push(expr[i], rewriteTextField(expr[i + 1] as FieldNode));
		}
		result.push(rewriteTextField(expr[expr.length - 1] as FieldNode));
		return result;
	}

	if (op === 'step') {
		// ["step", input, output0, stop1, output1, ...] — input (typically
		// ["zoom"], already handled by rewriteZoom) is left untouched; every
		// output is content, stops are plain numbers.
		const result: FieldNode[] = ['step', expr[1] as FieldNode, rewriteTextField(expr[2] as FieldNode)];
		for (let i = 3; i < expr.length; i += 2) {
			result.push(expr[i]);
			if (i + 1 < expr.length) result.push(rewriteTextField(expr[i + 1] as FieldNode));
		}
		return result;
	}

	if (op === 'format') {
		// ["format", part1, opts1, part2, opts2, ...] — every part is
		// content; the options objects between them are left untouched.
		const result: FieldNode[] = ['format'];
		for (let i = 1; i < expr.length; i += 2) {
			result.push(rewriteTextField(expr[i] as FieldNode));
			if (i + 1 < expr.length) result.push(expr[i + 1]);
		}
		return result;
	}

	// Any other wrapper (concat, coalesce, to-string, upcase, downcase, ...)
	// — every child is a content position.
	return expr.map(rewriteTextField);
}
