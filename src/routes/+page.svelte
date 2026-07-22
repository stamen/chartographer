<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	// The root "/" route just forwards to the fills page.
	// We guard with `browser` because goto() doesn't exist during SSR.
	if (browser) {
		goto('/fills', { replaceState: true });
	}
</script>
