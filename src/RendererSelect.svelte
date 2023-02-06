<script>
  import { renderers } from './constants';
  import { rendererStore } from './stores';

  let selectedRenderer;

  const setRenderer = renderer => {
    rendererStore.set(renderer);
  };

  $: setRenderer(selectedRenderer);
</script>

<div>
  Renderer:
  <select class="renderer-dropdown" bind:value={selectedRenderer}>
    {#each renderers as renderer}
      <option value={renderer.value}>{renderer.name}</option>
    {/each}
  </select>
</div>

<style>
  .renderer-dropdown {
    height: 30px;
    font-size: 12px;
  }
</style>
