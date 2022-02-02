<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import { getValue as getNumericValue } from './interpolation/numeric';
  import { getValue as getColorValue } from './interpolation/color';

  export let style;
  export let minZoom = 0;
  export let maxZoom = 24;

  const width = 1400;
  let height;
  const margin = {
    bottom: 25,
    left: 50,
    right: 50,
    top: 50
  };
  let xScale;
  let yScale;
  let tooltip = {};
  let scrollY = 0;

  let layers;
  let zooms = d3.range(minZoom, maxZoom + 1, 2);

  // TODO layout.text-line-height
  // TODO layout.max-width
  // TODO layout.letter-spacing
  // TODO paint.text-halo-blur

  function getSize(layer, zoom) {
    if (!layer.layout) return 10;
    if (layer.id === 'public_complexes') {
      console.log(layer);
    }
    let size = layer.layout['text-size'];
    return getNumericValue(size, zoom);
  }

  function getFont(layer, zoom) {
    // TODO and also peek into the file and load the font?
  }

  function getStroke(layer, zoom) {
    if (!layer.paint) return '';
    let color = layer.paint['text-halo-color'];
    return getColorValue(color, zoom, '');
  }

  function getStrokeWidth(layer, zoom) {
    if (!layer.paint) return 0;
    let width = layer.paint['text-halo-width'];
    return getNumericValue(width, zoom);
  }

  function getColor(layer, zoom) {
    if (!layer.paint) return 'red';
    let color = layer.paint['text-color'];
    return getColorValue(color, zoom, 'red');
  }

  function isValidZoom(layer, zoom) {
    if (layer.minzoom && zoom < layer.minzoom) return false;
    if (layer.maxzoom && zoom > layer.maxzoom) return false;
    return true;
  }

  function handleClick(layer) {
    tooltip = {
      text: JSON.stringify({
        layout: layer.layout,
        paint: layer.paint,
      }, null, 2),
      left: xScale(maxZoom) + 10,
      top: yScale(layer.id) + yScale.bandwidth()
    };
  }

  $: {
    layers = style.layers.filter(layer => layer.type === 'symbol');
    height = layers.length * 25;
    xScale = d3.scaleLinear([minZoom, maxZoom], [margin.left, width - margin.right]);
    yScale = d3.scaleBand(layers.map(({ id }) => id), [margin.top, height - margin.bottom])
  }

  onMount(() => {
    document.addEventListener('scroll', () => scrollY = window.scrollY);
  });
</script>

<div class="typography-chart">
  <svg {width} {height}>
    <g>
      {#each layers as layer}
        <g>
          {#each zooms as zoom}
            {#if isValidZoom(layer, zoom)}
              <text
                class="label-text"
                x={xScale(zoom)}
                y={yScale(layer.id)}
                fill={getColor(layer, zoom)}
                stroke={getStroke(layer, zoom)}
                stroke-width={`${getStrokeWidth(layer, zoom)}px`}
                font-size={`${getSize(layer, zoom)}px`}
                on:click={() => handleClick(layer)}
              >
                {layer.id}
              </text>
            {/if}
          {/each}
        </g>
      {/each}
    </g>

    <g transform="translate(0, {margin.top / 2 + scrollY})" class="x-axis">
      {#each zooms as zoom} 
        <g class="tick" opacity="1" transform="translate({xScale(zoom)}, 0)">
          <text y="9">
            {zoom}
          </text>
        </g>
      {/each}
    </g>
  </svg>

  <div class="tooltip" style="display: {Object.keys(tooltip).length > 0 ?
    'block': 'visible'}; left: {tooltip.left ? tooltip.left : -1000}px; top: {tooltip.top}px;">
    <pre>
      <code>
        {tooltip.text || ''}
      </code>
    </pre>
  </div>
</div>

<style>
  .label-text {
    text-anchor: middle;
  }

  .x-axis .tick {
    text-anchor: middle;
    font-size: 0.9em;
  }

  .tooltip {
    background: white;
    border: 1px solid black;
    padding: 1em;
    position: absolute;
  }
</style>
