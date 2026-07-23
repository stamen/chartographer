<script lang="ts">
	import { onDestroy } from 'svelte';
	import { styleStore } from '$lib/styleStore.svelte';
	import { extractSymbolLayers, extractBackgroundPaint } from '$lib/styleParser';
	import {
		buildSymbolGeoJSON,
		SYMBOL_MARGIN_FRACTION,
		SYMBOL_SAMPLE_SPACING_PX
	} from '$lib/geojson';
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
	// Symbols page
	//
	// Displays every symbol layer in the loaded style as a horizontal bar of
	// points, one every 2 zoom levels (far sparser than fill/line's 220
	// segments — labels need real horizontal room or they'd overlap into an
	// illegible smear).
	//
	// text-field almost always references a property we have no real data
	// for, so every ["get", field] that produces displayed text is replaced
	// with the literal field name — see expressionRewriter.ts's
	// rewriteTextField for the exact rule (case/match conditions are left
	// real and configurable via the data config modal, same as fill/line).
	//
	// icon-image needs no special handling: a literal renders for real, a
	// match/case keyed on a real property resolves via data config, and a
	// bare ["get", field] just evaluates to undefined on our synthetic
	// features — no icon drawn, which is the desired behavior when we have
	// no data for it.
	// ---------------------------------------------------------------------------

	let symbolGeoJSON = $derived(buildSymbolGeoJSON(styleStore.dataConfig.symbol));

	let symbolLayers = $derived(styleStore.current ? extractSymbolLayers(styleStore.current) : []);

	let backdropPaint = $derived(
		styleStore.current
			? extractBackgroundPaint(styleStore.current, '#e8e8e8')
			: { 'fill-color': '#e8e8e8' }
	);

	// text-font/icon-image need these to resolve real glyphs/sprite icons.
	// (sprite can also be a multi-sprite {id,url}[] per the style spec — we
	// only support the plain string-URL form real styles almost always use.)
	let glyphs = $derived(styleStore.current?.glyphs);
	let sprite = $derived(
		typeof styleStore.current?.sprite === 'string' ? styleStore.current.sprite : undefined
	);

	// Ticks align with the actual sample points (every 2 zoom levels).
	const zoomTicks = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

	// Fixed render width — unlike fill/line, symbol bars don't fit the
	// viewport; they scroll horizontally, so every zoom sample gets
	// consistent room regardless of window size. Derived so the *usable*
	// portion (after SYMBOL_MARGIN_FRACTION's margin on each side) has
	// exactly SYMBOL_SAMPLE_SPACING_PX between adjacent samples.
	const mapWidth = Math.round(
		((zoomTicks.length - 1) * SYMBOL_SAMPLE_SPACING_PX) / (1 - 2 * SYMBOL_MARGIN_FRACTION)
	);

	// Label (220px) + gap (12px) + the map-container itself — the full
	// scrollable row width, so BackgroundSwatch's tile lines up with the
	// actual content instead of the (narrower) viewport.
	const totalWidth = 232 + mapWidth;
</script>

<header class="page-header">
	<h2>Symbol Layers <span class="count">({symbolLayers.length})</span></h2>
	<DataConfigModal layerType="symbol" />
</header>

{#if symbolLayers.length === 0}
	<p class="empty">No symbol layers found in this style.</p>
{:else}
	<!-- Symbol bars use a fixed render width and scroll horizontally instead
	     of fitting the viewport — labels need real, consistent room. The
	     label column (sticky, in LayerBar.svelte) stays pinned while this
	     scrolls. -->
	<div class="scroll-area">
		<!-- Ticks are inset by SYMBOL_MARGIN_FRACTION on each side, matching
		     where buildSymbolGeoJSON actually places each zoom sample. -->
		<div class="zoom-ruler" style="width: {mapWidth}px">
			{#each zoomTicks as z}
				<span
					class="tick"
					style="left: {(SYMBOL_MARGIN_FRACTION + (z / 22) * (1 - 2 * SYMBOL_MARGIN_FRACTION)) * 100}%"
					>{z}</span
				>
			{/each}
		</div>

		<BackgroundSwatch {backdropPaint} {totalWidth}>
			{#each symbolLayers as layer (layer.id)}
				<LayerBar
					layerId={layer.id}
					layerType="symbol"
					layout={layer.layout}
					paint={layer.paint}
					geojson={symbolGeoJSON}
					height={60}
					{glyphs}
					{sprite}
					{mapWidth}
					{queue}
				/>
			{/each}
		</BackgroundSwatch>
	</div>
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

	.scroll-area {
		overflow-x: auto;
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
