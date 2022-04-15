import {
  expandLayer,
  expandScaleCondtionals,
  spreadMatchExpression,
  expandMatchExpression,
  expandCaseExpression,
  nestedExpandedValuesToExpression,
  isHandledConditional,
  isHandledScale,
  getExpandableProperties
} from '../expandLayers';

describe('isHandledConditional', () => {
  let expression;
  test('returns true for valid match expression', () => {
    expression = ['match', ['get', 'class'], 'grass', 'green', 'red'];
    const actual = isHandledConditional(expression);
    expect(actual).toBe(true);
  });
  test('returns true for valid case expression', () => {
    expression = ['case', ['==', ['get', 'class'], 'grass'], 'green', 'red'];
    const actual = isHandledConditional(expression);
    expect(actual).toBe(true);
  });
  test('returns false for non-conditional expression', () => {
    expression = ['literal', ['a', 'b', 'c']];
    const actual = isHandledConditional(expression);
    expect(actual).toBe(false);
  });
});

describe('isHandledScale', () => {
  let expression;
  test('returns true for scainterpolatee expression with match expression', () => {
    expression = [
      'interpolate',
      ['linear'],
      ['zoom'],
      5,
      ['match', ['get', 'class'], 'grass', 'green', 'red'],
      10,
      'red'
    ];
    const actual = isHandledScale(expression);
    expect(actual).toBe(true);
  });
  test('returns true for interpolate expression with case expression', () => {
    expression = [
      'interpolate',
      ['linear'],
      ['zoom'],
      5,
      ['case', ['==', ['get', 'class'], 'grass'], 'green', 'red'],
      10,
      'red'
    ];
    const actual = isHandledScale(expression);
    expect(actual).toBe(true);
  });
  test('returns true for step expression with match expression', () => {
    expression = [
      'step',
      ['zoom'],
      5,
      ['match', ['get', 'class'], 'grass', 'green', 'red'],
      10,
      'red'
    ];
    const actual = isHandledScale(expression);
    expect(actual).toBe(true);
  });
  test('returns false for scale expression without conditional', () => {
    expression = ['interpolate', ['linear'], ['zoom'], 5, 'blue', 10, 'red'];
    const actual = isHandledScale(expression);
    expect(actual).toBe(false);
  });
});

describe('spreadMatchExpression', () => {
  test('spreads match expression when it matches multiple inputs to a single output', () => {
    const matchExp = [
      'match',
      ['get', 'class'],
      ['grass', 'parks'],
      'green',
      'water',
      'blue',
      'red'
    ];

    const actual = spreadMatchExpression(matchExp);
    const expected = [
      'match',
      ['get', 'class'],
      'grass',
      'green',
      'parks',
      'green',
      'water',
      'blue',
      'red'
    ];
    expect(actual).toEqual(expected);
  });
});

describe('getExpandableProperties', () => {
  let layer;
  test('returns expandable properties for layer', () => {
    layer = {
      id: 'my-layer',
      type: 'fill',
      source: 'composite',
      'source-layer': 'land',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'class'], 'is-blue'],
          'blue',
          ['==', ['get', 'class'], 'is-red'],
          'red',
          'fallback'
        ],
        'fill-opacity': 1
      }
    };
    const actual = getExpandableProperties(layer);
    const expected = [
      {
        type: 'paint',
        key: 'fill-color',
        value: [
          'case',
          ['==', ['get', 'class'], 'is-blue'],
          'blue',
          ['==', ['get', 'class'], 'is-red'],
          'red',
          'fallback'
        ]
      }
    ];
    expect(actual).toEqual(expected);
  });
});

describe('nestedExpandedValuesToExpression', () => {
  test('turns nested expanded values into a valid nested case expression', () => {
    const nestedValues = {
      '["==",["get","class"],"is-red"]': {
        '["==",["get","type"],"dark"]': {
          descriptor: '["get","class"]=="is-red"-["get","type"]=="dark"',
          expandedValue: 'hsl(0, 100%, 20%)',
          condition: {
            conditionType: 'match',
            type: 'paint',
            key: 'fill-color',
            input: ['get', 'type'],
            value: 'dark'
          },
          allConditions: [
            ['==', ['get', 'class'], 'is-red'],
            ['==', ['get', 'type'], 'dark']
          ]
        },
        '["==",["get","type"],"darker"]': {
          descriptor: '["get","class"]=="is-red"-["get","type"]=="darker"',
          expandedValue: 'hsl(0, 100%, 10%)',
          condition: {
            conditionType: 'match',
            type: 'paint',
            key: 'fill-color',
            input: ['get', 'type'],
            value: 'darker'
          },
          allConditions: [
            ['==', ['get', 'class'], 'is-red'],
            ['==', ['get', 'type'], 'darker']
          ]
        },
        '"fallback"': {
          descriptor: '["get","class"]=="is-red"-fallback',
          expandedValue: 'hsl(0, 100%, 0%)',
          condition: {
            conditionType: 'match',
            type: 'paint',
            key: 'fill-color',
            input: ['get', 'type'],
            value: 'fallback'
          },
          allConditions: [['==', ['get', 'class'], 'is-red'], 'fallback']
        }
      },
      '"fallback"': {
        descriptor: 'fallback',
        expandedValue: 'hsl(120, 100%, 20%)',
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'fallback'
        },
        allConditions: ['fallback']
      }
    };
    const actual = nestedExpandedValuesToExpression(nestedValues);
    const expected = [
      'case',
      [
        '!=',
        ['index-of', '["==",["get","class"],"is-red"]', ['get', 'condition']],
        -1
      ],
      [
        'case',
        [
          '!=',
          ['index-of', '["==",["get","type"],"dark"]', ['get', 'condition']],
          -1
        ],
        'hsl(0, 100%, 20%)',
        [
          '!=',
          ['index-of', '["==",["get","type"],"darker"]', ['get', 'condition']],
          -1
        ],
        'hsl(0, 100%, 10%)',
        'hsl(0, 100%, 0%)'
      ],
      'hsl(120, 100%, 20%)'
    ];
    expect(actual).toEqual(expected);
  });

  test('returns expanded value for unnested values', () => {
    const nestedValues = {
      '"fallback"': {
        descriptor: 'fallback',
        expandedValue: 'hsl(120, 100%, 20%)',
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'fallback'
        },
        allConditions: ['fallback']
      }
    };
    const actual = nestedExpandedValuesToExpression(nestedValues);
    const expected = 'hsl(120, 100%, 20%)';
    expect(actual).toEqual(expected);
  });
});

describe('expandMatchExpression', () => {
  let layer;
  let type;
  let key;
  let value;
  test('expands a match expression', () => {
    layer = {
      id: 'my-layer',
      type: 'fill',
      source: 'composite',
      'source-layer': 'land',
      paint: {
        'fill-color': [
          'match',
          ['get', 'class'],
          'is-blue',
          'hsl(240, 100%, 50%)',
          'is-red',
          'hsl(0, 100%, 50%)',
          'hsl(120, 100%, 50%)'
        ]
      }
    };
    type = 'paint';
    key = 'fill-color';
    value = layer[type][key];
    const actual = expandMatchExpression(layer, type, key, value);
    const expected = [
      {
        descriptor: '["get","class"]=="is-blue"',
        expandedValue: 'hsl(240, 100%, 50%)',
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-blue'
        }
      },
      {
        descriptor: '["get","class"]=="is-red"',
        expandedValue: 'hsl(0, 100%, 50%)',
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-red'
        }
      },
      {
        descriptor: 'fallback',
        expandedValue: 'hsl(120, 100%, 50%)',
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'fallback'
        }
      }
    ];
    expect(actual).toEqual(expected);
  });
});

describe('expandCaseExpression', () => {
  let layer;
  let type;
  let key;
  let value;
  test('expands a case expression', () => {
    layer = {
      id: 'my-layer',
      type: 'fill',
      source: 'composite',
      'source-layer': 'land',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'class'], 'is-blue'],
          'hsl(240, 100%, 50%)',
          ['==', ['get', 'class'], 'is-red'],
          'hsl(0, 100%, 50%)',
          'hsl(120, 100%, 50%)'
        ]
      }
    };
    type = 'paint';
    key = 'fill-color';
    value = layer[type][key];
    const actual = expandCaseExpression(layer, type, key, value);
    const expected = [
      {
        descriptor: '["==",["get","class"],"is-blue"]',
        expandedValue: 'hsl(240, 100%, 50%)',
        condition: {
          conditionType: 'case',
          type: 'paint',
          key: 'fill-color',
          value: '["==",["get","class"],"is-blue"]'
        }
      },
      {
        descriptor: '["==",["get","class"],"is-red"]',
        expandedValue: 'hsl(0, 100%, 50%)',
        condition: {
          conditionType: 'case',
          type: 'paint',
          key: 'fill-color',
          value: '["==",["get","class"],"is-red"]'
        }
      },
      {
        descriptor: 'fallback',
        expandedValue: 'hsl(120, 100%, 50%)',
        condition: {
          conditionType: 'case',
          type: 'paint',
          key: 'fill-color',
          value: 'fallback'
        }
      }
    ];
    expect(actual).toEqual(expected);
  });
});

describe('expandScaleCondtionals', () => {
  let layer;
  let type;
  let key;
  let value;
  test('expand values for simple matching match expressions in scale expression', () => {
    layer = {
      id: 'my-layer',
      type: 'fill',
      source: 'composite',
      'source-layer': 'land',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          [
            'match',
            ['get', 'class'],
            'is-blue',
            'hsl(240, 100%, 50%)',
            'is-red',
            'hsl(0, 100%, 50%)',
            'hsl(120, 100%, 50%)'
          ],
          10,
          [
            'match',
            ['get', 'class'],
            'is-blue',
            'hsl(240, 100%, 20%)',
            'is-red',
            'hsl(0, 100%, 20%)',
            'hsl(120, 100%, 20%)'
          ]
        ]
      }
    };
    type = 'paint';
    key = 'fill-color';
    value = layer[type][key];
    const actual = expandScaleCondtionals(layer, type, key, value);

    const expected = [
      {
        descriptor: '["get","class"]=="is-blue"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(240, 100%, 50%)',
          10,
          'hsl(240, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-blue'
        }
      },
      {
        descriptor: '["get","class"]=="is-red"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(0, 100%, 50%)',
          10,
          'hsl(0, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-red'
        }
      },
      {
        descriptor: 'fallback',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(120, 100%, 50%)',
          10,
          'hsl(120, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'fallback'
        }
      }
    ];
    expect(actual.length).toEqual(3);
    expect(actual).toEqual(expected);
  });

  test('expand values for simple matching case expressions in scale expression', () => {
    layer = {
      id: 'my-layer',
      type: 'fill',
      source: 'composite',
      'source-layer': 'land',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          [
            'case',
            ['==', ['get', 'class'], 'is-blue'],
            'hsl(240, 100%, 50%)',
            ['==', ['get', 'class'], 'is-red'],
            'hsl(0, 100%, 50%)',
            'hsl(120, 100%, 50%)'
          ],
          10,
          [
            'case',
            ['==', ['get', 'class'], 'is-blue'],
            'hsl(240, 100%, 20%)',
            ['==', ['get', 'class'], 'is-red'],
            'hsl(0, 100%, 20%)',
            'hsl(120, 100%, 20%)'
          ]
        ]
      }
    };
    type = 'paint';
    key = 'fill-color';
    value = layer[type][key];
    const actual = expandScaleCondtionals(layer, type, key, value);

    const expected = [
      {
        descriptor: '["==",["get","class"],"is-blue"]',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(240, 100%, 50%)',
          10,
          'hsl(240, 100%, 20%)'
        ],
        condition: {
          conditionType: 'case',
          type: 'paint',
          key: 'fill-color',
          value: '["==",["get","class"],"is-blue"]'
        }
      },
      {
        descriptor: '["==",["get","class"],"is-red"]',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(0, 100%, 50%)',
          10,
          'hsl(0, 100%, 20%)'
        ],
        condition: {
          conditionType: 'case',
          type: 'paint',
          key: 'fill-color',
          value: '["==",["get","class"],"is-red"]'
        }
      },
      {
        descriptor: 'fallback',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(120, 100%, 50%)',
          10,
          'hsl(120, 100%, 20%)'
        ],
        condition: {
          conditionType: 'case',
          type: 'paint',
          key: 'fill-color',
          value: 'fallback'
        }
      }
    ];
    expect(actual.length).toEqual(3);
    expect(actual).toEqual(expected);
  });

  test('expand values for non-matching match expressions in scale expression', () => {
    layer = {
      id: 'my-layer',
      type: 'fill',
      source: 'composite',
      'source-layer': 'land',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          [
            'match',
            ['get', 'class'],
            'is-blue',
            'hsl(240, 100%, 50%)',
            'is-red',
            'hsl(0, 100%, 50%)',
            'hsl(120, 100%, 50%)'
          ],
          10,
          [
            'match',
            ['get', 'class'],
            'is-blue',
            'hsl(240, 100%, 20%)',
            'is-purple',
            'hsl(320, 100%, 20%)',
            'hsl(120, 100%, 20%)'
          ]
        ]
      }
    };
    type = 'paint';
    key = 'fill-color';
    value = layer[type][key];
    const actual = expandScaleCondtionals(layer, type, key, value);

    const expected = [
      {
        descriptor: '["get","class"]=="is-blue"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(240, 100%, 50%)',
          10,
          'hsl(240, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-blue'
        }
      },
      {
        descriptor: '["get","class"]=="is-red"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(0, 100%, 50%)',
          10,
          'hsl(120, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-red'
        }
      },
      {
        descriptor: 'fallback',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(120, 100%, 50%)',
          10,
          'hsl(120, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'fallback'
        }
      },
      {
        descriptor: '["get","class"]=="is-purple"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(120, 100%, 50%)',
          10,
          'hsl(320, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-purple'
        }
      }
    ];

    expect(actual.length).toEqual(4);
    expect(actual).toEqual(expected);
  });

  test('expand values for nested match expressions in scale expression', () => {
    layer = {
      id: 'my-layer',
      type: 'fill',
      source: 'composite',
      'source-layer': 'land',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          [
            'match',
            ['get', 'class'],
            'is-blue',
            'hsl(240, 100%, 50%)',
            'is-red',
            'hsl(0, 100%, 50%)',
            'hsl(120, 100%, 50%)'
          ],
          10,
          [
            'match',
            ['get', 'class'],
            'is-blue',
            'hsl(240, 100%, 20%)',
            'is-red',
            [
              'match',
              ['get', 'type'],
              'dark',
              'hsl(0, 100%, 20%)',
              'darker',
              'hsl(0, 100%, 10%)',
              'hsl(0, 100%, 0%)'
            ],
            'hsl(120, 100%, 20%)'
          ]
        ]
      }
    };
    type = 'paint';
    key = 'fill-color';
    value = layer[type][key];
    const actual = expandScaleCondtionals(layer, type, key, value);

    const expected = [
      {
        descriptor: '["get","class"]=="is-blue"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(240, 100%, 50%)',
          10,
          'hsl(240, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-blue'
        }
      },
      // NOTE: We should probably work to get rid of this one but it's a bit more work to parse
      // technically this is nullified by the nested conditionals in the conditional in the other zoom output
      // so it is the same as  '["get","class"]=="is-red"-fallback'
      {
        descriptor: '["get","class"]=="is-red"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(0, 100%, 50%)',
          10,
          'hsl(0, 0%, 0%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-red'
        }
      },
      {
        descriptor: 'fallback',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(120, 100%, 50%)',
          10,
          'hsl(120, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'fallback'
        }
      },
      {
        descriptor: '["get","class"]=="is-red"-["get","type"]=="dark"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(0, 100%, 50%)',
          10,
          'hsl(0, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'type'],
          value: 'dark'
        }
      },
      {
        descriptor: '["get","class"]=="is-red"-["get","type"]=="darker"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(0, 100%, 50%)',
          10,
          'hsl(0, 100%, 10%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'type'],
          value: 'darker'
        }
      },
      {
        descriptor: '["get","class"]=="is-red"-fallback',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(0, 100%, 50%)',
          10,
          'hsl(0, 0%, 0%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'type'],
          value: 'fallback'
        }
      }
    ];

    expect(actual.length).toEqual(6);
    expect(actual).toEqual(expected);
  });

  test('expand values for match expressions in only one ouput of scale expression', () => {
    layer = {
      id: 'my-layer',
      type: 'fill',
      source: 'composite',
      'source-layer': 'land',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          [
            'match',
            ['get', 'class'],
            'is-blue',
            'hsl(240, 100%, 50%)',
            'is-red',
            'hsl(0, 100%, 50%)',
            'hsl(120, 100%, 50%)'
          ],
          10,
          'hsl(120, 100%, 20%)'
        ]
      }
    };
    type = 'paint';
    key = 'fill-color';
    value = layer[type][key];
    const actual = expandScaleCondtionals(layer, type, key, value);

    const expected = [
      {
        descriptor: '["get","class"]=="is-blue"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(240, 100%, 50%)',
          10,
          'hsl(120, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-blue'
        }
      },
      {
        descriptor: '["get","class"]=="is-red"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(0, 100%, 50%)',
          10,
          'hsl(120, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-red'
        }
      },
      {
        descriptor: 'fallback',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(120, 100%, 50%)',
          10,
          'hsl(120, 100%, 20%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'fallback'
        }
      }
    ];

    expect(actual.length).toEqual(3);
    expect(actual).toEqual(expected);
  });

  test('expand values for match expressions across >2 zooms', () => {
    layer = {
      id: 'my-layer',
      type: 'fill',
      source: 'composite',
      'source-layer': 'land',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          [
            'match',
            ['get', 'class'],
            'is-blue',
            'hsl(240, 100%, 50%)',
            'is-red',
            'hsl(0, 100%, 50%)',
            'hsl(120, 100%, 50%)'
          ],
          10,
          [
            'match',
            ['get', 'class'],
            'is-blue',
            'hsl(240, 100%, 20%)',
            'is-red',
            'hsl(0, 100%, 20%)',
            'hsl(120, 100%, 20%)'
          ],
          15,
          [
            'match',
            ['get', 'class'],
            'is-blue',
            'hsl(240, 100%, 10%)',
            'is-red',
            'hsl(0, 100%, 10%)',
            'hsl(120, 100%, 10%)'
          ]
        ]
      }
    };
    type = 'paint';
    key = 'fill-color';
    value = layer[type][key];
    const actual = expandScaleCondtionals(layer, type, key, value);

    const expected = [
      {
        descriptor: '["get","class"]=="is-blue"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(240, 100%, 50%)',
          10,
          'hsl(240, 100%, 20%)',
          15,
          'hsl(240, 100%, 10%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-blue'
        }
      },
      {
        descriptor: '["get","class"]=="is-red"',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(0, 100%, 50%)',
          10,
          'hsl(0, 100%, 20%)',
          15,
          'hsl(0, 100%, 10%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'is-red'
        }
      },
      {
        descriptor: 'fallback',
        expandedValue: [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          'hsl(120, 100%, 50%)',
          10,
          'hsl(120, 100%, 20%)',
          15,
          'hsl(120, 100%, 10%)'
        ],
        condition: {
          conditionType: 'match',
          type: 'paint',
          key: 'fill-color',
          input: ['get', 'class'],
          value: 'fallback'
        }
      }
    ];

    expect(actual.length).toEqual(3);
    expect(actual).toEqual(expected);
  });
});

describe('expandLayer', () => {
  let layer;
  test('expands layers for simple match conditional', () => {
    layer = {
      id: 'my-layer',
      type: 'fill',
      source: 'composite',
      'source-layer': 'land',
      paint: {
        'fill-color': [
          'match',
          ['get', 'class'],
          'is-blue',
          'blue',
          'is-red',
          'red',
          'fallback'
        ]
      }
    };
    const actual = expandLayer(layer);
    const expected = [
      {
        id: 'my-layer-["get","class"]=="is-blue"',
        type: 'fill',
        source: 'composite',
        'source-layer': 'land',
        paint: { 'fill-color': 'blue' },
        metadata: {
          parentId: 'my-layer',
          descriptor: '["get","class"]=="is-blue"',
          conditions: [
            {
              conditionType: 'match',
              type: 'paint',
              key: 'fill-color',
              input: ['get', 'class'],
              value: 'is-blue'
            }
          ]
        }
      },
      {
        id: 'my-layer-["get","class"]=="is-red"',
        type: 'fill',
        source: 'composite',
        'source-layer': 'land',
        paint: { 'fill-color': 'red' },
        metadata: {
          parentId: 'my-layer',
          descriptor: '["get","class"]=="is-red"',
          conditions: [
            {
              conditionType: 'match',
              type: 'paint',
              key: 'fill-color',
              input: ['get', 'class'],
              value: 'is-red'
            }
          ]
        }
      },
      {
        id: 'my-layer-fallback',
        type: 'fill',
        source: 'composite',
        'source-layer': 'land',
        paint: { 'fill-color': 'fallback' },
        metadata: {
          parentId: 'my-layer',
          descriptor: 'fallback',
          conditions: [
            {
              conditionType: 'match',
              type: 'paint',
              key: 'fill-color',
              input: ['get', 'class'],
              value: 'fallback'
            }
          ]
        }
      }
    ];

    expect(actual).toEqual(expected);
  });

  test('expands layers for simple case conditional', () => {
    layer = {
      id: 'my-layer',
      type: 'fill',
      source: 'composite',
      'source-layer': 'land',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'class'], 'is-blue'],
          'blue',
          ['==', ['get', 'class'], 'is-red'],
          'red',
          'fallback'
        ]
      }
    };
    const actual = expandLayer(layer);
    const expected = [
      {
        id: 'my-layer-["==",["get","class"],"is-blue"]',
        type: 'fill',
        source: 'composite',
        'source-layer': 'land',
        paint: { 'fill-color': 'blue' },
        metadata: {
          parentId: 'my-layer',
          descriptor: '["==",["get","class"],"is-blue"]',
          conditions: [
            {
              conditionType: 'case',
              type: 'paint',
              key: 'fill-color',
              value: '["==",["get","class"],"is-blue"]'
            }
          ]
        }
      },
      {
        id: 'my-layer-["==",["get","class"],"is-red"]',
        type: 'fill',
        source: 'composite',
        'source-layer': 'land',
        paint: { 'fill-color': 'red' },
        metadata: {
          parentId: 'my-layer',
          descriptor: '["==",["get","class"],"is-red"]',
          conditions: [
            {
              conditionType: 'case',
              type: 'paint',
              key: 'fill-color',
              value: '["==",["get","class"],"is-red"]'
            }
          ]
        }
      },
      {
        id: 'my-layer-fallback',
        type: 'fill',
        source: 'composite',
        'source-layer': 'land',
        paint: { 'fill-color': 'fallback' },
        metadata: {
          parentId: 'my-layer',
          descriptor: 'fallback',
          conditions: [
            {
              conditionType: 'case',
              type: 'paint',
              key: 'fill-color',
              value: 'fallback'
            }
          ]
        }
      }
    ];

    expect(actual).toEqual(expected);
  });
});
