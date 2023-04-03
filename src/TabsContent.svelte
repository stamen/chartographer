<script>
  import FillsChart from './FillsChart.svelte';
  import LinesChart from './LinesChart.svelte';
  import TypographyChart from './TypographyChart.svelte';
  import { rendererStore } from './stores';

  export let selectedTab;
  export let style;
  export let updateBackgroundRect;
  export let backgroundSvgData;

  let rendererLib;
  rendererStore.subscribe(value => (rendererLib = value));
</script>

<div class="tabs-content">
  {#if selectedTab === 'fill'}
    <FillsChart {style} />
  {:else if selectedTab === 'lines'}
    <LinesChart {style} />
  {:else if selectedTab === 'typography'}
    {#key rendererLib}
      <TypographyChart {style} {rendererLib} on:revertPage />
    {/key}
  {/if}
</div>

<style>
  .tabs-content {
    display: flex;
    margin-top: 2.5em;
    padding: var(--app-padding);
  }
</style>
