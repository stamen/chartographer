<script lang="ts">
	import type { FeatureCollection } from 'geojson';
	import type { RenderQueue } from '$lib/renderer';
	import { getCachedRender, setCachedRender, renderCacheKey } from '$lib/renderCache';

	let {
		layerId,
		layerType,
		paint,
		layout = {},
		geojson,
		height = 50,
		glyphs,
		sprite,
		label = layerId,
		queue
	}: {
		layerId: string;
		layerType: 'fill' | 'line' | 'symbol';
		paint: Record<string, unknown>;
		layout?: Record<string, unknown>;
		geojson: FeatureCollection;
		height?: number;
		glyphs?: string;
		sprite?: string;
		label?: string;
		queue: RenderQueue;
	} = $props();

	let container = $state<HTMLDivElement | undefined>(undefined);
	let dataUrl = $state<string | null>(null);
	let renderError = $state<string | null>(null);

	// Tracks the most recently started render so a slower, superseded
	// enqueue() (e.g. from rapid back-to-back data config changes) can't
	// overwrite a newer result once it finally resolves.
	let renderGeneration = 0;

	// Re-renders whenever geojson changes — not just once on mount — since
	// applying a new data config produces a new geojson reference.
	$effect(() => {
		const currentGeojson = geojson;
		const generation = ++renderGeneration;
		const width = container?.clientWidth || 800;

		const cacheKey = renderCacheKey({
			layerType,
			paint,
			layout,
			geojson: currentGeojson,
			glyphs,
			sprite,
			width,
			height
		});

		const cached = getCachedRender(cacheKey);
		if (cached) {
			dataUrl = cached;
			renderError = null;
			return;
		}

		dataUrl = null;
		renderError = null;

		queue
			.enqueue({
				layerId,
				layerType,
				paint,
				layout,
				geojson: currentGeojson,
				glyphs,
				sprite,
				width,
				height
			})
			.then((url) => {
				setCachedRender(cacheKey, url);
				if (generation !== renderGeneration) return;
				dataUrl = url;
			})
			.catch((err) => {
				if (generation !== renderGeneration) return;
				renderError = String(err);
			});
	});
</script>

<div class="layer-bar" style="--bar-height: {height}px">
	<div class="label" title={label}>{label}</div>

	<div class="map-container" bind:this={container}>
		{#if dataUrl}
			<img src={dataUrl} alt="" width={container?.clientWidth} {height} />
		{:else if renderError}
			<span class="map-error" title={renderError}>⚠ render error</span>
		{:else}
			<span class="loading"></span>
		{/if}
	</div>
</div>

<style lang="scss">
	.layer-bar {
		display: flex;
		align-items: stretch;
		height: var(--bar-height);
		margin-bottom: 2px;
		gap: 12px;
	}

	.label {
		width: 220px;
		flex-shrink: 0;
		font-family: monospace;
		font-size: 11px;
		color: #555;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: flex;
		align-items: center;
	}

	.map-container {
		flex: 1;
		height: var(--bar-height);
		overflow: hidden;
		border-radius: 2px;
		position: relative;
		// Transparent so the shared BackgroundSwatch behind the whole bar
		// list shows through wherever this bar's own render doesn't cover
		// (there's no per-bar backdrop layer anymore — see renderer.ts).
		background: transparent;

		img {
			display: block;
			width: 100%;
			height: 100%;
			object-fit: fill;
		}
	}

	.map-error {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		color: #c0392b;
		background: rgba(255, 255, 255, 0.8);
	}

	.loading {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			90deg,
			#e0e0e0 0px,
			#e8e8e8 20px,
			#e0e0e0 40px
		);
		opacity: 0.6;
		animation: shimmer 1.2s infinite linear;
		background-size: 200% 100%;
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}
</style>
