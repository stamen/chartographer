<script>
  import FillsChart from './FillsChart.svelte';
  import LinesChart from './LinesChart.svelte';
  import TypographyChart from './TypographyChart.svelte';

  export let selectedTab;
  export let style;
  export let updateBackgroundRect;
  export let backgroundSvgData;
</script>

<div class='tabs-content'>
  {#if selectedTab === 'fill'}
    <FillsChart {style} {updateBackgroundRect} />
  {:else}
    {#if selectedTab === 'lines'}
      <LinesChart {style} {backgroundSvgData} />
    {:else}
      {#if selectedTab === 'typography'}
        <TypographyChart {style} />
      {/if}
    {/if}
  {/if}
</div>

<style>
  .tabs-content {
    display: flex;
    margin-top: 2.5em;
    padding: var(--app-padding);
  }
</style>
