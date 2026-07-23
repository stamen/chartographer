<script lang="ts">
	import { onDestroy } from 'svelte';
	import { styleStore } from '$lib/styleStore.svelte';
	import { extractLineLayers, extractBackgroundPaint } from '$lib/styleParser';
	import { buildLineGeoJSON } from '$lib/geojson';
	import { RenderQueue } from '$lib/renderer';
	import LayerBar from '$lib/components/LayerBar.svelte';
	import DataConfigModal from '$lib/components/DataConfigModal.svelte';
	import BackgroundSwatch from '$lib/components/BackgroundSwatch.svelte';

	const queue = new RenderQueue();
	// Otherwise this page's hidden MapLibre instance (and its WebGL context)
	// keeps running in the background indefinitely after navigating away —
	// any already-finished renders are still cached and reused (see
	// renderCache.ts), so nothing is lost by tearing this down.
	onDestroy(() => queue.destroy());

	// ---------------------------------------------------------------------------
	// Lines page
	//
	// Displays every line layer in the loaded style as a horizontal bar.
	// The rendered line changes color and width from left to right as zoom
	// increases from 0 to 22.
	//
	// Line-width is expressed in screen pixels by MapLibre. Each of our 220
	// line segments is a separate GeoJSON feature whose "zoom" property drives
	// the rewritten paint expression, so MapLibre renders each segment at the
	// correct pixel width for that zoom level.
	// ---------------------------------------------------------------------------

	// Shared line GeoJSON — 220 short horizontal segments along the equator,
	// each with its own "zoom" property. Recomputed (and every bar
	// re-rendered) whenever the user applies a data config change, since
	// that changes feature properties that match/case expressions read.
	let lineGeoJSON = $derived(buildLineGeoJSON(styleStore.dataConfig.line));

	let lineLayers = $derived(styleStore.current ? extractLineLayers(styleStore.current) : []);

	// The backdrop drawn behind every bar, derived from the style's own
	// background layer — falls back to this page's previous default dark
	// color (thin/light lines need a dark backdrop to stay visible) when
	// the style has none.
	let backdropPaint = $derived(
		styleStore.current
			? extractBackgroundPaint(styleStore.current, '#1a1a1a')
			: { 'fill-color': '#1a1a1a' }
	);

	const zoomTicks = [0, 5, 10, 15, 20, 22];
</script>

<header class="page-header">
	<h2>Line Layers <span class="count">({lineLayers.length})</span></h2>
	<DataConfigModal layerType="line" />
</header>

{#if lineLayers.length === 0}
	<p class="empty">No line layers found in this style.</p>
{:else}
	<div class="zoom-ruler">
		{#each zoomTicks as z}
			<span class="tick" style="left: {(z / 22) * 100}%">{z}</span>
		{/each}
	</div>

	<!--
		Line bars use a DARK background (#1a1a1a) so thin lines at low zoom levels
		are visible against the bar. Without this, a 1px white/light road would be
		invisible on the default grey background.

		Height is 100px — enough to show meaningful width variation while keeping
		the list scannable. Line-width is in screen pixels regardless of map zoom,
		so at zoom 22 a 12px road occupies 12/100 = 12% of the bar height.
	-->
	<BackgroundSwatch {backdropPaint}>
		{#each lineLayers as layer (layer.id)}
			<LayerBar
				layerId={layer.id}
				layerType="line"
				layout={layer.layout}
				paint={layer.paint}
				geojson={lineGeoJSON}
				height={100}
				{queue}
			/>
		{/each}
	</BackgroundSwatch>
{/if}

<style lang="scss">
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
		padding: 16px 0;
		position: sticky;
		top: 45px;
		background: #fff;
		z-index: 5;
	}

	h2 {
		font-size: 14px;
		font-weight: 600;
		margin: 0;

		.count {
			font-weight: 400;
			color: #999;
		}
	}

	.empty {
		color: #666;
		font-size: 14px;
	}

	.zoom-ruler {
		position: relative;
		height: 18px;
		margin-left: 232px;
		margin-bottom: 4px;
	}

	.tick {
		position: absolute;
		transform: translateX(-50%);
		font-size: 10px;
		color: #aaa;
		font-family: monospace;
	}
</style>
