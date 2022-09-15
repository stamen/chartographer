<script>
  import Tab from './Tab.svelte';

  export let selectedTab;
</script>

<div class='tabs'>
  <Tab label="fill" on:tabchange selected={selectedTab === 'fill'} />
  <Tab label="lines" on:tabchange selected={selectedTab === 'lines'} />
  <Tab label="typography" on:tabchange selected={selectedTab === 'typography'} />
</div>

<style>
  .tabs {
    display: flex;
    justify-content: space-between;
    font-weight: bold;
  }
</style>
