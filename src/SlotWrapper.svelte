<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let index;

  onMount(() => {
    dispatch('load', index);
  });
</script>

<slot />

<style>
</style>
