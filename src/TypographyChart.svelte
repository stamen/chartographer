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
  let selectedLayerId = null;
  let editMode = false;
  let labelText = '';

  let layers;
  let xAxisFont;
  let zooms = d3.range(minZoom, maxZoom + 1, 2);
  
  const handleTooltipClose = () => { 
    selectedLayerId = null;
    editMode = false;
    labelText = '';
    tooltip = {};
  };
  const handleHoverTooltipClose = () => hoverTooltip = {};

  // XXX These properties aren't currently supported in this chart, this is 
  // likely okay for most uses
  const dataExpressionsDisallowed = [
    'icon-text-fit-padding',
    'symbol-spacing',
    'text-fit-padding',
    'text-padding',
  ];

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
    const layerId = feature.layer.id;
    const layer = layers.filter(l => l.id === layerId)[0];
    const displayLayer = map.getStyle().layers.find(l => l.id === layerId);

    handleHoverTooltipClose();
    handleTooltipClose();

    if (!layer) return;
    if (displayLayer) {
      const textField = displayLayer?.layout?.['text-field'];
      labelText = Array.isArray(textField) && textField[0] === 'get' && textField[1] === 'label' ? feature?.properties?.label : textField;
    }

    tooltip = {
      text: JSON.stringify({
        layout: layer.layout,
        paint: layer.paint,
      }, null, 2),
      left: e.point.x,
      top: e.point.y
    };
    selectedLayerId = layer.id;
  }

  function handleHover(e) {
    const feature = map.queryRenderedFeatures(e.point)[0];
    if (!feature) {
      handleHoverTooltipClose();
      return;
    }
    const layerId = feature.layer.id;
    const layer = layers.filter(l => l.id === layerId)[0];
    if (!layer) {
      handleHoverTooltipClose();
      return;
    }

    let details = feature.layer.metadata.parentId ?
      feature.layer.metadata.parentId : feature.layer.id;

    const { conditions } = feature.layer.metadata;
    if (conditions) {
      conditions.forEach(({ conditionType, type, key, value, input }) => {
        details += `\n${type}.${key}: `;
        if (conditionType === 'case') {
          details += `${value}`;
        }
        if (conditionType === 'match') {
          details += `${JSON.stringify(input)} == ${JSON.stringify(value)}`;
        }
      });
    }
    else if (feature.layer.metadata.descriptor) {
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

  function getGetExpressionsInner(expression) {
    if (!Array.isArray(expression)) return null;
    if (expression[0] === 'get') return expression;
    return expression.map(getGetExpressionsInner).filter(v => !!v);
  }

  function getGetExpressions(expression) {
    return getGetExpressionsInner(expression)
      .flat(Infinity)
      .filter(v => v !== 'get');
  }

  function getLabel(layer) {
    if (layer.id.indexOf('shield') >= 0) {
      return 80;
    }

    const textField = layer.layout['text-field'];
    if (!textField) return layer.id;

    if (Array.isArray(textField)) {
      return getGetExpressions(textField)?.[0] ?? textField;
    }

    return textField;
  }

  function drawLines() {
    let features = layers.map(layer => {
      let color = layer?.paint?.['icon-color'];
      if (!color) {
        color = layer?.paint?.['text-color'];
      }
      if (!color) color = 'black';

      return {
        type: 'Feature',
        properties: { color },
        geometry: {
          type: 'LineString',
          coordinates: [
            [
              xScale(layer.minzoom || minZoom),
              yScale(layer.id)
            ],
            [
              xScale(layer.maxzoom || maxZoom),
              yScale(layer.id)
            ],
          ]
        }
      };
    });

    map.addSource('lines', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features
      }
    });

    map.addLayer({
      id: 'lines',
      source: 'lines',
      paint: {
        'line-width': 15,
        'line-color': ['get', 'color'],
        'line-opacity': 0.1
      },
      layout: {},
      type: 'line',
    });
  }

  function drawLabels() {
    layers.forEach(layer => {
      // Create one source per layer, spacing features out along valid zooms for
      // the layer
      let features = [];
      zooms.forEach(zoom => {
        if (!isValidZoom(layer, zoom)) return;

        // NB: we are setting the zoom here as a property, all rendering happens
        // at the same zoom level in this visualization
        features.push({
          type: 'Feature',
          properties: {
            label: getLabel(layer),
            zoom
          },
          geometry: {
            type: 'Point',
            coordinates: [
              xScale(zoom),
              yScale(layer.id)
            ]
          }
        });
      });

      map.addSource(layer.id, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features
        }
      });

      // Replace zoom-dependent style expressions with expressions that use the
      // zoom property set above at the feature level
      let paint = {};
      if (layer.paint) {
        paint = JSON.parse(JSON.stringify(layer.paint).replaceAll('["zoom"]', '["get", "zoom"]'));
      }
      let layout = {};
      if (layer.layout) {
        layout = Object.fromEntries(
          Object.entries(layer.layout)
            .map(([k, v]) => {
              if (dataExpressionsDisallowed.indexOf(k) >= 0) {
                return [k, v];
              }
              else {
                return [
                  k,
                  JSON.parse(JSON.stringify(v).replaceAll('["zoom"]', '["get", "zoom"]'))
                ];
              }
            })
        );
        layout = {
          ...layout,
          'icon-allow-overlap': true, // Add overrides to force visibility
          'symbol-placement': 'point',
          'text-allow-overlap': true,
        };

        if (layer.layout['text-field']) {
          layout['text-field'] = ['get', 'label'];
        }
      }

      map.addLayer({
        id: layer.id,
        source: layer.id,
        paint,
        layout,
        type: layer.type,
        metadata: {
          ...layer.metadata,
          parentId: (layer.metadata && layer.metadata.parentId) ? layer.metadata.parentId : layer.id
        }
      });
    });
  }

  function draw() {
    const bounds = map.getBounds();
    const boundsWidth = Math.abs(bounds.getEast() - bounds.getWest());
    const boundsHeight = Math.abs(bounds.getNorth() - bounds.getSouth());
    const xPadding = boundsWidth * 0.08;
    const yPadding = boundsHeight * 0.01;
    xScale = d3.scaleLinear(
      [minZoom, maxZoom],
      [bounds.getWest() + xPadding, bounds.getEast() - xPadding]
    );
    yScale = d3.scaleBand(
      [
        'x-axis',
        ...layers.map(({ id }) => id)
      ],
      [bounds.getNorth(), bounds.getSouth() + yPadding]
    );

    drawAxis();
    drawLines();
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
      center: [0, 10],
      zoom: 14
    });

    map.on('load', draw);
    map.on('click', handleClick);
    map.on('mousemove', handleHover);
  }

  function getLayers(style) {
    const layers = expandLayers(style.layers.filter(layer => layer.type === 'symbol'));
    return layers;
  }

  const updateSelectedLayerLabel = () => {
    if (selectedLayerId) {
      let value = labelText;

      map.setLayoutProperty(selectedLayerId, 'text-field', value);
    } 
    handleTooltipClose();
  };

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
    {#if !editMode}
      <div class="edit-button"><button on:click={() => { editMode = true; }}>Edit label</button></div>
    {/if}
    {#if editMode}
      <div class="edit-button"><input bind:value={labelText}/><button class="submit-button" disabled={!labelText} on:click={updateSelectedLayerLabel}>Submit</button></div>
    {/if}
    <p>{tooltip.text || ''}</p>
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
  .edit-button {
    position: absolute;
    top: 12px;
    left: 12px;
  }

  .submit-button {
    margin-left: 6px;
  }

  .submit-button:disabled {
    pointer-events: none;
  }
</style>
