<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import Tooltip from './Tooltip.svelte';
  import { getColor } from './get-color';
  import {
    displayLayersStore,
    propertyValueComboLimitStore,
    svgStore,
    loadingStore,
  } from './stores';
  import {
    MIN_ZOOM,
    MAX_ZOOM,
    CHART_WIDTH,
    MARGIN,
    DISPLAY_CHUNK_SIZE,
  } from './constants';
  import SlotWrapper from './SlotWrapper.svelte';

  export let style;

  let chartHeight = $svgStore?.fills?.chartHeight;
  let yScale = $svgStore?.fills?.yScale;

  let gradients = $svgStore?.fills?.gradients ?? [];
  let svgLayers = $svgStore?.fills?.svgs ?? [];
  let backgroundRect = $svgStore?.fills?.background;

  let expandedLayers = $displayLayersStore?.layers ?? [];
  let limitHit = $displayLayersStore?.limitHit ?? [];

  let zoomLevels = d3.range(MIN_ZOOM, MAX_ZOOM + 1, 1);
  let scrollY = 0;

  let xScale = d3.scaleLinear(
    [MIN_ZOOM, MAX_ZOOM],
    [MARGIN.left, CHART_WIDTH - MARGIN.right]
  );

  // Render in chunks of 100 to prevent blocking render
  let displayChunks = svgLayers.length
    ? svgLayers.slice(0, DISPLAY_CHUNK_SIZE)
    : [];
  $: gradientChunks = displayChunks.map(c => c.gradients).flat(Infinity);

  $: tooltip = {};

  const handleTooltipClose = () => (tooltip = {});

  $: {
    style; // Make this block react to the style prop changing
    handleTooltipClose();
  }

  const initChart = () => {
    let layers = expandedLayers;

    chartHeight = layers.length * 65;

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
    svgLayers = layers.map(d => {
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

    backgroundRect = svgLayers.find(rect => rect.layer.type === 'background');

    svgStore.update(value => ({
      ...value,
      fills: {
        background: backgroundRect,
        svgs: svgLayers,
        gradients,
        chartHeight,
        yScale,
      },
    }));

    displayChunks = svgLayers.slice(0, DISPLAY_CHUNK_SIZE);
  };

  $: {
    if (expandedLayers && !svgLayers.length) {
      initChart();
    }
  }

  onMount(() => {
    document.addEventListener('scroll', () => (scrollY = window.scrollY));
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

  const expandDisplayChunks = index => {
    const hitChunkIndex = index !== 0 && index % (DISPLAY_CHUNK_SIZE - 1) === 0;
    const hitLayerLength = index === svgLayers.length - 1;
    if (hitChunkIndex || hitLayerLength) {
      setTimeout(
        () =>
          (displayChunks = svgLayers.slice(0, index + 1 + DISPLAY_CHUNK_SIZE)),
        250
      );
    }
  };

  const setNonBlockingLoader = (displayLen, actualLen) => {
    const isLoading = displayLen < actualLen;
    if (isLoading === $loadingStore.loading) return;
    if (isLoading) {
      loadingStore.set({ loading: true, progress: null });
    } else {
      loadingStore.set({ loading: false, progress: null });
    }
  };

  $: setNonBlockingLoader(displayChunks.length, svgLayers.length);
</script>

<div class="fills-chart">
  <svg id="fill" width={CHART_WIDTH} height={chartHeight}>
    <defs>
      {#each gradientChunks as gradient (gradient.id)}
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
      {#if backgroundRect}
        <rect
          x={backgroundRect.x}
          y={backgroundRect.y}
          width={backgroundRect.width}
          height={chartHeight - MARGIN.top - MARGIN.bottom}
          fill={backgroundRect.fill}
          stroke={backgroundRect.stroke}
          strokeWidth={backgroundRect.strokeWidth}
          rx="20"
        />
      {/if}
      {#each displayChunks as rect, index (rect.layer.id)}
        <SlotWrapper {index} on:load={e => expandDisplayChunks(e.detail)}>
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={rect.fill}
            stroke={rect.stroke}
            strokeWidth={rect.strokeWidth}
            rx="20"
            on:click={() => handleClick(rect.layer)}
          />
          <g
            class="y-axis tick"
            opacity="1"
            transform="translate(0,
        {yScale(rect.layer.id) + yScale.bandwidth() / 2})"
          >
            {#each rect.layer.id.split('/') as idSection, i}<g>
                {#if i === 0 && limitHit.includes(idSection)}
                  <circle
                    cx="6"
                    cy="-6"
                    r="6"
                    fill="red"
                    on:mouseover={() =>
                      handleTooltipWarning(idSection, rect.layer.id)}
                    on:mouseout={handleTooltipClose}
                  />
                {/if}
                <text
                  y={18 * i}
                  x={(i > 0 ? 18 : 0) + limitHit.includes(idSection) ? 18 : 0}
                >
                  {#if i > 0}↳{/if}

                  {idSection}</text
                ></g
              >
            {/each}
          </g></SlotWrapper
        >
      {/each}
    </g>

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
