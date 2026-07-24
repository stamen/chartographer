<script lang="ts">
	import { styleStore } from '$lib/styleStore.svelte';

	// ---------------------------------------------------------------------------
	// StyleDropzone
	//
	// Full-screen drop target for loading a Mapbox/Maplibre style JSON file.
	// Also exposes a click-to-browse fallback via a hidden file input.
	// ---------------------------------------------------------------------------

	let isDragging = $state(false);
	let errorMessage = $state<string | null>(null);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		errorMessage = null;

		const file = e.dataTransfer?.files[0];
		if (file) await loadFile(file);
	}

	async function handleFileInput(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) await loadFile(file);
	}

	async function loadFile(file: File) {
		const text = await file.text();
		try {
			styleStore.loadFromJSON(text);
		} catch {
			errorMessage = 'Could not parse that file — make sure it is a valid Mapbox/Maplibre style JSON.';
		}
	}
</script>

<!-- Full-page drop zone overlay -->
<div
	class="dropzone"
	class:dragging={isDragging}
	role="region"
	aria-label="Drop a Mapbox or Maplibre style JSON file here"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	<div class="inner">
		<h1 class="title">Chartographer</h1>
		<p class="subtitle">Drop a Maplibre style JSON to get started</p>

		{#if errorMessage}
			<p class="error">{errorMessage}</p>
		{/if}

		<!-- Hidden file input — the label acts as the visible button -->
		<label class="browse-btn">
			or browse for a file
			<input type="file" accept=".json,application/json" onchange={handleFileInput} />
		</label>
	</div>
</div>

<style lang="scss">
	.dropzone {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #fafafa;
		border: 3px dashed #ccc;
		transition:
			background 0.15s,
			border-color 0.15s;
		z-index: 100;

		&.dragging {
			background: #f0f4ff;
			border-color: #4a6cf7;
		}
	}

	.inner {
		text-align: center;
	}

	.title {
		font-size: 2.4rem;
		font-weight: 700;
		margin: 0 0 0.5rem;
		color: #111;
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 1rem;
		color: #666;
		margin: 0 0 1.5rem;
	}

	.error {
		color: #c0392b;
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}

	.browse-btn {
		cursor: pointer;
		color: #4a6cf7;
		font-size: 0.9rem;
		text-decoration: underline;

		input {
			display: none;
		}
	}
</style>
