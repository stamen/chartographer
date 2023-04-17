<script>
  import * as d3 from 'd3';
  import {
    migrate as migrateMapbox,
    validate,
  } from '@mapbox/mapbox-gl-style-spec';
  import { migrate as migrateMaplibre } from '@maplibre/maplibre-gl-style-spec';
  import Fa from 'svelte-fa/src/fa.svelte';
  import { faTrash, faDownload } from '@fortawesome/free-solid-svg-icons';
  import { Circle } from 'svelte-loading-spinners';
  import { readQuery, writeQuery } from './query';
  import Tabs from './Tabs.svelte';
  import TabsContent from './TabsContent.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import CustomUrlInput from './CustomUrlInput.svelte';
  import computedStyleToInlineStyle from 'computed-style-to-inline-style';
  import { convertStylesheetToRgb } from './convert-colors';
  import {
    loadingStore,
    displayLayersStore,
    displayLayersStoreInitialState,
    svgStore,
    svgStoreInitialState,
    styleStore,
  } from './stores';
  import ExpandLayersWorker from 'web-worker:./expand-layers-worker.js';
  import { stylesEqual } from './styles/styles-equal';
  import RendererSelect from './RendererSelect.svelte';

  export let selectedTab;
  export let style;
  export let loadDefaultStyle = false;

  let url;

  let isLoading;
  let loadingProgress;
  loadingStore.subscribe(value => {
    isLoading = value.loading;
    loadingProgress = value.progress;
  });

  let expandedLayers = [];
  displayLayersStore.subscribe(value => {
    expandedLayers = value.layers;
  });

  const initializeVarsFromHash = () => {
    const query = readQuery();
    if (query.selectedTab) {
      selectedTab = query.selectedTab;
    } else {
      selectedTab = 'fill';
    }

    if (query.url) {
      url = decodeURIComponent(query.url);
    }

    if (loadDefaultStyle) {
      loadStyleUrl('./style.json');
    }
  };

  // Update variables before mount from hash so
  // onMount works as expected in downstream components
  initializeVarsFromHash();

  const setExpandedLayers = style => {
    const { layers } = style;
    const worker = new ExpandLayersWorker();
    worker.postMessage(layers);
    worker.addEventListener('message', event => {
      const { progress, expandedLayers, limitedExpandedLayerIds } = event.data;
      loadingStore.update(v => ({ ...v, progress }));
      if (expandedLayers) {
        displayLayersStore.set({
          style,
          layers: expandedLayers,
          limitHit: limitedExpandedLayerIds,
        });
      }
    });
  };

  function getState() {
    let state = {};
    if (selectedTab) state.selectedTab = selectedTab;
    if (url) state.url = url;
    return state;
  }

  function updateQuery() {
    writeQuery(getState());
  }

  async function loadStyleUrl(url) {
    style = await d3.json(url);
  }

  function revertTab() {
    handleTabChange({ detail: { tab: 'fill' } });
  }

  function handleTabChange(e) {
    selectedTab = e.detail.tab;
    updateQuery();
    window.scrollTo(0, 0);
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDragEnter(e) {
    e.preventDefault();
  }

  function setStyle(nextStyle, nextUrl) {
    // try to migrate w/ Mapbox, then try with MapLibre if that fails
    try {
      style = migrateMapbox(nextStyle);
    } catch (e) {
      try {
        style = migrateMaplibre(nextStyle);
      } catch (err) {
        console.warn(e);
        console.warn(err);
      }
    }

    style = convertStylesheetToRgb(style);
    url = nextUrl;

    // On dropping in a style, switch to the fill tab to refresh background layer state
    handleTabChange({ detail: { tab: 'fill' } });
  }

  async function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    const { files } = e.dataTransfer;
    const text = await files[0].text();
    setStyle(JSON.parse(text));
  }

  function clearStyle() {
    style = undefined;
    url = undefined;
    displayLayersStore.set(displayLayersStoreInitialState);
    svgStore.set(svgStoreInitialState);
  }

  function downloadSvg() {
    let svg = document.getElementById(selectedTab);

    computedStyleToInlineStyle(svg, {
      recursive: true,
      // Limiting to these properties for now since the function runs much faster
      properties: ['font-size', 'font-family', 'text-anchor'],
    });

    svg = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svg]);
    const element = document.createElement('a');
    element.download = `${style.id}-${selectedTab}-chart.svg`;
    element.href = window.URL.createObjectURL(blob);
    element.click();
    element.remove();
  }

  $: if (style) {
    displayLayersStore.set(displayLayersStoreInitialState);
    svgStore.set(svgStoreInitialState);
    loadingStore.set({ loading: true, progress: 0 });
    setExpandedLayers(style);
  }

  $: if (expandedLayers.length) {
    // Let progress hit 100%, then brief timeout before moving on
    // This lets fast style loads feel smoother with loading
    loadingStore.update(v => ({ ...v, progress: 1 }));
    setTimeout(() => loadingStore.set({ loading: false, progress: null }), 250);
  }

  const handleCustomUrl = e => {
    let { style: nextStyle, url: nextUrl } = e.detail;
    if (stylesEqual(style, nextStyle)) return;
    setStyle(nextStyle, nextUrl);
  };

  $: styleStore.set({ url, style });

  $: if (url) {
    updateQuery();
  }
</script>

<main
  on:dragover={handleDragOver}
  on:dragover={handleDragEnter}
  on:drop={handleDrop}
>
  <div class="top-bar">
    {#if expandedLayers.length}
      <Tabs on:tabchange={handleTabChange} {selectedTab} />
      {#if selectedTab !== 'typography'}
        <button
          on:click={downloadSvg}
          class="download-button"
          disabled={isLoading}
          >Download SVG <div class="icon"><Fa icon={faDownload} /></div></button
        >
      {/if}
    {:else}
      <div />
    {/if}
    <div class="right-side-container">
      {#if selectedTab === 'typography' && style}
        <div class="renderer-switch-container">
          <RendererSelect />
        </div>
      {/if}
      <div class="custom-url-input">
        <CustomUrlInput
          on:styleload={handleCustomUrl}
          activeStyle={style}
          activeUrl={url}
          disabled={isLoading && loadingProgress !== null}
        />
      </div>
    </div>
  </div>
  {#if expandedLayers.length}
    <TabsContent {selectedTab} {style} on:revertPage={revertTab} />
    <button class="clear-style-button" on:click={clearStyle}
      >Clear style <div class="icon"><Fa icon={faTrash} /></div></button
    >
  {:else if !isLoading}
    <div class="drop">
      <div>Drop a style here</div>
    </div>
  {/if}
  {#if isLoading}
    {#if loadingProgress !== null}
      <div class="loading-screen">
        <ProgressBar progress={loadingProgress} />
      </div>
    {:else}
      <div class="mini-loader"><Circle size={36} color="#FFFFFF" /></div>
    {/if}
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

  .custom-url-input {
    position: relative;
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
    position: fixed;
    /* Takes into account the top bar + additional 12px */
    top: calc(36px + 12px + var(--app-padding) * 2);
    right: 12px;
    display: flex;
    align-items: center;
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

  .loading-screen {
    position: fixed;
    height: 100%;
    width: 100%;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
  }

  .mini-loader {
    position: fixed;
    top: calc(36px + (var(--app-padding) * 2));
    right: 0px;
    margin: 36px;
  }

  .right-side-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .renderer-switch-container {
    margin-right: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
