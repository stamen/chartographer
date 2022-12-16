<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import Tooltip from './Tooltip.svelte';
  import { getColor } from './get-color';
  import { gatherOutputs } from './gather-outputs';
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

  let chartHeight = $svgStore?.lines?.chartHeight;
  let yScale = $svgStore?.lines?.yScale;
  let adjustedYScale = $svgStore?.lines?.adjustedYScale;

  let gradients = $svgStore?.lines?.gradients ?? [];
  let svgLayers = $svgStore?.lines?.svgs ?? [];
  // TODO we should pull the background rectangle without relying on the fills chart
  let backgroundRect =
    $svgStore?.lines?.background ?? $svgStore?.fills?.background;

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
  $: gradientChunks = displayChunks
    .concat([backgroundRect])
    .filter(Boolean)
    .map(c => c.gradients)
    .flat(Infinity);

  $: tooltip = {};

  const handleTooltipClose = () => (tooltip = {});

  $: {
    style; // Make this block react to the style prop changing
    handleTooltipClose();
  }

  // Returns the largest width a line reaches within an expression
  function getFullLineWidth(layer) {
    const lineWidth = layer?.paint?.['line-width'];
    if (!lineWidth) return 1;

    let outputs = gatherOutputs(lineWidth);

    if (!outputs.every(output => typeof output === 'number')) {
      console.warn(
        'Outputs of line-width expression contain non-numerical values. This indicates a problem in expanding layers.'
      );
      outputs = [1];
    }
    return Math.max(...outputs);
  }

  function getPath(layer) {
    const width = layer.paint ? layer.paint['line-width'] : null;
    const layerMaxZoom = layer.maxzoom || MAX_ZOOM;
    const layerMinZoom = layer.minzoom !== undefined ? layer.minzoom : MIN_ZOOM;
    const topPoints = [];
    const bottomPoints = [];
    let lastZoom;
    let lastWidth;
    let path;

    if (Array.isArray(width)) {
      const [
        expressionType,
        [interpolationType, interpolationBase],
        [attribute],
      ] = width;
      if (
        expressionType === 'interpolate' &&
        interpolationType === 'linear' &&
        attribute === 'zoom'
      ) {
        // TODO look into base for interpolation

        const widthArray = width.slice(3);
        topPoints.push([
          xScale(layerMinZoom),
          adjustedYScale(layer.id) + yScale.bandwidth() / 2,
        ]);
        for (let i = 0; i < widthArray.length; i += 2) {
          const zoom = widthArray[i];
          const width = widthArray[i + 1];

          if (zoom < layerMinZoom) continue;

          topPoints.push([
            xScale(zoom),
            adjustedYScale(layer.id) - width / 2 + yScale.bandwidth() / 2,
          ]);
          if (width > 0) {
            bottomPoints.push([
              xScale(zoom),
              adjustedYScale(layer.id) + width / 2 + yScale.bandwidth() / 2,
            ]);
          }
        }

        [lastZoom, lastWidth] = widthArray.slice(-2);
      } else if (interpolationType === 'exponential') {
        // TODO create scale, sample zoom levels, create points
      } else {
        console.log('array but not linear', width);
      }
    } else if (width && width.stops) {
      width.stops.forEach(stop => {
        const [zoom, width] = stop;

        topPoints.push([
          xScale(zoom),
          adjustedYScale(layer.id) - width / 2 + yScale.bandwidth() / 2,
        ]);
        if (width > 0) {
          bottomPoints.push([
            xScale(zoom),
            adjustedYScale(layer.id) + width / 2 + yScale.bandwidth() / 2,
          ]);
        }
      });

      [lastZoom, lastWidth] = width.stops.slice(-1)[0];
    } else if (!width) {
      let layerWidth = 1;
      topPoints.push([
        xScale(layerMinZoom),
        adjustedYScale(layer.id) - layerWidth / 2 + yScale.bandwidth() / 2,
      ]);
      topPoints.push([
        xScale(layerMaxZoom),
        adjustedYScale(layer.id) - layerWidth / 2 + yScale.bandwidth() / 2,
      ]);
      bottomPoints.push([
        xScale(layerMinZoom),
        adjustedYScale(layer.id) + layerWidth / 2 + yScale.bandwidth() / 2,
      ]);
      bottomPoints.push([
        xScale(layerMaxZoom),
        adjustedYScale(layer.id) + layerWidth / 2 + yScale.bandwidth() / 2,
      ]);
    }

    if (topPoints.length) {
      if (layerMaxZoom > lastZoom) {
        topPoints.push([
          xScale(layerMaxZoom),
          adjustedYScale(layer.id) - lastWidth / 2 + yScale.bandwidth() / 2,
        ]);
        if (lastWidth > 0) {
          bottomPoints.push([
            xScale(layerMaxZoom),
            adjustedYScale(layer.id) + lastWidth / 2 + yScale.bandwidth() / 2,
          ]);
        }
      }

      path = topPoints.concat(bottomPoints.reverse());
    }

    return path;
  }

  const getDrawLayer = layer => {
    const { color: layerColor, gradients: layerGradients } = getColor(
      layer,
      xScale
    );
    const { color, strokeColor, strokeWidth } = layerColor;
    gradients = gradients.concat(layerGradients);
    const path = getPath(layer);

    return {
      ...layer,
      path: d3.line()(path || []),
      fill: color,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      gradients: layerGradients,
    };
  };

  const initChart = () => {
    let lineLayers = expandedLayers.filter(l => l.type === 'line');

    chartHeight = lineLayers.length * 65;

    yScale = d3
      .scaleBand(
        lineLayers.map(({ id }) => id),
        [MARGIN.top, chartHeight - MARGIN.bottom]
      )
      .padding(0.25);

    // Adjust the yScale to account for layer width since D3 scaleBand spaces evenly
    const yScaleObj = lineLayers.reduce((acc, l) => {
      acc[l.id] = yScale(l.id);
      return acc;
    }, {});

    let yOffset = 0;

    for (let i = 0; i < lineLayers.length; i++) {
      const l = lineLayers[i];
      let placement = yScaleObj[l.id];
      const prevLineWidth = lineLayers[i - 1]
        ? getFullLineWidth(lineLayers[i - 1])
        : 1;

      yOffset += prevLineWidth / 2;

      const currentLineWidth = getFullLineWidth(l);

      const textMultiplier = 18;
      // Determine the previous label height by splitting the id up as it will be stacked and multiplying by text height
      const prevLabelHeight = lineLayers[i - 1]
        ? Math.max(0, lineLayers[i - 1].id.split('/').length - 1) *
          textMultiplier
        : 0;

      if (prevLabelHeight > currentLineWidth) {
        yOffset += prevLabelHeight;
      } else {
        yOffset += currentLineWidth / 2;
      }

      const nextPlacement = placement + yOffset;
      yScaleObj[l.id] = nextPlacement;

      if (i === lineLayers.length - 1) {
        yOffset += l.id.split('/').length * textMultiplier;
      }
    }

    // Adjust the height to account for the increased offsets
    chartHeight = chartHeight + yOffset;

    // Adjusted yScale function to use throughout
    adjustedYScale = layerId => yScaleObj[layerId];

    svgLayers = lineLayers.map(getDrawLayer);

    backgroundRect = $svgStore?.fills?.background;
    if (backgroundRect?.gradients?.length) {
      gradients = gradients.concat(backgroundRect.gradients);
    }

    svgStore.update(value => ({
      ...value,
      lines: {
        svgs: svgLayers,
        gradients,
        background: backgroundRect,
        chartHeight,
        yScale,
        adjustedYScale,
      },
    }));

    displayChunks = svgLayers.slice(0, DISPLAY_CHUNK_SIZE);
  };

  $: if (expandedLayers && !svgLayers.length) {
    initChart();
  }

  onMount(() => {
    document.addEventListener('scroll', () => (scrollY = window.scrollY));
  });

  function handleClick(layer) {
    tooltip = {
      text: JSON.stringify(layer.paint, null, 2),
      left: xScale(MAX_ZOOM) + 10,
      top: adjustedYScale(layer.id) + yScale.bandwidth(),
    };
  }

  function handleTooltipWarning(layerId, expandedLayerId) {
    tooltip = {
      text: `${layerId} had too many possible property/value combinations and has been limited to showing ${$propertyValueComboLimitStore} for performance.`,
      left: 24,
      top: adjustedYScale(expandedLayerId) + yScale.bandwidth() * 0.75,
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
  <svg id="lines" width={CHART_WIDTH} height={chartHeight}>
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
      {#each displayChunks as layer, index (layer.id)}
        <SlotWrapper {index} on:load={e => expandDisplayChunks(e.detail)}>
          <path
            d={layer.path}
            fill={layer.fill}
            stroke={layer.stroke}
            strokeWidth={layer.strokeWidth}
            on:click={() => handleClick(layer)}
          />
          <g
            class="y-axis tick"
            opacity="1"
            transform="translate(0,
          {adjustedYScale(layer.id) + yScale.bandwidth() / 2})"
          >
            {#each layer.id.split('/') as idSection, i}<g>
                {#if i === 0 && limitHit.includes(idSection)}
                  <circle
                    cx="6"
                    cy="-6"
                    r="6"
                    fill="red"
                    on:mouseover={() =>
                      handleTooltipWarning(idSection, layer.id)}
                    on:mouseout={handleTooltipClose}
                  />
                {/if}
                <text
                  y={18 * i}
                  x={(i > 0 ? 18 : 0) + limitHit.includes(idSection) ? 18 : 0}
                  >{#if i > 0}↳{/if}{idSection}</text
                >
              </g>
            {/each}
          </g>
        </SlotWrapper>
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
