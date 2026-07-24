<script lang="ts">
	// ---------------------------------------------------------------------------
	// Button + modal for viewing a style's sprite sheet, fetched directly from
	// the sprite URL with ".png" appended. Disabled (not hidden) when there's
	// no sprite URL, or the PNG can't actually be fetched — probed once
	// whenever `sprite` changes.
	// ---------------------------------------------------------------------------

	let { sprite }: { sprite?: string } = $props();

	let open = $state(false);
	let status = $state<'idle' | 'checking' | 'ok' | 'error'>('idle');

	// The sprite URL often carries a query string (e.g. an API access
	// token) — naively appending ".png" at the very end would tack it onto
	// the query string instead of the path, corrupting both. Insert it
	// into the pathname instead.
	function spritePngUrl(spriteUrl: string): string {
		try {
			const url = new URL(spriteUrl);
			url.pathname += '.png';
			return url.toString();
		} catch {
			return `${spriteUrl}.png`;
		}
	}

	let pngUrl = $derived(sprite ? spritePngUrl(sprite) : '');

	$effect(() => {
		const url = pngUrl;
		if (!url) {
			status = 'idle';
			return;
		}
		status = 'checking';
		const img = new Image();
		img.onload = () => {
			status = 'ok';
		};
		img.onerror = () => {
			status = 'error';
		};
		img.src = url;
	});
</script>

<button class="sprite-button" onclick={() => (open = true)} disabled={status !== 'ok'}>
	View sprite
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
				<h3>Sprite sheet</h3>
				<button class="close" onclick={() => (open = false)} aria-label="Close">✕</button>
			</header>

			<div class="sprite-image-wrap">
				<img src={pngUrl} alt="Sprite sheet" />
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.sprite-button {
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
		width: fit-content;
		max-width: calc(100vw - 32px);
		max-height: calc(100vh - 64px);
		display: flex;
		flex-direction: column;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 14px 16px;
		border-bottom: 1px solid #eee;

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

	.sprite-image-wrap {
		overflow: auto;
		padding: 16px;
		// A light checkerboard so transparent PNG regions (most sprite
		// icons) are distinguishable from the modal's own background.
		background-image:
			linear-gradient(45deg, #eee 25%, transparent 25%),
			linear-gradient(-45deg, #eee 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, #eee 75%),
			linear-gradient(-45deg, transparent 75%, #eee 75%);
		background-size: 16px 16px;
		background-position:
			0 0,
			0 8px,
			8px -8px,
			-8px 0;

		img {
			display: block;
			// Native pixel size — sprite icons are small and meant to be
			// inspected at real resolution, not scaled.
			image-rendering: pixelated;
		}
	}
</style>
