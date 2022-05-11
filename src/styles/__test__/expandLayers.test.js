import {
  getPropertyValues,
  parseConditionalExpression,
  parseScaleExpression,
  expandLayer,
  getPropertyCombos
} from '../expandLayers';

describe('getPropertyValues', () => {
  let expression;
  test('gets property values for match', () => {
    expression = ['match', ['get', 'class'], 'grass', 'green', 'red'];
    const actual = getPropertyValues(expression);
    const expected = {
      propertyValues: { class: ['grass', 'FALLBACK'] },
      zooms: []
    };
    expect(actual).toEqual(expected);
  });

  test('gets property values for scale', () => {
    expression = [
      'interpolate',
      ['linear'],
      ['zoom'],
      3,
      ['match', ['get', 'class'], 'grass', 'green', 'red'],
      5,
      ['match', ['get', 'type'], ['water', 'landmark'], 'blue', 'purple']
    ];
    const actual = getPropertyValues(expression);
    const expected = {
      propertyValues: {
        class: ['grass', 'FALLBACK'],
        type: ['water', 'landmark', 'FALLBACK']
      },
      zooms: [3, 5]
    };
    expect(actual).toEqual(expected);
  });
});

describe('parseScaleExpression', () => {
  let expression;

  test('parse scale expression', () => {
    expression = [
      'interpolate',
      ['linear'],
      ['zoom'],
      5,
      ['match', ['get', 'class'], 'grass', 'green', 'purple'],
      10,
      [
        'case',
        ['==', ['get', 'class'], 'grass'],
        'green',
        ['==', ['get', 'class'], 'water'],
        'blue',
        ['==', ['get', 'type'], 'fire'],
        'red',
        'black'
      ]
    ];
    const actual = parseScaleExpression(expression);
    const expected = {
      zooms: [5, 10],
      outputs: ['green', 'purple', 'blue', 'red', 'black'],
      properties: { class: ['grass', 'grass', 'water'], type: ['fire'] }
    };
    expect(actual).toEqual(expected);
  });
});

describe('parseConditionalExpression', () => {
  let expression;

  test('parse match expression', () => {
    expression = ['match', ['get', 'class'], 'grass', 'green', 'red'];
    const actual = parseConditionalExpression(expression);
    const expected = {
      outputs: ['green', 'red'],
      properties: { class: ['grass'] }
    };
    expect(actual).toEqual(expected);
  });

  test('parse case expression', () => {
    expression = [
      'case',
      ['==', ['get', 'class'], 'grass'],
      'green',
      ['==', ['get', 'class'], 'water'],
      'blue',
      'red'
    ];
    const actual = parseConditionalExpression(expression);

    const expected = {
      outputs: ['green', 'blue', 'red'],
      properties: { class: ['grass', 'water'] }
    };
    expect(actual).toEqual(expected);
  });

  test('parse nested match expression', () => {
    expression = [
      'match',
      ['get', 'class'],
      'grass',
      ['match', ['get', 'type'], 'spring', 'green', 'brown'],
      'red'
    ];
    const actual = parseConditionalExpression(expression);
    const expected = {
      outputs: ['green', 'brown', 'red'],
      properties: { class: ['grass'], type: ['spring'] }
    };
    expect(actual).toEqual(expected);
  });
});

describe('expandLayer', () => {
  let layer;
  test('expands layer', () => {
    layer = {
      id: 'test-layer-3',
      type: 'fill',
      metadata: {},
      source: 'composite',
      'source-layer': 'landcover',
      layout: {},
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          [
            'match',
            ['get', 'class'],
            ['blue', 'near-blue'],
            'blue',
            ['match', ['get', 'class'], 'green', 'green', 'black']
          ],
          10,
          'red'
        ],
        'fill-opacity': [
          'step',
          ['zoom'],
          0.5,
          2,
          ['match', ['get', 'type'], 'clear', 0.2, 1],
          7,
          1
        ],
        'fill-antialias': false
      }
    };
    const actual = expandLayer(layer);
    const expected = [
      {
        id: 'test-layer-3/class: "blue"/type: "clear"',
        type: 'fill',
        metadata: {},
        source: 'composite',
        'source-layer': 'landcover',
        layout: {},
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            'hsl(240, 100%, 50%)',
            10,
            'hsl(0, 100%, 50%)',
            2,
            'hsl(240, 100%, 50%)',
            2.1,
            'hsl(240, 100%, 50%)',
            7,
            'hsl(280, 100%, 30%)',
            7.1,
            'hsl(283, 100%, 29%)'
          ],
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            0.2,
            10,
            1,
            2,
            0.2,
            2.1,
            0.2,
            7,
            1,
            7.1,
            1
          ],
          'fill-antialias': false
        }
      },
      {
        id: 'test-layer-3/class: "blue"/type: "FALLBACK"',
        type: 'fill',
        metadata: {},
        source: 'composite',
        'source-layer': 'landcover',
        layout: {},
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            'hsl(240, 100%, 50%)',
            10,
            'hsl(0, 100%, 50%)',
            2,
            'hsl(240, 100%, 50%)',
            2.1,
            'hsl(240, 100%, 50%)',
            7,
            'hsl(280, 100%, 30%)',
            7.1,
            'hsl(283, 100%, 29%)'
          ],
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            1,
            10,
            1,
            2,
            1,
            2.1,
            1,
            7,
            1,
            7.1,
            1
          ],
          'fill-antialias': false
        }
      },
      {
        id: 'test-layer-3/class: "near-blue"/type: "clear"',
        type: 'fill',
        metadata: {},
        source: 'composite',
        'source-layer': 'landcover',
        layout: {},
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            'hsl(240, 100%, 50%)',
            10,
            'hsl(0, 100%, 50%)',
            2,
            'hsl(240, 100%, 50%)',
            2.1,
            'hsl(240, 100%, 50%)',
            7,
            'hsl(280, 100%, 30%)',
            7.1,
            'hsl(283, 100%, 29%)'
          ],
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            0.2,
            10,
            1,
            2,
            0.2,
            2.1,
            0.2,
            7,
            1,
            7.1,
            1
          ],
          'fill-antialias': false
        }
      },
      {
        id: 'test-layer-3/class: "near-blue"/type: "FALLBACK"',
        type: 'fill',
        metadata: {},
        source: 'composite',
        'source-layer': 'landcover',
        layout: {},
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            'hsl(240, 100%, 50%)',
            10,
            'hsl(0, 100%, 50%)',
            2,
            'hsl(240, 100%, 50%)',
            2.1,
            'hsl(240, 100%, 50%)',
            7,
            'hsl(280, 100%, 30%)',
            7.1,
            'hsl(283, 100%, 29%)'
          ],
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            1,
            10,
            1,
            2,
            1,
            2.1,
            1,
            7,
            1,
            7.1,
            1
          ],
          'fill-antialias': false
        }
      },
      {
        id: 'test-layer-3/class: "green"/type: "clear"',
        type: 'fill',
        metadata: {},
        source: 'composite',
        'source-layer': 'landcover',
        layout: {},
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            'hsl(120, 100%, 25%)',
            10,
            'hsl(0, 100%, 50%)',
            2,
            'hsl(120, 100%, 25%)',
            2.1,
            'hsl(120, 100%, 25%)',
            7,
            'hsl(45, 100%, 20%)',
            7.1,
            'hsl(41, 100%, 21%)'
          ],
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            0.2,
            10,
            1,
            2,
            0.2,
            2.1,
            0.2,
            7,
            1,
            7.1,
            1
          ],
          'fill-antialias': false
        }
      },
      {
        id: 'test-layer-3/class: "green"/type: "FALLBACK"',
        type: 'fill',
        metadata: {},
        source: 'composite',
        'source-layer': 'landcover',
        layout: {},
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            'hsl(120, 100%, 25%)',
            10,
            'hsl(0, 100%, 50%)',
            2,
            'hsl(120, 100%, 25%)',
            2.1,
            'hsl(120, 100%, 25%)',
            7,
            'hsl(45, 100%, 20%)',
            7.1,
            'hsl(41, 100%, 21%)'
          ],
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            1,
            10,
            1,
            2,
            1,
            2.1,
            1,
            7,
            1,
            7.1,
            1
          ],
          'fill-antialias': false
        }
      },
      {
        id: 'test-layer-3/class: "FALLBACK"/type: "clear"',
        type: 'fill',
        metadata: {},
        source: 'composite',
        'source-layer': 'landcover',
        layout: {},
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            'hsl(0, 0%, 0%)',
            10,
            'hsl(0, 100%, 50%)',
            2,
            'hsl(0, 0%, 0%)',
            2.1,
            'hsl(0, 0%, 0%)',
            7,
            'hsl(0, 100%, 20%)',
            7.1,
            'hsl(0, 100%, 21%)'
          ],
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            0.2,
            10,
            1,
            2,
            0.2,
            2.1,
            0.2,
            7,
            1,
            7.1,
            1
          ],
          'fill-antialias': false
        }
      },
      {
        id: 'test-layer-3/class: "FALLBACK"/type: "FALLBACK"',
        type: 'fill',
        metadata: {},
        source: 'composite',
        'source-layer': 'landcover',
        layout: {},
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            'hsl(0, 0%, 0%)',
            10,
            'hsl(0, 100%, 50%)',
            2,
            'hsl(0, 0%, 0%)',
            2.1,
            'hsl(0, 0%, 0%)',
            7,
            'hsl(0, 100%, 20%)',
            7.1,
            'hsl(0, 100%, 21%)'
          ],
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            1,
            10,
            1,
            2,
            1,
            2.1,
            1,
            7,
            1,
            7.1,
            1
          ],
          'fill-antialias': false
        }
      }
    ];
    expect(actual).toEqual(expected);
  });
});
