<script lang="ts">
	import { onDestroy } from 'svelte';
	import { RenderQueue } from '$lib/renderer';
	import { buildFillGeoJSON } from '$lib/geojson';
	import { getCachedRender, setCachedRender, renderCacheKey } from '$lib/renderCache';

	// ---------------------------------------------------------------------------
	// Renders the style's background layer ONCE as a small horizontal swatch
	// (zoom 0 at the left edge, 22 at the right, same as every other bar), then
	// tiles it vertically via CSS behind the whole list of layer bars passed as
	// children — rather than every individual bar re-rendering an identical
	// copy of it into its own capture.
	//
	// This works because the backdrop's color only varies by x (zoom), never
	// by y, so a repeating vertical tile is seamless regardless of how tall
	// the list grows, and CSS-stretching the swatch horizontally to fit any
	// container width preserves the zoom mapping exactly (it's linear both at
	// capture time and at stretch time).
	// ---------------------------------------------------------------------------

	let { backdropPaint, totalWidth, children }: {
		backdropPaint: Record<string, unknown>;
		// Total row width (label + gap + map-container), only needed when a
		// page uses a fixed/scrollable width (symbols) instead of the
		// default flex-to-viewport sizing (fill/line). Without it, this
		// wrapper's own width defaults to the viewport — its content simply
		// overflows past it when children are wider, so the tile's
		// background-size math below would be computed against the wrong
		// (too-narrow) width and never line up with the actual scrollable
		// content.
		totalWidth?: number;
		children: import('svelte').Snippet;
	} = $props();

	// Matches LayerBar's label (220px) + gap (12px) — the swatch only covers
	// the map-container column, not the label column.
	const LABEL_OFFSET = 232;
	const SWATCH_WIDTH = 800;
	const SWATCH_HEIGHT = 50;

	const queue = new RenderQueue();
	onDestroy(() => queue.destroy());
	let dataUrl = $state<string | null>(null);

	$effect(() => {
		const paint = backdropPaint;
		const job = {
			layerType: 'fill' as const,
			paint,
			layout: {},
			geojson: buildFillGeoJSON(),
			width: SWATCH_WIDTH,
			height: SWATCH_HEIGHT
		};

		const cacheKey = renderCacheKey(job);
		const cached = getCachedRender(cacheKey);
		if (cached) {
			dataUrl = cached;
			return;
		}

		queue
			.enqueue({ layerId: 'background-swatch', ...job })
			.then((url) => {
				setCachedRender(cacheKey, url);
				dataUrl = url;
			})
			.catch(() => {
				// Non-critical — the list just renders without a backdrop.
			});
	});
</script>

<div
	class="swatch-wrapper"
	style="
		background-image: {dataUrl ? `url(${dataUrl})` : 'none'};
		background-position: {LABEL_OFFSET}px 0;
		background-size: calc(100% - {LABEL_OFFSET}px) {SWATCH_HEIGHT}px;
		{totalWidth !== undefined ? `width: ${totalWidth}px;` : ''}
	"
>
	{@render children()}
</div>

<style>
	.swatch-wrapper {
		position: relative;
		background-repeat: repeat-y;
	}
</style>
