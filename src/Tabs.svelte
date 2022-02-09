<script>
  import Tab from './Tab.svelte';
</script>

<div class='tabs'>
  <Tab label="fill" on:tabchange />
  <Tab label="lines" on:tabchange />
  <Tab label="typography" on:tabchange />
</div>

<style>
  .tabs {
    display: flex;
  }
</style>
