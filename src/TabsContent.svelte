<script>
  import FillsChart from './FillsChart.svelte';
  import LinesChart from './LinesChart.svelte';
  import TypographyChart from './TypographyChart.svelte';
  import { MARGIN } from './constants';

  export let selectedTab;
  export let style;
  export let updateBackgroundRect;
  export let backgroundSvgData;
</script>

<div class="tabs-content">
  {#if selectedTab === 'fill'}
    <FillsChart {style} {updateBackgroundRect} />
  {:else if selectedTab === 'lines'}
    <LinesChart {style} {backgroundSvgData} />
  {:else if selectedTab === 'typography'}
    <TypographyChart {style} />
  {/if}
</div>

<style>
  .tabs-content {
    margin-top: var(--margin-top);
    display: flex;
    padding: var(--app-padding);
    height: calc(100% - var(--app-padding) * 2 - var(--margin-top));
    width: calc(100% - var(--app-padding) * 2);
  }
</style>
