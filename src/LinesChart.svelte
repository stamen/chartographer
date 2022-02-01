<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  export let style;
  export let minZoom = 0;
  export let maxZoom = 24;
  export let backgroundSvgData;

  const width = 1000;
  let height;
  const margin = {
    bottom: 25,
    left: 250,
    right: 50,
    top: 25
  };

  let gradients = [];
  $: tooltip = {};

  let xScale;
  let yScale;

  let scrollY = 0;

  let zoomLevels = [];

  let layers;

  let backgroundRect;

  function getColor(layer, xScale, yScale) {
    const lineStart = xScale(layer.minzoom || minZoom);
    const lineLength = xScale(layer.maxzoom || maxZoom) - xScale(layer.minzoom ||
      minZoom);

    let color;
    let opacity;
    let strokeColor;
    let strokeWidth = 0;
    switch (layer.type) {
      case 'fill': 
        color = layer.paint['fill-color'];
        opacity = layer.paint['fill-opacity'];
        strokeColor = layer.paint['fill-outline-color'];
        if (strokeColor) strokeWidth = 1;
        break;
      case 'background':
        color = layer.paint['background-color'];
        break;
      case 'line':
        color = layer.paint['line-color'];
        opacity = layer.paint['line-opacity'];
        break;
      case 'symbol':
        color = layer.paint ? layer.paint['text-color'] : 'black';
        opacity = layer.paint ? layer.paint['text-opacity'] : null;
        break;
      default: {}
    }

    let colorIsGradient = false;
    let opacityIsGradient = false;

    if (Array.isArray(color)) {
      const [expressionType, [interpolationType], [attribute]] = color;

      if (expressionType === 'interpolate' && interpolationType === 'linear' && attribute === 'zoom') {
        colorIsGradient = true;
      }
    }

    if (Array.isArray(opacity)) {
      const [expressionType, [interpolationType], [attribute]] = opacity;

      if (expressionType === 'interpolate' && interpolationType === 'linear' && attribute === 'zoom') {
        opacityIsGradient = true;
      }
    }

    const gradientStops = [];

    if (colorIsGradient) {
      const gradientArray = color.slice(3);

      for (let i = 0; i < gradientArray.length; i += 2) {
        const offset = ((xScale(gradientArray[i]) - lineStart) / lineLength) * 100;

        gradientStops.push({
          offset,
          stopColor: gradientArray[i + 1],
          stopOpacity: 1
        });
      }
    }

    if (opacityIsGradient && !colorIsGradient) {
      const gradientArray = opacity.slice(3);

      for (let i = 0; i < gradientArray.length; i += 2) {
        const offset = ((xScale(gradientArray[i]) - lineStart) / lineLength) * 100;
        gradientStops.push({
          offset,
          stopColor: color,
          stopOpacity: gradientArray[i + 1]
        });
      }
    }

    if (colorIsGradient && opacityIsGradient) {
      // TODO handle these cases
      console.log(layer.id, 'both color and opacity are gradients');
    }

    if (gradientStops.length > 1) {
      gradients = [
        ...gradients,
        {
          id: layer.id,
          stops: gradientStops.map(stop => ({
            offset: `${stop.offset}%`,
            stopColor: stop.stopColor,
            stopOpacity: stop.stopOpacity,
          }))
        }
      ];

      color = `url('#${layer.id}')`;
    }

    return { color, strokeColor, strokeWidth };
  }

  function getPath(layer, xScale, yScale) {
    const width = layer.paint ? layer.paint['line-width'] : null;
    const layerMaxZoom = layer.maxzoom || maxZoom;
    const layerMinZoom = layer.minzoom !== undefined ? layer.minzoom : minZoom;
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
          yScale(layer.id) + (yScale.bandwidth() / 2)
        ]);
        for (let i = 0; i < widthArray.length; i += 2) {
          const zoom = widthArray[i];
          const width = widthArray[i + 1];

          if (zoom < layerMinZoom) continue;

          topPoints.push([xScale(zoom), yScale(layer.id) - (width / 2) + yScale.bandwidth() / 2]);
          if (width > 0) {
            bottomPoints.push([xScale(zoom), yScale(layer.id) + (width / 2) + yScale.bandwidth() / 2]);
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

        topPoints.push([xScale(zoom), yScale(layer.id) - (width / 2) + yScale.bandwidth() / 2]);
        if (width > 0) {
          bottomPoints.push([xScale(zoom), yScale(layer.id) + (width / 2) + yScale.bandwidth() / 2]);
        }
      });

      [lastZoom, lastWidth] = width.stops.slice(-1)[0];
    }
    else if (!width) {
      let layerWidth = 1;
      topPoints.push([xScale(layerMinZoom), yScale(layer.id) - (layerWidth / 2) + yScale.bandwidth() / 2]);
      topPoints.push([xScale(layerMaxZoom), yScale(layer.id) - (layerWidth / 2) + yScale.bandwidth() / 2]);
      bottomPoints.push([xScale(layerMinZoom), yScale(layer.id) + (layerWidth / 2) + yScale.bandwidth() / 2]);
      bottomPoints.push([xScale(layerMaxZoom), yScale(layer.id) + (layerWidth / 2) + yScale.bandwidth() / 2]);
    }

    if (topPoints.length) {
      if (layerMaxZoom > lastZoom) {
        topPoints.push([xScale(layerMaxZoom), yScale(layer.id) - (lastWidth / 2) + yScale.bandwidth() / 2]);
        if (lastWidth > 0) {
          bottomPoints.push([xScale(layerMaxZoom), yScale(layer.id) + (lastWidth / 2) + yScale.bandwidth() / 2]);
        }
      }

      path = topPoints.concat(bottomPoints.reverse());
    }

    return path;
  }

  function getDrawLayer(layer, xScale, yScale) {

    const { color, strokeColor, strokeWidth } = getColor(layer, xScale, yScale);
    const path = getPath(layer, xScale, yScale);

    return {
      ...layer,
      path: d3.line()(path || []),
      fill: color,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
    };
  }

  $: if (style && style.layers) {
    const lineLayers = style.layers.filter(l => l.type === 'line');
    height = style.layers.length * 65;

    xScale = d3.scaleLinear([minZoom, maxZoom], [margin.left, width - margin.right]);
    yScale = d3.scaleBand(lineLayers.map(({ id }) => id), [margin.top, height - margin.bottom])
      .padding(0.25);

    zoomLevels = d3.range(minZoom, maxZoom + 1, 1);

    layers = lineLayers.map(l => getDrawLayer(l, xScale, yScale));

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
      left: xScale(maxZoom) + 10,
      top: yScale(layer.id) + yScale.bandwidth()
    };
  }
</script>

<div class="fills-chart">
  <svg {width} {height}>
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
          height={height - margin.top - margin.bottom}
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

    <g transform="translate(0, {margin.top + scrollY})" class="x-axis">
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
          {yScale(layer.id) + yScale.bandwidth() / 2})">
          <text y="9">
            {layer.id}
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
  .tooltip {
    background: white;
    border: 1px solid black;
    padding: 1em;
    position: absolute;
  }

  .x-axis text {
    font-size: 0.9em;
    text-anchor: middle;
  }

  .y-axis text {
    font-size: 0.9em;
  }
</style>
