<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import mapboxGl from 'mapbox-gl';
  import { getValue as getInterpolatedValue } from './interpolation';
  import { expandLayers } from './styles/expandLayers';
  import Tooltip from './Tooltip.svelte';

  export let style;
  export let minZoom = 0;
  export let maxZoom = 24;

  let map;

  const width = 2500;
  let height;
  let xScale;
  let yScale;
  let tooltip = {};
  let hoverTooltip = {};

  let layers;
  let xAxisFont;
  let zooms = d3.range(minZoom, maxZoom + 1, 2);
  const handleTooltipClose = () => tooltip = {};
  const handleHoverTooltipClose = () => hoverTooltip = {};

  $: {
    xAxisFont = layers.filter(l => {
      return l.layout && l.layout['text-font'];
    })[0].layout['text-font'];
  }

  function getNumericProperty(layer, zoom, propertyType, property) {
    if (!layer[propertyType]) return null;
    let value = layer[propertyType][property];
    return getInterpolatedValue(value, zoom, null);
  }

  function getColorProperty(layer, zoom, propertyType, property) {
    if (!layer[propertyType]) return null;
    let value = layer[propertyType][property];
    return getInterpolatedValue(value, zoom, null);
  }

  function isValidZoom(layer, zoom) {
    if (layer.minzoom && zoom < layer.minzoom) return false;
    if (layer.maxzoom && zoom > layer.maxzoom) return false;
    return true;
  }

  function handleClick(e) {
    const feature = map.queryRenderedFeatures(e.point)[0];
    if (!feature) {
      handleTooltipClose();
      return;
    }
    const layerId = feature.layer.id.slice(0, feature.layer.id.lastIndexOf('-'));
    const layer = layers.filter(l => l.id === layerId)[0];
    if (!layer) {
      handleTooltipClose();
      return;
    }

    tooltip = {
      text: JSON.stringify({
        layout: layer.layout,
        paint: layer.paint,
      }, null, 2),
      left: e.point.x,
      top: e.point.y
    };
  }

  function handleHover(e) {
    const feature = map.queryRenderedFeatures(e.point)[0];
    if (!feature) {
      handleHoverTooltipClose();
      return;
    }
    const layerId = feature.layer.id.slice(0, feature.layer.id.lastIndexOf('-'));
    const layer = layers.filter(l => l.id === layerId)[0];
    if (!layer) {
      handleHoverTooltipClose();
      return;
    }

    let details = feature.layer.metadata.parentId ?
      feature.layer.metadata.parentId : feature.layer.id;

    if (feature.layer.metadata.descriptor) {
      details += `\n\n${feature.layer.metadata.descriptor}`;
    }

    hoverTooltip = {
      text: details,
      left: e.point.x + 25,
      top: e.point.y
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
        "text-font": xAxisFont,
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

  function getLabel(layer) {
    if (layer.id.indexOf('shield') >= 0) {
      return 80;
    }

    const textField = layer.layout['text-field'];
    if (!textField) return layer.id;

    if (Array.isArray(textField)) {
      const possibleEntries = textField
        .filter(v => Array.isArray(v) && v[0] === 'get');
      if (possibleEntries.length) {
        return possibleEntries[0][1];
      }
    }

    return textField;
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
                  label: getLabel(layer)
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

        const paintOverrides = {
          'text-color': getColorProperty(layer, zoom, 'paint', 'text-color'),
          'text-halo-blur': getNumericProperty(layer, zoom, 'paint', 'text-halo-blur'),
          'text-halo-color': getColorProperty(layer, zoom, 'paint', 'text-halo-color'),
          'text-halo-width': getNumericProperty(layer, zoom, 'paint', 'text-halo-width'),
        };

        // Selectively extend paint properties, avoid adding null values
        const paint = {
          ...layer.paint,
          ...Object.fromEntries(Object.entries(paintOverrides).filter(([k, v]) => v !== null)),
        };

        const layoutOverrides = {
          'icon-allow-overlap': true,
          'icon-size': getNumericProperty(layer, zoom, 'layout', 'icon-size'),
          'letter-spacing': getNumericProperty(layer, zoom, 'layout', 'letter-spacing'),
          'max-width': getNumericProperty(layer, zoom, 'layout', 'max-width'),
          'symbol-placement': 'point',
          'text-allow-overlap': true,
          'text-field': '{label}',
          'text-line-height': getNumericProperty(layer, zoom, 'layout', 'text-line-height'),
          'text-size': getNumericProperty(layer, zoom, 'layout', 'text-size'),
        };

        // Selectively extend layout properties, avoid adding null values
        const layout = {
          ...layer.layout,
          ...Object.fromEntries(Object.entries(layoutOverrides).filter(([k, v]) => v !== null)),
        };

        map.addLayer({
          id: id,
          source: id,
          paint,
          layout,
          type: layer.type,
          metadata: {
            ...layer.metadata,
            parentId: (layer.metadata && layer.metadata.parentId) ? layer.metadata.parentId : layer.id
          }
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

  function createMap(style) {
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
      dragPan: false,
      scrollZoom: false,
      zoom: 16
    });

    map.on('load', draw);
    map.on('click', handleClick);
    map.on('mousemove', handleHover);
  }

  function getLayers(style) {
    const layers = expandLayers(style.layers.filter(layer => layer.type === 'symbol'));
    return layers;
  }

  $: {
    layers = getLayers(style);
    height = layers.length * 45;
    if (map && map.isStyleLoaded()) draw();
  }

  onMount(() => {
    createMap(style);
  });
</script>

<div class="typography-chart">
  <div style="width: {width}px; height: {height}px;" id="map"></div>

  {#if Object.keys(tooltip).length > 0}
    <Tooltip
      left={tooltip.left}
      top={tooltip.top}
      on:close={handleTooltipClose}
    >
      {tooltip.text || ''}
    </Tooltip>
  {/if}
  {#if Object.keys(hoverTooltip).length > 0}
    <Tooltip
      left={hoverTooltip.left}
      top={hoverTooltip.top}
      showCloseButton={false}
    >
      {hoverTooltip.text || ''}
    </Tooltip>
  {/if}
</div>

<style>
</style>
