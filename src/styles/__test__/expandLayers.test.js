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
      id: 'test-layer',
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
        id: 'test-layer/class: "blue"/type: "clear"',
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
        id: 'test-layer/class: "blue"/type: "FALLBACK"',
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
        id: 'test-layer/class: "near-blue"/type: "clear"',
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
        id: 'test-layer/class: "near-blue"/type: "FALLBACK"',
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
        id: 'test-layer/class: "green"/type: "clear"',
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
        id: 'test-layer/class: "green"/type: "FALLBACK"',
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
        id: 'test-layer/class: "FALLBACK"/type: "clear"',
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
        id: 'test-layer/class: "FALLBACK"/type: "FALLBACK"',
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

  test('expands layer with lots of properties with hard limit', () => {
    layer = {
      id: 'test-layer',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 4,
      filter: [
        'all',
        [
          'in',
          ['get', 'class'],
          [
            'literal',
            [
              'motorway',
              'trunk',
              'primary',
              'secondary',
              'tertiary',
              'minor',
              'service'
            ]
          ]
        ],
        ['==', ['get', 'brunnel'], 'tunnel']
      ],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        'line-sort-key': [
          '+',
          ['*', -28, ['coalesce', ['get', 'ramp'], 0]],
          [
            '*',
            4,
            [
              'match',
              ['get', 'class'],
              'motorway',
              6,
              'trunk',
              5,
              'primary',
              4,
              'secondary',
              3,
              'tertiary',
              2,
              'minor',
              1,
              0
            ]
          ],
          ['*', 2, ['coalesce', ['get', 'expressway'], 0]],
          ['coalesce', ['get', 'toll'], 0]
        ],
        visibility: 'visible'
      },
      paint: {
        'line-opacity': [
          'step',
          ['zoom'],
          [
            'match',
            ['coalesce', ['get', 'ramp'], 0],
            1,
            0,
            ['match', ['get', 'network'], 'us-interstate', 1, 0]
          ],
          5,
          [
            'match',
            ['coalesce', ['get', 'ramp'], 0],
            1,
            0,
            ['match', ['get', 'class'], ['motorway', 'trunk'], 1, 0]
          ],
          7,
          ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 1, 0],
          9,
          [
            'match',
            ['get', 'class'],
            ['motorway', 'trunk', 'primary', 'secondary'],
            1,
            0
          ],
          11,
          [
            'match',
            ['get', 'class'],
            ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'],
            1,
            0
          ],
          12,
          ['match', ['get', 'class'], 'service', 0, 1],
          13,
          [
            'match',
            ['get', 'class'],
            'service',
            ['match', ['get', 'service'], ['parking_aisle', 'driveway'], 0, 1],
            1
          ],
          15,
          1
        ],
        'line-color': [
          'match',
          ['get', 'brunnel'],
          'tunnel',
          [
            'match',
            ['get', 'class'],
            'motorway',
            [
              'match',
              ['coalesce', ['get', 'toll'], 0],
              1,
              'hsl(48, 71%, 90%)',
              'hsl(0, 71%, 90%)'
            ],
            'trunk',
            [
              'match',
              ['coalesce', ['get', 'toll'], 0],
              1,
              'hsl(48, 77%, 90%)',
              'hsl(0, 77%, 90%)'
            ],
            [
              'match',
              ['coalesce', ['get', 'toll'], 0],
              1,
              'hsl(48, 100%, 95%)',
              'hsl(0, 0%, 95%)'
            ]
          ],
          [
            'match',
            ['get', 'class'],
            'trunk',
            [
              'match',
              ['coalesce', ['get', 'expressway'], 0],
              1,
              [
                'match',
                ['coalesce', ['get', 'toll'], 0],
                1,
                'hsl(48, 95%, 95%)',
                'hsl(0, 95%, 95%)'
              ],
              [
                'match',
                ['coalesce', ['get', 'toll'], 0],
                1,
                'hsl(48, 77%, 50%)',
                'hsl(0, 77%, 50%)'
              ]
            ],
            [
              'match',
              ['coalesce', ['get', 'toll'], 0],
              1,
              'hsl(48, 100%, 75%)',
              'hsl(0, 100%, 100%)'
            ]
          ]
        ],
        'line-width': [
          'interpolate',
          ['exponential', 1.2],
          ['zoom'],
          4,
          [
            '*',
            0.5,
            [
              'match',
              ['get', 'class'],
              ['motorway', 'trunk'],
              ['match', ['coalesce', ['get', 'ramp'], 0], 1, 0.5, 1],
              'primary',
              ['match', ['coalesce', ['get', 'ramp'], 0], 1, 0.45, 0.9],
              'secondary',
              [
                'match',
                ['coalesce', ['get', 'ramp'], 0],
                1,
                0.3,
                ['match', ['coalesce', ['get', 'expressway'], 0], 1, 0.7, 0.6]
              ],
              'tertiary',
              ['match', ['coalesce', ['get', 'ramp'], 0], 1, 0.25, 0.5],
              'minor',
              0.3,
              'service',
              [
                'match',
                ['get', 'service'],
                ['parking_aisle', 'driveway'],
                0.15,
                0.2
              ],
              0.2
            ]
          ],
          9,
          [
            'match',
            ['get', 'class'],
            ['motorway', 'trunk'],
            ['match', ['coalesce', ['get', 'ramp'], 0], 1, 0.5, 1],
            'primary',
            ['match', ['coalesce', ['get', 'ramp'], 0], 1, 0.45, 0.9],
            'secondary',
            [
              'match',
              ['coalesce', ['get', 'ramp'], 0],
              1,
              0.3,
              ['match', ['coalesce', ['get', 'expressway'], 0], 1, 0.7, 0.6]
            ],
            'tertiary',
            ['match', ['coalesce', ['get', 'ramp'], 0], 1, 0.25, 0.5],
            'minor',
            0.3,
            'service',
            [
              'match',
              ['get', 'service'],
              ['parking_aisle', 'driveway'],
              0.15,
              0.2
            ],
            0.2
          ],
          12,
          [
            '*',
            [
              'match',
              ['get', 'class'],
              'motorway',
              3.2,
              ['match', ['coalesce', ['get', 'expressway'], 0], 1, 3.5, 4]
            ],
            [
              'match',
              ['get', 'class'],
              ['motorway', 'trunk'],
              ['match', ['coalesce', ['get', 'ramp'], 0], 1, 0.5, 1],
              'primary',
              ['match', ['coalesce', ['get', 'ramp'], 0], 1, 0.45, 0.9],
              'secondary',
              [
                'match',
                ['coalesce', ['get', 'ramp'], 0],
                1,
                0.3,
                ['match', ['coalesce', ['get', 'expressway'], 0], 1, 0.7, 0.6]
              ],
              'tertiary',
              ['match', ['coalesce', ['get', 'ramp'], 0], 1, 0.25, 0.5],
              'minor',
              0.3,
              'service',
              [
                'match',
                ['get', 'service'],
                ['parking_aisle', 'driveway'],
                0.15,
                0.2
              ],
              0.2
            ]
          ],
          20,
          [
            '*',
            ['match', ['coalesce', ['get', 'expressway'], 0], 1, 16, 18],
            [
              'match',
              ['get', 'class'],
              ['motorway', 'trunk'],
              ['match', ['coalesce', ['get', 'ramp'], 0], 1, 0.5, 1],
              'primary',
              ['match', ['coalesce', ['get', 'ramp'], 0], 1, 0.45, 0.9],
              'secondary',
              [
                'match',
                ['coalesce', ['get', 'ramp'], 0],
                1,
                0.3,
                ['match', ['coalesce', ['get', 'expressway'], 0], 1, 0.7, 0.6]
              ],
              'tertiary',
              ['match', ['coalesce', ['get', 'ramp'], 0], 1, 0.25, 0.5],
              'minor',
              0.3,
              'service',
              [
                'match',
                ['get', 'service'],
                ['parking_aisle', 'driveway'],
                0.15,
                0.2
              ],
              0.2
            ]
          ]
        ],
        'line-blur': 0.5
      }
    };
    const actual = expandLayer(layer).length;
    const expected = 10;
    expect(actual).toEqual(expected);
  });
});
