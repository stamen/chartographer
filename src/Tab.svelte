<script>
  import { createEventDispatcher } from 'svelte';
  export let label;
  export let selected;
  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('tabchange', { tab: label });
  }
</script>

<div class="tab {selected ? 'selected' : ''}" on:click={handleClick}>
  {label[0].toUpperCase() + label.substring(1)}
</div>

<style>
  .tab {
    margin-right: 1em;
    cursor: pointer;
  }

  .selected {
    text-decoration: underline;
  }
</style>
