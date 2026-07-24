<script lang="ts">
	import { styleStore } from '$lib/styleStore.svelte';
	import type { DataFieldValue } from '$lib/dataFieldCollector';

	// ---------------------------------------------------------------------------
	// Button + modal for picking which value each data-driven (match/case)
	// property should take. Selections are stored on styleStore.dataConfig,
	// keyed by layerType so fill/line selections stay independent.
	// ---------------------------------------------------------------------------

	let { layerType }: { layerType: string } = $props();

	let open = $state(false);

	// Edits made in the modal land here first — nothing reaches styleStore
	// (and no bars re-render) until the user clicks "Apply".
	let draft = $state<Record<string, DataFieldValue>>({});

	let fields = $derived(styleStore.dataFields[layerType] ?? {});
	let fieldCount = $derived(Object.keys(fields).length);

	// Sentinel <option> value representing "no override — use the fallback".
	const FALLBACK = '__fallback__';

	function openModal() {
		draft = { ...(styleStore.dataConfig[layerType] ?? {}) };
		open = true;
	}

	function apply() {
		for (const field of Object.keys(fields)) {
			styleStore.setDataConfigValue(layerType, field, draft[field] ?? null);
		}
		open = false;
	}

	function selectedOption(field: string): string {
		const value = draft[field];
		return value === undefined ? FALLBACK : String(value);
	}

	function handleChange(field: string, values: DataFieldValue[], raw: string) {
		if (raw === FALLBACK) {
			delete draft[field];
			return;
		}
		// <option> values are always strings — recover the original typed
		// value (number/boolean) so it round-trips correctly.
		const original = values.find((v) => String(v) === raw) ?? raw;
		draft[field] = original;
	}
</script>

<button class="config-button" onclick={openModal} disabled={fieldCount === 0}>
	Configure data{#if fieldCount > 0}<span class="badge">{fieldCount}</span>{/if}
</button>

{#if open}
	<div class="modal-backdrop" onclick={() => (open = false)} role="presentation">
		<div
			class="modal"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.key === 'Escape' && (open = false)}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<header class="modal-header">
				<h3>Configure data</h3>
				<button class="close" onclick={() => (open = false)} aria-label="Close">✕</button>
			</header>

			{#if fieldCount === 0}
				<p class="empty">
					No match/case data properties found on {layerType} layers in this style.
				</p>
			{:else}
				<div class="fields">
					{#each Object.entries(fields) as [field, values] (field)}
						<label class="field-row">
							<span class="field-name">{field}</span>
							<select
								value={selectedOption(field)}
								onchange={(e) => handleChange(field, values, e.currentTarget.value)}
							>
								<option value={FALLBACK}>— fallback (no value) —</option>
								{#each values as v (String(v))}
									<option value={String(v)}>{v}</option>
								{/each}
							</select>
						</label>
					{/each}
				</div>
				<footer class="modal-footer">
					<button class="cancel" onclick={() => (open = false)}>Cancel</button>
					<button class="apply" onclick={apply}>Apply</button>
				</footer>
			{/if}
		</div>
	</div>
{/if}

<style lang="scss">
	.config-button {
		display: flex;
		align-items: center;
		gap: 6px;
		border: 1px solid #d0d0d0;
		background: #fff;
		border-radius: 4px;
		padding: 5px 10px;
		font-size: 12px;
		cursor: pointer;
		color: #333;

		&:hover:not(:disabled) {
			border-color: #4a6cf7;
			color: #4a6cf7;
		}

		&:disabled {
			opacity: 0.5;
			cursor: default;
		}
	}

	.badge {
		background: #4a6cf7;
		color: #fff;
		border-radius: 10px;
		padding: 1px 6px;
		font-size: 10px;
		line-height: 1.4;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		background: #fff;
		border-radius: 8px;
		width: 420px;
		max-width: calc(100vw - 32px);
		max-height: calc(100vh - 64px);
		overflow-y: auto;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border-bottom: 1px solid #eee;
		position: sticky;
		top: 0;
		background: #fff;

		h3 {
			margin: 0;
			font-size: 14px;
		}
	}

	.close {
		border: none;
		background: none;
		cursor: pointer;
		font-size: 14px;
		color: #999;

		&:hover {
			color: #c0392b;
		}
	}

	.empty {
		padding: 16px;
		color: #666;
		font-size: 13px;
		margin: 0;
	}

	.fields {
		padding: 8px 16px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.field-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
	}

	.field-name {
		font-family: monospace;
		color: #555;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 16px;
		border-top: 1px solid #eee;
		position: sticky;
		bottom: 0;
		background: #fff;
	}

	.cancel,
	.apply {
		border-radius: 4px;
		padding: 6px 14px;
		font-size: 12px;
		cursor: pointer;
	}

	.cancel {
		border: 1px solid #d0d0d0;
		background: #fff;
		color: #333;

		&:hover {
			border-color: #999;
		}
	}

	.apply {
		border: none;
		background: #4a6cf7;
		color: #fff;

		&:hover {
			background: #3a5ce0;
		}
	}

	select {
		font-size: 13px;
		padding: 5px 6px;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		background: #fff;
	}
</style>
