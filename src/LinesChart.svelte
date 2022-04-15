<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import Tooltip from './Tooltip.svelte';
  import { getColor } from './get-color';
  import { gatherOutputs } from './gather-outputs';
  import { expandLayers } from './styles/expandLayers';
  import { MIN_ZOOM, MAX_ZOOM, CHART_WIDTH, MARGIN } from './constants';

  export let style;
  export let backgroundSvgData;

  let chartHeight;

  let gradients = [];
  $: tooltip = {};

  const handleTooltipClose = () => tooltip = {};

  $: {
    style; // Make this block react to the style prop changing
    handleTooltipClose();
  }

  let xScale;
  let yScale;
  let adjustedYScale;

  let scrollY = 0;

  let zoomLevels = [];

  let layers;

  let backgroundRect;

  // Returns the largest width a line reaches within an expression
  function getFullLineWidth(layer) {
    const lineWidth = layer?.paint?.['line-width'];
    if (!lineWidth) return 1;
    return Math.max(...gatherOutputs(lineWidth))
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
      const [expressionType, [interpolationType, interpolationBase], [attribute]] = width;
      if (expressionType === 'interpolate' && interpolationType === 'linear' && attribute === 'zoom') {
        // TODO look into base for interpolation

        const widthArray = width.slice(3);
        topPoints.push([
          xScale(layerMinZoom),
          adjustedYScale(layer.id) + (yScale.bandwidth() / 2)
        ]);
        for (let i = 0; i < widthArray.length; i += 2) {
          const zoom = widthArray[i];
          const width = widthArray[i + 1];

          if (zoom < layerMinZoom) continue;

          topPoints.push([xScale(zoom), adjustedYScale(layer.id) - (width / 2) + yScale.bandwidth() / 2]);
          if (width > 0) {
            bottomPoints.push([xScale(zoom), adjustedYScale(layer.id) + (width / 2) + yScale.bandwidth() / 2]);
          }
        }

        [lastZoom, lastWidth] = widthArray.slice(-2);
      }
      else if (interpolationType === 'exponential') {
        // TODO create scale, sample zoom levels, create points
      }
      else {
        console.log('array but not linear', width);
      }
    }
    else if (width && width.stops) {
      width.stops.forEach(stop => {
        const [zoom, width] = stop;

        topPoints.push([xScale(zoom), adjustedYScale(layer.id) - (width / 2) + yScale.bandwidth() / 2]);
        if (width > 0) {
          bottomPoints.push([xScale(zoom), adjustedYScale(layer.id) + (width / 2) + yScale.bandwidth() / 2]);
        }
      });

      [lastZoom, lastWidth] = width.stops.slice(-1)[0];
    }
    else if (!width) {
      let layerWidth = 1;
      topPoints.push([xScale(layerMinZoom), adjustedYScale(layer.id) - (layerWidth / 2) + yScale.bandwidth() / 2]);
      topPoints.push([xScale(layerMaxZoom), adjustedYScale(layer.id) - (layerWidth / 2) + yScale.bandwidth() / 2]);
      bottomPoints.push([xScale(layerMinZoom), adjustedYScale(layer.id) + (layerWidth / 2) + yScale.bandwidth() / 2]);
      bottomPoints.push([xScale(layerMaxZoom), adjustedYScale(layer.id) + (layerWidth / 2) + yScale.bandwidth() / 2]);
    }

    if (topPoints.length) {
      if (layerMaxZoom > lastZoom) {
        topPoints.push([xScale(layerMaxZoom), adjustedYScale(layer.id) - (lastWidth / 2) + yScale.bandwidth() / 2]);
        if (lastWidth > 0) {
          bottomPoints.push([xScale(layerMaxZoom), adjustedYScale(layer.id) + (lastWidth / 2) + yScale.bandwidth() / 2]);
        }
      }

      path = topPoints.concat(bottomPoints.reverse());
    }

    return path;
  }

  const getDrawLayer = (layer) => {
    const { color: layerColor, gradients: layerGradients } = getColor(layer, xScale);
    const { color, strokeColor, strokeWidth } = layerColor;
    gradients = gradients.concat(layerGradients);
    const path = getPath(layer);

    return {
      ...layer,
      path: d3.line()(path || []),
      fill: color,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
    };
  };

  $: if (style && style.layers) {
    let lineLayers = style.layers.filter(l => l.type === 'line');
    lineLayers = expandLayers(lineLayers);
    
    chartHeight = lineLayers.length * 65;

    xScale = d3.scaleLinear([MIN_ZOOM, MAX_ZOOM], [MARGIN.left, CHART_WIDTH - MARGIN.right]);
    yScale = d3.scaleBand(lineLayers.map(({ id }) => id), [MARGIN.top, chartHeight - MARGIN.bottom])
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
      const prevLineWidth = lineLayers[i - 1] ? getFullLineWidth(lineLayers[i - 1]) : 1;
      const currentLineWidth = getFullLineWidth(l);
      yOffset += prevLineWidth / 2 + currentLineWidth / 2;
      const nextPlacement = placement + yOffset;
      yScaleObj[l.id] = nextPlacement;
    }

    // Adjust the height to account for the increased offsets
    chartHeight = chartHeight + yOffset;

    // Adjusted yScale function to use throughout
    adjustedYScale = (layerId) => yScaleObj[layerId];    

    zoomLevels = d3.range(MIN_ZOOM, MAX_ZOOM + 1, 1);

    layers = lineLayers.map(getDrawLayer);

    backgroundRect = backgroundSvgData.rect;
    if (backgroundSvgData.gradientDefs) {
      gradients.push(backgroundSvgData.gradientDefs);
    }
  }

  onMount(() => {
    document.addEventListener('scroll', () => scrollY = window.scrollY);
  });

  function handleClick(layer) {
    tooltip = {
      text: JSON.stringify(layer.paint, null, 2),
      left: xScale(MAX_ZOOM) + 10,
      top: adjustedYScale(layer.id) + yScale.bandwidth()
    };
  }

</script>

<div class="fills-chart">
  <svg id="lines" width={CHART_WIDTH} height={chartHeight}>
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
      {#each layers as layer}
        <path
          d={layer.path}
          fill={layer.fill}
          stroke={layer.stroke}
          strokeWidth={layer.strokeWidth}
          on:click={() => handleClick(layer)}
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
      {#each layers as layer} 
        <g class="tick" opacity="1" transform="translate(0,
          {adjustedYScale(layer.id) + yScale.bandwidth() / 2})">
          <text y="9">
            {layer.id}
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
