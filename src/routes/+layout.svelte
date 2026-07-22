<script lang="ts">
	import { styleStore } from '$lib/styleStore.svelte';
	import StyleDropzone from '$lib/components/StyleDropzone.svelte';
	// MapLibre's default CSS must be loaded once globally so its canvas and
	// popup styles are available to every LayerBar instance on the page.
	import 'maplibre-gl/dist/maplibre-gl.css';

	let { children } = $props();

	// Derived bool — drives whether we show the app shell or the drop-zone overlay.
	let hasStyle = $derived(styleStore.current !== null);
</script>

<svelte:head>
	<title>Chartographer</title>
</svelte:head>

{#if hasStyle}
	<!-- ── App shell (shown once a style is loaded) ── -->
	<div class="app">
		<nav>
			<span class="brand">Chartographer</span>
			<a href="/fills">Fills</a>
			<a href="/lines">Lines</a>
			<!-- Unload the style and return to the drop-zone screen -->
			<button class="unload" onclick={() => styleStore.clear()}>✕ Unload style</button>
		</nav>

		<main>
			{@render children()}
		</main>
	</div>
{:else}
	<!-- ── Full-screen drop zone (shown before any style is loaded) ── -->
	<StyleDropzone />
{/if}

<style lang="scss">
	:global(body) {
		margin: 0;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		background: #fff;
		color: #111;
	}

	// Remove MapLibre's default attribution control positioning styles
	// that bleed outside our small bar containers.
	:global(.maplibregl-ctrl-attrib) {
		display: none;
	}

	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	nav {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 0 16px;
		height: 44px;
		border-bottom: 1px solid #e0e0e0;
		font-size: 13px;

		.brand {
			font-weight: 700;
			font-size: 15px;
			margin-right: 8px;
			letter-spacing: -0.01em;
		}

		a {
			color: #333;
			text-decoration: none;

			&:hover {
				color: #4a6cf7;
			}
		}

		.unload {
			margin-left: auto;
			border: none;
			background: none;
			cursor: pointer;
			color: #999;
			font-size: 12px;

			&:hover {
				color: #c0392b;
			}
		}
	}

	main {
		padding: 20px 16px;
		flex: 1;
	}
</style>
