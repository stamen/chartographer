<script>
  import { createEventDispatcher } from 'svelte';
  export let label;

  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('tabchange', { tab: label });
  }
</script>

<div class="tab" on:click={handleClick}>
  {label}
</div>

<style>
  .tab {
    margin: 0 1em;
  }
</style>
