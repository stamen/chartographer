<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let left;
  export let top;

  function handleClose() {
    dispatch('close');
  }
</script>

<div class="tooltip" style="left: {left}px; top: {top}px;">
  <button class="close-button" on:click={handleClose}>&times;</button>
  <pre>
    <code>
      <slot></slot>
    </code>
  </pre>
</div>

<style>
  .tooltip {
    background: white;
    border: 1px solid black;
    padding: 1em;
    position: absolute;
  }

  .close-button {
    background: none;
    border: none;
    float: right;
    margin: 0;
    margin-right: -0.5em;
    margin-top: -0.5em;
    padding: 0.5em;
  }
</style>

