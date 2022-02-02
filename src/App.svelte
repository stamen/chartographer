<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import { readQuery, writeQuery } from './query';
  import Tabs from './Tabs.svelte';
  import TabsContent from './TabsContent.svelte';

  export let selectedTab;
  export let style;
  export let loadDefaultStyle = false;

  onMount(() => {
    const query = readQuery();
    if (query.selectedTab) {
      selectedTab = query.selectedTab;
    }
    else {
      selectedTab = 'fill';
    }

    if (loadDefaultStyle) {
      loadStyleUrl('./style.json');
    }
  });

  function getState() {
    let state = {};
    if (selectedTab) state.selectedTab = selectedTab;
    return state;
  }

  function updateQuery() {
    writeQuery(getState());
  }

  async function loadStyleUrl(url) {
    style = await d3.json(url);
  }

  function handleStyleLoad(e) {
    style = e.detail.style;
  }

  function handleTabChange(e) {
    selectedTab = e.detail.tab;
    updateQuery();
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDragEnter(e) {
    e.preventDefault();
  }

  async function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    const { files } = e.dataTransfer;
    const text = await files[0].text();
    style = JSON.parse(text);
  }
</script>

<main
  on:dragover={handleDragOver}
  on:dragover={handleDragEnter}
  on:drop={handleDrop}
>
  {#if style}
    <Tabs on:tabchange={handleTabChange} />
    <TabsContent {selectedTab} {style} />
  {:else}
    <div class="drop">
      <div>Drop a style here</div>
    </div>
  {/if}
</main>

<style>
  main {
    width: 100%;
    height: 100%;
  }

  .drop {
    font-size: 5em;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    justify-content: center;
  }
</style>
