import type { StyleSpecification } from 'maplibre-gl';

// ---------------------------------------------------------------------------
// Data field collector
//
// Walks every layer's paint + layout expressions and harvests every
// "match"/"case" branch keyed on a feature property (["get", field]),
// recording which literal values the style treats as meaningful for that
// field — grouped by layer type so each visualization page (fills, lines,
// ...) only sees the fields relevant to layers it actually renders.
//
// This does NOT try to preserve which value maps to which output. We only
// need the domain of values so a user can pick one and let the real
// renderer evaluate the full expression against synthetic features carrying
// that value — see expressionRewriter.ts for why that's simpler than trying
// to statically reconstruct each branch's output.
// ---------------------------------------------------------------------------

type ExprNode = string | number | boolean | null | ExprNode[];

export type DataFieldValue = string | number | boolean;

export interface DataFieldsByType {
	[layerType: string]: {
		[field: string]: DataFieldValue[];
	};
}

function isPrimitive(node: ExprNode): node is DataFieldValue {
	return typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean';
}

/** Returns the property name if `node` is exactly a `["get", field]` expression. */
function getField(node: ExprNode): string | null {
	if (Array.isArray(node) && node[0] === 'get' && typeof node[1] === 'string') {
		return node[1];
	}
	return null;
}

function addValue(result: DataFieldsByType, layerType: string, field: string, value: DataFieldValue) {
	const byField = (result[layerType] ??= {});
	const values = (byField[field] ??= []);
	if (!values.includes(value)) values.push(value);
}

/** Harvests a `match` node's field and every branch label (the fallback is skipped — it's not a value, it's a default output). */
function harvestMatch(node: ExprNode[], layerType: string, result: DataFieldsByType) {
	const field = getField(node[1]);
	if (field === null) return;

	// Layout: ["match", input, label1, output1, label2, output2, ..., fallback].
	// Pairs run from index 2 up to (not including) the trailing fallback.
	for (let i = 2; i < node.length - 1; i += 2) {
		const label = node[i];
		const labels = Array.isArray(label) ? label : [label];
		for (const l of labels) {
			if (isPrimitive(l)) addValue(result, layerType, field, l);
		}
	}
}

/** Harvests field/value pairs referenced by a single `case` condition expression. */
function harvestCondition(cond: ExprNode, layerType: string, result: DataFieldsByType) {
	if (!Array.isArray(cond)) return;
	const [op, ...args] = cond;

	if (op === '==' || op === '!=') {
		const [a, b] = args;
		const fieldA = getField(a);
		const field = fieldA ?? getField(b);
		if (field === null) return;
		const value = fieldA !== null ? b : a;
		if (isPrimitive(value)) addValue(result, layerType, field, value);
		return;
	}

	if (op === 'in') {
		const field = getField(args[0]);
		if (field === null) return;
		// Legacy variadic form: ["in", ["get", f], v1, v2, ...].
		let values = args.slice(1);
		// Modern form: ["in", ["get", f], ["literal", [...]]] (or a raw array).
		if (values.length === 1 && Array.isArray(values[0])) {
			const inner = values[0];
			values = inner[0] === 'literal' ? (inner[1] as ExprNode[]) : inner;
		}
		for (const v of values) {
			if (isPrimitive(v)) addValue(result, layerType, field, v);
		}
		return;
	}

	if (op === 'all' || op === 'any') {
		for (const sub of args) harvestCondition(sub, layerType, result);
		return;
	}

	if (op === '!') {
		harvestCondition(args[0], layerType, result);
	}

	// Anything else (>, <, has, !has, a bare ["get", field] truthy check, ...)
	// has no discrete literal to harvest — skip rather than guess.
}

/** Harvests every condition in a `case` node (the trailing fallback is skipped). */
function harvestCase(node: ExprNode[], layerType: string, result: DataFieldsByType) {
	// Layout: ["case", cond1, output1, cond2, output2, ..., fallback].
	for (let i = 1; i < node.length - 1; i += 2) {
		harvestCondition(node[i], layerType, result);
	}
}

function walk(node: ExprNode, layerType: string, result: DataFieldsByType) {
	if (!Array.isArray(node)) return;

	if (node[0] === 'match') harvestMatch(node, layerType, result);
	else if (node[0] === 'case') harvestCase(node, layerType, result);

	// Always recurse into every child regardless of the branch above — a
	// match/case can be nested anywhere (e.g. as one stop's value inside an
	// interpolate over zoom), and its own labels/outputs/conditions may
	// themselves contain further match/case nodes.
	for (const child of node) walk(child, layerType, result);
}

/**
 * Walks an entire style's paint + layout blocks and collects every
 * match/case branch value, grouped by layer type.
 */
export function collectDataFields(style: StyleSpecification): DataFieldsByType {
	const result: DataFieldsByType = {};

	for (const layer of style.layers) {
		const layerType = layer.type;
		const paint = (layer as { paint?: Record<string, ExprNode> }).paint;
		const layout = (layer as { layout?: Record<string, ExprNode> }).layout;

		for (const value of Object.values(paint ?? {})) walk(value, layerType, result);
		for (const value of Object.values(layout ?? {})) walk(value, layerType, result);
	}

	// Sort each field's values for stable, predictable UI ordering.
	for (const fields of Object.values(result)) {
		for (const key of Object.keys(fields)) {
			fields[key].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
		}
	}

	return result;
}
