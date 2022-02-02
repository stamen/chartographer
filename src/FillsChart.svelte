<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  export let style;
  export let minZoom = 0;
  export let maxZoom = 24;
  export let updateBackgroundRect;

  const width = 1000;
  let height;
  const margin = {
    bottom: 25,
    left: 250,
    right: 50,
    top: 25
  };

  let rects = [];
  let gradients = [];
  $: tooltip = {};

  let xScale;
  let yScale;

  let scrollY = 0;

  let zoomLevels = [];

  $: if (style && style.layers) {
    let layers = style.layers;
    height = layers.length * 65;

    xScale = d3.scaleLinear([minZoom, maxZoom], [margin.left, width - margin.right]);
    yScale = d3.scaleBand(layers.map(({ id }) => id), [margin.top, height - margin.bottom])
      .padding(0.25);

    zoomLevels = d3.range(minZoom, maxZoom + 1, 1);

    layers = layers.map(l => {
      const rectStart = xScale(l.minzoom || minZoom);
      const rectWidth = xScale(l.maxzoom || maxZoom) - rectStart;

      let color;
      let opacity;
      let strokeColor;
      let strokeWidth = 0;
      switch (l.type) {
        case 'fill': 
          color = l.paint['fill-color'];
          opacity = l.paint['fill-opacity'];
          strokeColor = l.paint['fill-outline-color'];
          if (strokeColor) strokeWidth = 1;
          break;
        case 'background':
          color = l.paint['background-color'];
          break;
        case 'line':
          color = l.paint['line-color'];
          opacity = l.paint['line-opacity'];
          break;
        case 'symbol':
          color = l.paint ? l.paint['text-color'] : 'black';
          opacity = l.paint ? l.paint['text-opacity'] : null;
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
          gradientStops.push({
            offset: ((xScale(gradientArray[i]) - rectStart) / rectWidth) * 100,
            stopColor: gradientArray[i + 1],
            stopOpacity: 1
          });
        }
      }

      if (opacityIsGradient && !colorIsGradient) {
        const gradientArray = opacity.slice(3);

        for (let i = 0; i < gradientArray.length; i += 2) {
          gradientStops.push({
            offset: ((xScale(gradientArray[i]) - rectStart) / rectWidth) * 100,
            stopColor: color,
            stopOpacity: gradientArray[i + 1]
          });
        }
      }

      if (colorIsGradient && opacityIsGradient) {
        // TODO handle these cases
        console.log(l.id, 'both color and opacity are gradients');
      }

      if (gradientStops.length > 1) {
        gradients = [
          ...gradients,
          {
            id: l.id,
            stops: gradientStops.map(stop => ({
              offset: `${stop.offset}%`,
              stopColor: stop.stopColor,
              stopOpacity: stop.stopOpacity,
            }))
          }
        ];

        color = `url('#${l.id}')`;
      }

      return {
        ...l,
        fill: color,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
      };
    });

    // TODO consider combining casing with roads
    rects = layers.map(d => {
      return {
        x: xScale(d.minzoom || minZoom),
        y: yScale(d.id),
        height: yScale.bandwidth(),
        width: xScale(d.maxzoom || maxZoom) - xScale(d.minzoom || minZoom),
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
      {#each rects as rect}
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.layer.type === 'background' ? height - margin.top - margin.bottom : rect.height}
          fill={rect.fill}
          stroke={rect.stroke}
          strokeWidth={rect.strokeWidth}
          rx="20"
          on:click={() => handleClick(rect.layer)}
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
