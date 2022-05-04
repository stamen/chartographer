<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import Tooltip from './Tooltip.svelte';
  import { getColor } from './get-color';
  import { expandLayers } from './styles/expandLayers-2';
  import { MIN_ZOOM, MAX_ZOOM, CHART_WIDTH, MARGIN } from './constants';

  export let style;
  export let updateBackgroundRect;

  let chartHeight;

  let rects = [];
  let gradients = [];
  $: tooltip = {};

  const handleTooltipClose = () => tooltip = {};

  $: {
    style; // Make this block react to the style prop changing
    handleTooltipClose();
  }

  let xScale;
  let yScale;

  let scrollY = 0;

  let zoomLevels = [];

  $: if (style && style.layers) {
    let layers = style.layers;
    layers = expandLayers(layers);
    
    chartHeight = layers.length * 65;

    xScale = d3.scaleLinear([MIN_ZOOM, MAX_ZOOM], [MARGIN.left, CHART_WIDTH - MARGIN.right]);
    yScale = d3.scaleBand(layers.map(({ id }) => id), [MARGIN.top, chartHeight - MARGIN.bottom])
      .padding(0.25);

    zoomLevels = d3.range(MIN_ZOOM, MAX_ZOOM + 1, 1);

    const getDrawLayer = (layer) => {
      const { color: layerColor, gradients: layerGradients } = getColor(layer, xScale);
      const { color, strokeColor, strokeWidth } = layerColor;
      gradients = gradients.concat(layerGradients);

      return {
        ...layer,
        fill: color,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
      };
    };

    layers = layers.map(getDrawLayer)

    // TODO consider combining casing with roads
    rects = layers.map(d => {
      return {
        x: xScale(d.minzoom || MIN_ZOOM),
        y: yScale(d.id),
        height: yScale.bandwidth(),
        width: xScale(d.maxzoom || MAX_ZOOM) - xScale(d.minzoom || MIN_ZOOM),
        fill: d.fill,
        stroke: d.stroke,
        strokeWidth: d.strokeWidth,
        layer: d,
      };
    });

    const backgroundRect = rects.find(rect => rect.layer.type === 'background');
    if (backgroundRect) {
      const backgroundGradient = gradients.find(g => g.id === backgroundRect.layer.id);
      updateBackgroundRect(backgroundRect, backgroundGradient);
    }
  }

  onMount(() => {
    document.addEventListener('scroll', () => scrollY = window.scrollY);
  });

  function handleClick(layer) {
    tooltip = {
      text: JSON.stringify(layer.paint, null, 2),
      left: xScale(MAX_ZOOM) + 10,
      top: yScale(layer.id) + yScale.bandwidth()
    };
  }
</script>

<div class="fills-chart">
  <svg id="fill" width={CHART_WIDTH} height={chartHeight}>
    <defs>
      {#each gradients as gradient}
        <linearGradient id={gradient.id}>
          {#each gradient.stops as stop}
            <stop
              offset={stop.offset}
              stop-color={stop.stopColor}
              stop-opacity={stop.stopOpacity}
            />
          {/each}
        </linearGradient>
      {/each}
    </defs>
    <g>
      {#each rects as rect}
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.layer.type === 'background' ? chartHeight - MARGIN.top - MARGIN.bottom : rect.height}
          fill={rect.fill}
          stroke={rect.stroke}
          strokeWidth={rect.strokeWidth}
          rx="20"
          on:click={() => handleClick(rect.layer)}
        />
      {/each}
    </g>

    <g transform="translate(0, {MARGIN.top + scrollY})" class="x-axis">
      {#each zoomLevels as zoomLevel} 
        <g class="tick" opacity="1" transform="translate({xScale(zoomLevel)}, 0)">
          <text y="9">
            {zoomLevel}
          </text>
        </g>
      {/each}
    </g>

    <g transform="translate(0, 0)" class="y-axis">
      {#each rects as rect} 
        <g class="tick" opacity="1" transform="translate(0,
          {yScale(rect.layer.id) + yScale.bandwidth() / 2})">
          <text y="9">
            {rect.layer.id}
          </text>
        </g>
      {/each}
    </g>
  </svg>

  {#if Object.keys(tooltip).length > 0}
    <Tooltip
      left={tooltip.left}
      top={tooltip.top}
      on:close={handleTooltipClose}
    >
      {tooltip.text || ''}
    </Tooltip>
  {/if}
</div>

<style>
  .x-axis text {
    font-size: 0.9em;
    text-anchor: middle;
  }

  .y-axis text {
    font-size: 0.9em;
  }
</style>
