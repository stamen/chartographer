<script lang="ts">
	import { styleStore } from '$lib/styleStore.svelte';
	import { extractFillLayers, extractBackgroundPaint } from '$lib/styleParser';
	import { buildFillGeoJSON } from '$lib/geojson';
	import { RenderQueue } from '$lib/renderer';
	import LayerBar from '$lib/components/LayerBar.svelte';
	import DataConfigModal from '$lib/components/DataConfigModal.svelte';
	import BackgroundSwatch from '$lib/components/BackgroundSwatch.svelte';

	const queue = new RenderQueue();

	// ---------------------------------------------------------------------------
	// Fills page
	//
	// Displays every fill layer in the loaded style as a horizontal colored bar.
	// Left edge = zoom 0, right edge = zoom 22.
	//
	// Each bar's color at any horizontal position reflects the fill-color that
	// the style's paint expression evaluates to at that zoom level.
	// ---------------------------------------------------------------------------

	// Shared fill GeoJSON — 220 vertical polygon strips spanning the full
	// world extent. Recomputed (and every bar re-rendered) whenever the
	// user applies a data config change, since that changes feature
	// properties that match/case expressions read.
	let fillGeoJSON = $derived(buildFillGeoJSON(styleStore.dataConfig.fill));

	// Reactively re-extract layers whenever the loaded style changes.
	let fillLayers = $derived(styleStore.current ? extractFillLayers(styleStore.current) : []);

	// The backdrop drawn behind every bar, derived from the style's own
	// background layer — falls back to this page's previous default color
	// when the style has none.
	let backdropPaint = $derived(
		styleStore.current
			? extractBackgroundPaint(styleStore.current, '#e8e8e8')
			: { 'fill-color': '#e8e8e8' }
	);

	// Zoom tick marks to display above the bars.
	const zoomTicks = [0, 5, 10, 15, 20, 22];
</script>

<header class="page-header">
	<h2>Fill Layers <span class="count">({fillLayers.length})</span></h2>
	<DataConfigModal layerType="fill" />
</header>

{#if fillLayers.length === 0}
	<p class="empty">No fill layers found in this style.</p>
{:else}
	<!-- Zoom ruler: tick marks at notable zoom levels above all bars. -->
	<!-- Left margin matches label width (220px) + gap (12px) = 232px. -->
	<div class="zoom-ruler">
		{#each zoomTicks as z}
			<span class="tick" style="left: {(z / 22) * 100}%">{z}</span>
		{/each}
	</div>

	<!--
		One group per fill layer. Each group contains the main fill bar and,
		when the layer defines fill-outline-color, a 4px strip immediately below
		showing that color across zoom levels. Both bars share the same 220-segment
		GeoJSON so their horizontal extents align exactly.
	-->
	<BackgroundSwatch {backdropPaint}>
		{#each fillLayers as layer (layer.id)}
			<div class="fill-group">
				<LayerBar
					layerId={layer.id}
					layerType="fill"
					layout={layer.layout}
					paint={layer.paint}
					geojson={fillGeoJSON}
					height={50}
					{queue}
				/>
				{#if layer.outlinePaint}
					<LayerBar
						layerId="{layer.id}--outline"
						label=""
						layerType="fill"
						paint={layer.outlinePaint}
						geojson={fillGeoJSON}
						height={4}
						{queue}
					/>
				{/if}
			</div>
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

	// Groups the main fill bar with its optional outline strip.
	// Removes the gap between the two bars so the strip reads as part of
	// the same layer, then restores spacing below the whole group.
	.fill-group {
		margin-bottom: 10px;

		// Cancel the inner LayerBar margins so bars butt up against each other.
		:global(.layer-bar) {
			margin-bottom: 0;
		}
	}

	// The ruler sits above the bars and its left offset aligns the tick labels
	// with the map area (past the 220px label + 12px gap).
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
