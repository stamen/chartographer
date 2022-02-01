<script>
  import Tabs from './Tabs.svelte';
  import TabsContent from './TabsContent.svelte';

  export let selectedTab = 'fill';
  export let style;
  export let backgroundSvgData = {};

  function handleStyleLoad(e) {
    style = e.detail.style;
  }

  function handleTabChange(e) {
    selectedTab = e.detail.tab;
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
     // On dropping in a style, switch to the fill tab to refresh background layer state
     handleTabChange({ detail: { tab: 'fill' } });
  }

  function updateBackgroundRect(backgroundRect, backgroundGradient) {
    backgroundSvgData = { gradientDefs: backgroundGradient, rect: backgroundRect };
  }
</script>

<main
  on:dragover={handleDragOver}
  on:dragover={handleDragEnter}
  on:drop={handleDrop}
>
  {#if style}
    <Tabs on:tabchange={handleTabChange} />
    <TabsContent {selectedTab} {style} {updateBackgroundRect} {backgroundSvgData} />
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
