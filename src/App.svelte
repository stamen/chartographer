<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import { readQuery, writeQuery } from './query';
  import Tabs from './Tabs.svelte';
  import TabsContent from './TabsContent.svelte';
  import computedStyleToInlineStyle from 'computed-style-to-inline-style';

  export let selectedTab;
  export let style;
  export let backgroundSvgData = {};
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
     // On dropping in a style, switch to the fill tab to refresh background layer state
     handleTabChange({ detail: { tab: 'fill' } });
  }

  function updateBackgroundRect(backgroundRect, backgroundGradient) {
    backgroundSvgData = { gradientDefs: backgroundGradient, rect: backgroundRect };
  }

  function downloadSvg() {
    let svg = document.getElementById(selectedTab);

    computedStyleToInlineStyle(svg, {
      recursive:true,
      // Limiting to these properties for now since the function runs much faster
      properties: ['font-size', 'font-family', 'text-anchor']
    });
    
    svg = new XMLSerializer().serializeToString(svg); 

    // Remove single quotes for Figma
    svg = svg.replace(/url\(([^\)]+)\)/g, match => {
      return match.replaceAll("'", '');
    });

    const blob = new Blob([svg]);
    const element = document.createElement("a");
    element.download = `${style.id}-${selectedTab}-chart.svg`;
    element.href = window.URL.createObjectURL(blob);
    element.click();
    element.remove();
  }
</script>

<main
  on:dragover={handleDragOver}
  on:dragover={handleDragEnter}
  on:drop={handleDrop}
>
  {#if style}
    <div class="top-bar"><Tabs on:tabchange={handleTabChange} />
      {#if selectedTab !== 'typography'}
      <button on:click={downloadSvg} class="download-button">Download SVG</button>
      {/if}
    </div>
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

  .download-button {
    display: flex;
  }

  .top-bar {
    display: flex;
    justify-content: space-between;
  }
</style>
