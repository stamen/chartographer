<script>
  import { displayLayersStore } from './stores';
  import { CHART_WIDTH } from './constants';

  export let item;
  export let height;
  export let handleTooltipClose;
  export let handleTooltipWarning;
  export let handleClick;

  let limitHit = $displayLayersStore?.limitHit ?? [];

  // Place background text on the far right
  const getTextPlacement = (index, idSection, type) => {
    if (type === 'background') return item.width + item.x + 18;
    return (index > 0 ? 18 : 0) + limitHit.includes(idSection) ? 18 : 0;
  };
</script>

<svg width={CHART_WIDTH} {height}>
  {#each item.gradients as gradient}
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
  <rect
    x={item.x}
    width={item.width}
    {height}
    fill={item.fill}
    stroke={item.stroke}
    strokeWidth={item.strokeWidth}
    rx={item.layer.type === 'background' ? 0 : 20}
    on:click={() => handleClick(item.layer)}
  />
  <g class="y-axis tick" opacity="1" transform="translate(0,0)">
    {#each item.layer.id.split('/') as idSection, i}<g>
        {#if i === 0 && limitHit.includes(idSection)}
          <circle
            cx="6"
            cy="-6"
            r="6"
            fill="red"
            on:mouseover={() => handleTooltipWarning(idSection, item.layer.id)}
            on:mouseout={handleTooltipClose}
          />
        {/if}
        <text
          y={item.height / 2 + 18 * i}
          x={getTextPlacement(i, idSection, item.layer.type)}
        >
          {#if i > 0}↳{/if}

          {idSection}</text
        ></g
      >
    {/each}
  </g>
</svg>

<style>
  .y-axis text {
    font-size: 0.9em;
  }
</style>
