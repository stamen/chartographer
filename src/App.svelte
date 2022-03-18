<script>
  import * as d3 from 'd3';
  import { migrate } from '@mapbox/mapbox-gl-style-spec';
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa/src/fa.svelte'
  import { faTrash, faDownload } from '@fortawesome/free-solid-svg-icons'
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
    style = migrate(JSON.parse(text));
     // On dropping in a style, switch to the fill tab to refresh background layer state
     handleTabChange({ detail: { tab: 'fill' } });
  }

  function clearStyle() {
    style = undefined;
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
  <div class="top-bar"><Tabs on:tabchange={handleTabChange} {selectedTab} />
    {#if selectedTab !== 'typography'}
    <button on:click={downloadSvg} class="download-button">Download SVG <div class="icon"><Fa icon={faDownload} /></div></button>
    {/if}
  </div>
    <TabsContent {selectedTab} {style} {updateBackgroundRect} {backgroundSvgData} />
    <button class="clear-style-button" on:click={clearStyle}>Clear style <div class="icon"><Fa icon={faTrash} /></div></button>
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

  button {
    margin: 0px;
    font-size: 0.9em;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
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
    align-self: center;
  }

  .clear-style-button {
    position: fixed;
    bottom: 12px;
    right: 12px;
    display: flex;
    align-items: center;
  }

  .icon {
    margin-left: 6px;
  }

  .top-bar {
    position: fixed;
    background-color: white;
    padding: var(--app-padding);
    width: calc(100% - (var(--app-padding) * 2));
    height: 36px;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
