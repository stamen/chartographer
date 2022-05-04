import {
  getPropertyValues,
  parseConditionalExpression,
  parseScaleExpression,
  expandLayer,
  getPropertyCombos
} from '../expandLayers-2';

describe('getPropertyCombos', () => {
  let properties;
  test('with two properties', () => {
    properties = {
      class: ['park', 'industrial', 'airport'],
      size: ['small', 'medium', 'large']
    };
    const actual = getPropertyCombos(properties);
    const expected = [
      { class: 'park', size: 'small' },
      { class: 'park', size: 'medium' },
      { class: 'park', size: 'large' },
      { class: 'industrial', size: 'small' },
      { class: 'industrial', size: 'medium' },
      { class: 'industrial', size: 'large' },
      { class: 'airport', size: 'small' },
      { class: 'airport', size: 'medium' },
      { class: 'airport', size: 'large' }
    ];
    expect(actual).toEqual(expect.arrayContaining(expected));
  });

  test('with three properties', () => {
    properties = {
      class: ['park', 'industrial'],
      size: ['small', 'large'],
      color: ['red', 'blue']
    };
    const actual = getPropertyCombos(properties);
    const expected = [
      {
        class: 'park',
        size: 'small',
        color: 'red'
      },
      {
        class: 'park',
        size: 'small',
        color: 'blue'
      },
      {
        class: 'park',
        size: 'large',
        color: 'red'
      },
      {
        class: 'park',
        size: 'large',
        color: 'blue'
      },
      {
        class: 'industrial',
        size: 'small',
        color: 'red'
      },
      {
        class: 'industrial',
        size: 'small',
        color: 'blue'
      },
      {
        class: 'industrial',
        size: 'large',
        color: 'red'
      },
      {
        class: 'industrial',
        size: 'large',
        color: 'blue'
      }
    ];
    expect(actual).toEqual(expect.arrayContaining(expected));
  });
});

describe('getPropertyValues', () => {
  let expression;
  test('gets property values for match', () => {
    expression = ['match', ['get', 'class'], 'grass', 'green', 'red'];
    const actual = getPropertyValues(expression);
    const expected = { propertyValues: { class: ['grass'] }, zooms: [] };
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
      propertyValues: { class: ['grass'], type: ['water', 'landmark'] },
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
        id: 'test-layer-3/class=="blue"/type=="clear"',
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
        id: 'test-layer-3/class=="near-blue"/type=="clear"',
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
        id: 'test-layer-3/class=="green"/type=="clear"',
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
      }
    ];
    expect(actual).toEqual(expected);
  });
});
