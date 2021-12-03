<script>
  import FillsChart from './FillsChart.svelte';
  import LinesChart from './LinesChart.svelte';

  export let selectedTab;
  export let style;
</script>

<div class='tabs-content'>
  {#if selectedTab === 'fill'}
    <FillsChart {style} />
  {:else}
    {#if selectedTab === 'lines'}
      <LinesChart {style} />
    {/if}
  {/if}
</div>

<style>
  .tabs-content {
    display: flex;
    margin-top: 1em;
  }
</style>
