<script lang="ts">
	import { styleStore } from '$lib/styleStore.svelte';
	import { extractFillLayers } from '$lib/styleParser';
	import { buildFillGeoJSON } from '$lib/geojson';
	import { RenderQueue } from '$lib/renderer';
	import LayerBar from '$lib/components/LayerBar.svelte';

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

	// Build the shared fill GeoJSON once — all LayerBar instances reuse it.
	// It's 220 vertical polygon strips spanning the full world extent.
	const fillGeoJSON = buildFillGeoJSON();

	// Reactively re-extract layers whenever the loaded style changes.
	let fillLayers = $derived(styleStore.current ? extractFillLayers(styleStore.current) : []);

	// Zoom tick marks to display above the bars.
	const zoomTicks = [0, 5, 10, 15, 20, 22];
</script>

<header class="page-header">
	<h2>Fill Layers <span class="count">({fillLayers.length})</span></h2>
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
{/if}

<style lang="scss">
	.page-header {
		margin-bottom: 16px;
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
		margin-bottom: 2px;

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
