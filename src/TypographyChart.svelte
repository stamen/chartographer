<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import mapboxGl from 'mapbox-gl';
  import { getValue as getNumericValue } from './interpolation/numeric';
  import { getValue as getColorValue } from './interpolation/color';

  export let style;
  export let minZoom = 0;
  export let maxZoom = 24;

  let map;

  const width = 2200;
  let height;
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
    let size = layer.layout['text-size'];
    return getNumericValue(size, zoom);
  }

  function getIconSize(layer, zoom) {
    if (!layer.layout) return 10;
    let size = layer.layout['icon-size'];
    return getNumericValue(size, zoom);
  }

  function getHaloColor(layer, zoom) {
    if (!layer.paint) return '';
    let color = layer.paint['text-halo-color'];
    return getColorValue(color, zoom, '');
  }

  function getHaloWidth(layer, zoom) {
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

  function drawAxis() {
    const features = zooms.map(zoom => ({
      type: 'Feature',
      properties: { label: `${zoom}` },
      geometry: {
        type: 'Point',
        coordinates: [
          xScale(zoom),
          yScale('x-axis')
        ]
      }
    }));

    map.addSource('x-axis', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features }
    });

    map.addLayer({
      id: 'x-axis',
      source: 'x-axis',
      layout: {
        "text-font": layers[0].layout['text-font'],
        'icon-allow-overlap': true,
        'symbol-placement': 'point',
        'text-allow-overlap': true,
        'text-field': '{label}',
        'text-size': 10,
      },
      paint: {
        'text-color': 'black'
      },
      type: 'symbol'
    });
  }

  function drawLabels() {
    layers.forEach(layer => {
      zooms.forEach(zoom => {
        const id = `${layer.id}-${zoom}`;
        if (!isValidZoom(layer, zoom)) return;

        map.addSource(id, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {
                  label: layer.id.indexOf('shield') >= 0 ? 80 : layer.id
                },
                geometry: {
                  type: 'Point',
                  coordinates: [
                    xScale(zoom),
                    yScale(layer.id)
                  ]
                }
              }
            ]
          }
        });

        // TODO other properties that vary by zoom
        map.addLayer({
          id: id,
          source: id,
          paint: {
            ...layer.paint,
            'text-color': getColor(layer, zoom),
            'text-halo-width': getHaloWidth(layer, zoom),
            // 'text-halo-color': getHaloColor(layer, zoom),
          },
          layout: {
            ...layer.layout,
            'icon-allow-overlap': true,
            'icon-size': getIconSize(layer, zoom),
            'symbol-placement': 'point',
            'text-allow-overlap': true,
            'text-size': getSize(layer, zoom),
            'text-field': '{label}'
          },
          type: layer.type
        });
      });
    });
  }

  function draw() {
    const bounds = map.getBounds();
    const boundsWidth = Math.abs(bounds.getEast() - bounds.getWest());
    xScale = d3.scaleLinear(
      [minZoom, maxZoom],
      [bounds.getWest() + boundsWidth * 0.08, bounds.getEast() - boundsWidth * 0.08]
    );
    yScale = d3.scaleBand([
      'x-axis',
      ...layers.map(({ id }) => id)
    ], [bounds.getNorth(), bounds.getSouth()])

    drawAxis();
    drawLabels();
  }

  $: {
    layers = style.layers.filter(layer => layer.type === 'symbol');
    height = layers.length * 45;
    if (map && map.isStyleLoaded()) draw();
  }

  onMount(() => {
    console.log(style);
    map = new mapboxGl.Map({
      container: 'map',
      style: {
        version: 8,
        glyphs: style.glyphs,
        sprite: style.sprite,
        sources: {},
        layers: style.layers.filter(l => l.type === 'background'),
      },
      boxZoom: false,
      doubleClickZoom: false,
      scrollZoom: false,
      zoom: 16
    });

    map.on('load', draw);

    document.addEventListener('scroll', () => scrollY = window.scrollY);
  });
</script>

<div class="typography-chart">
  <div style="width: {width}px; height: {height}px;" id="map"></div>
  <!--
  TODO
  <div class="tooltip" style="display: {Object.keys(tooltip).length > 0 ?
    'block': 'visible'}; left: {tooltip.left ? tooltip.left : -1000}px; top: {tooltip.top}px;">
    <pre>
      <code>
        {tooltip.text || ''}
      </code>
    </pre>
  </div>
  -->
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
