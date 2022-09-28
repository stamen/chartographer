<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import Tooltip from './Tooltip.svelte';
  import { getColor } from './get-color';
  import {
    displayLayersStore,
    propertyValueComboLimitStore,
    svgStore,
  } from './stores';
  import { MIN_ZOOM, MAX_ZOOM, CHART_WIDTH, MARGIN } from './constants';
  import VirtualList from '@sveltejs/svelte-virtual-list';
  import FillDisplay from './FillDisplay.svelte';

  export let style;
  export let updateBackgroundRect;

  let backgroundRect;

  let chartHeight = $svgStore?.fills?.chartHeight;
  let xScale = $svgStore?.fills?.xScale;
  let yScale = $svgStore?.fills?.yScale;

  let rects = $svgStore?.fills?.svgs ?? [];
  let gradients = $svgStore?.fills?.gradients ?? [];

  let expandedLayers = $displayLayersStore?.layers ?? [];
  let limitHit = $displayLayersStore?.limitHit ?? [];

  let zoomLevels = d3.range(MIN_ZOOM, MAX_ZOOM + 1, 1);
  let scrollY = 0;

  $: tooltip = {};

  const handleTooltipClose = () => (tooltip = {});

  $: {
    style; // Make this block react to the style prop changing
    handleTooltipClose();
  }

  const initChart = () => {
    let layers = expandedLayers;

    chartHeight = layers.length * 65;

    xScale = d3.scaleLinear(
      [MIN_ZOOM, MAX_ZOOM],
      [MARGIN.left, CHART_WIDTH - MARGIN.right]
    );
    yScale = d3
      .scaleBand(
        layers.map(({ id }) => id),
        [MARGIN.top, chartHeight - MARGIN.bottom]
      )
      .padding(0.25);

    const getDrawLayer = layer => {
      const { color: layerColor, gradients: layerGradients } = getColor(
        layer,
        xScale
      );
      const { color, strokeColor, strokeWidth } = layerColor;
      // TODO Do we need this anymore?
      gradients = gradients.concat(layerGradients);

      return {
        ...layer,
        fill: color,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        gradients: layerGradients,
      };
    };

    layers = layers.map(getDrawLayer);

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
        gradients: d.gradients,
      };
    });

    backgroundRect = rects.find(rect => rect.layer.type === 'background');
    if (backgroundRect) {
      updateBackgroundRect(backgroundRect, backgroundRect.gradients[0]);
      rects = rects.filter(rect => rect.layer.type !== 'background');
    }

    svgStore.update(value => ({
      ...value,
      fills: { svgs: rects, gradients, chartHeight, yScale, xScale },
    }));
  };

  $: {
    if (expandedLayers && !rects.length) {
      initChart();
    }
  }

  let time = Date.now();
  onMount(() => {
    document.addEventListener('scroll', () => (scrollY = window.scrollY));
    console.log({ MOUNTED: Date.now() - time });
  });

  function handleClick(layer) {
    tooltip = {
      text: JSON.stringify(layer.paint, null, 2),
      left: xScale(MAX_ZOOM) + 10,
      top: yScale(layer.id) + yScale.bandwidth(),
    };
  }

  function handleTooltipWarning(layerId, expandedLayerId) {
    tooltip = {
      text: `${layerId} had too many possible property/value combinations and has been limited to showing ${$propertyValueComboLimitStore} for performance.`,
      left: 24,
      top: yScale(expandedLayerId) + yScale.bandwidth() * 0.75,
    };
  }

  let start;
  let end;
</script>

<div class="fills-chart">
  {#if backgroundRect}
    <div class="background-item">
      <FillDisplay
        item={backgroundRect}
        height={chartHeight}
        {handleTooltipClose}
        {handleTooltipWarning}
        {handleClick}
      />
    </div>
  {/if}
  <VirtualList items={rects} bind:start bind:end let:item>
    <div class="list-item">
      <FillDisplay
        {item}
        height={item.height}
        {handleTooltipClose}
        {handleTooltipWarning}
        {handleClick}
      />
    </div>
  </VirtualList>
  <!-- <svg>
    <g transform="translate(0, {MARGIN.top + scrollY})" class="x-axis">
      {#each zoomLevels as zoomLevel}
        <g
          class="tick"
          opacity="1"
          transform="translate({xScale(zoomLevel)}, 0)"
        >
          <text y="9">
            {zoomLevel}
          </text>
        </g>
      {/each}
    </g>
  </svg> -->

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
  .fills-chart {
    flex-grow: 1;
    width: 100vw;
  }

  .list-item {
    margin-top: 24px;
    background-color: transparent;
  }

  .background-item {
    position: fixed;
    z-index: -1000;
  }

  .x-axis text {
    font-size: 0.9em;
    text-anchor: middle;
  }

  .y-axis text {
    font-size: 0.9em;
  }
</style>
