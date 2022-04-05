const isHandledConditional = value => {
  if (!Array.isArray(value)) return false;
  return value[0] === 'match' || value[0] === 'case';
};

const getExpandableProperties = layer => {
  return ['paint', 'layout']
    .map(type => {
      if (!layer[type]) return [];
      return Object.entries(layer[type])
        .map(([key, value]) => {
          if (isHandledConditional(value)) return { type, key, value };
          if (
            (value[0] === 'interpolate' || value[0] === 'step') &&
            value.some(v => isHandledConditional(v))
          ) {
            return { type, key, value };
          }
        })
        .filter(v => v);
    })
    .filter(v => v.length)
    .reduce((agg, current) => agg.concat(current), []);
};

const createDescriptor = (propertyId, condition) => {
  return `${propertyId}-${
    typeof condition === 'string' ? condition : JSON.stringify(condition)
  }`;
};

/**
 * Expand a case expression to all the possible values the case could output
 *
 * @param {string} layer - the layer the expression is part of
 * @param {string} type - 'layout' or 'paint'
 * @param {string} key - the property name
 * @param {Array} expression - the expression
 * @param {string} [prevDescriptor] - the previous descriptor in nested conditionals
 * @returns {Array} the expanded values
 */
const expandCaseExpression = (layer, type, key, expression, prevDescriptor) => {
  const [expressionType, ...cases] = expression;
  let expandedValues = [];

  for (let i = 0; i < cases.length; i += 2) {
    let descriptor = prevDescriptor ? `${prevDescriptor}-` : '';
    descriptor = descriptor + createDescriptor(key, cases[i]);
    let output = cases[i + 1];
    if (i === cases.length - 1) {
      descriptor = createDescriptor(key, 'fallback');
      output = cases[i];
    }

    let nextValues = [];

    if (isHandledConditional(output)) {
      nextValues = expandValueByType(layer, type, key, output, descriptor);
    } else {
      nextValues = [
        {
          descriptor,
          expandedValue: output,
          condition: {
            conditionType: 'case',
            type,
            key,
            value: descriptor
          }
        }
      ];
    }

    expandedValues = expandedValues.concat(nextValues);
  }
  return expandedValues;
};

/**
 * Expand a match expression to all the possible values the match could output
 *
 * @param {string} layer - the layer the expression is part of
 * @param {string} type - 'layout' or 'paint'
 * @param {string} key - the property name
 * @param {string} expression - the expression
 * @param {string} [prevDescriptor] - the previous descriptor in nested conditionals
 * @returns {Array} the expanded values
 */
const expandMatchExpression = (
  layer,
  type,
  key,
  expression,
  prevDescriptor
) => {
  const [expressionType, input, ...matches] = expression;
  let expandedValues = [];

  for (let i = 0; i < matches.length; i += 2) {
    let matchSeekValue = matches[i];
    let output = matches[i + 1];

    let descriptor = prevDescriptor ? `${prevDescriptor}-` : '';

    if (i === matches.length - 1) {
      descriptor = matchSeekValue =
        descriptor + createDescriptor(key, 'fallback');
      output = matches[i];
    } else {
      descriptor =
        descriptor +
        createDescriptor(
          key,
          [JSON.stringify(input), JSON.stringify(matchSeekValue)].join('==')
        );
    }

    // Look at layer metadata to see if matches traversed thus far are
    // mutually exclusive to this candidate layer. If so, don't add this
    // layer.
    const existingMatches = layer?.metadata?.conditions ?? [];
    const existingMatchesAreMutuallyExclusive = existingMatches.some(
      otherMatch => {
        if (JSON.stringify(input) !== JSON.stringify(otherMatch.input))
          return false;
        if (Array.isArray(matchSeekValue) && Array.isArray(otherMatch.value)) {
          return !matchSeekValue.some(v => otherMatch.value.indexOf(v) >= 0);
        }
        return matchSeekValue !== otherMatch.value;
      }
    );

    if (existingMatchesAreMutuallyExclusive) continue;

    let nextValues = [];

    if (
      (Array.isArray(output) && output[0] === 'match') ||
      output[0] === 'case'
    ) {
      nextValues = expandValueByType(layer, type, key, output, descriptor);
    } else {
      nextValues = [
        {
          descriptor,
          expandedValue: output,
          condition: {
            conditionType: 'match',
            type,
            key,
            input,
            value: matchSeekValue
          }
        }
      ];
    }

    expandedValues = expandedValues.concat(nextValues);
  }

  return expandedValues;
};

/**
 * Expand a conditional expression inside a scale expression (interpolate or step)
 * We don't need an optional desriptor here since scale expressions can only happen
 * in the outermost wrapped expression so cannot be nested
 *
 * @param {string} layer - the layer the expression is part of
 * @param {string} type - 'layout' or 'paint'
 * @param {string} key - the property name
 * @param {string} expression - the expression
 * @returns {Array} the expanded values
 */
const expandScaleCondtionals = (layer, type, key, value) => {
  const [scaleType] = value;
  let interpolationType;
  if (scaleType !== 'step') {
    [, interpolationType] = value;
  }

  let inputOutputs = [];
  let zooms = [];
  let outputs = [];

  // Pull out outputs and zooms from interpolation
  switch (scaleType) {
    case 'interpolate':
    case 'interpolate-hcl':
    case 'interpolate-lab': {
      inputOutputs = value.slice(3);
      inputOutputs.forEach((val, i) =>
        i % 2 !== 0 ? outputs.push(val) : zooms.push(val)
      );
      break;
    }
    case 'step': {
      inputOutputs = value.slice(2);
      zooms.push(0);
      inputOutputs.forEach((val, i) =>
        i % 2 === 0 ? outputs.push(val) : zooms.push(val)
      );
      break;
    }
  }

  let dataPropertyValues = new Set();
  let expandedOutputs = [];

  // Expand individual outputs into expanded values and add zoom
  for (let i = 0; i < outputs.length; i++) {
    const val = outputs[i];
    const zoom = zooms[i];
    const fakeLayer = {
      ...layer,
      id: `${layer.id}-${zoom}`,
      [type]: {
        ...layer[type],
        [key]: val
      }
    };
    let nextValues = expandValueByType(fakeLayer, type, key, val);

    // Expand property values matched in array so we can track individual properties
    // across zooms
    nextValues = nextValues.reduce((acc, nextValue) => {
      let conditionValues = nextValue.condition.value;
      if (!Array.isArray(conditionValues)) {
        acc.push(nextValue);
        return acc;
      }

      for (const propValue of conditionValues) {
        const expandedVal = {
          ...nextValue,
          condition: { ...nextValue.condition, value: propValue },
          descriptor: createDescriptor(
            key,
            [
              JSON.stringify(nextValue.condition.input),
              JSON.stringify(propValue)
            ].join('==')
          )
        };

        acc.push(expandedVal);
      }
      return acc;
    }, []);

    // If there's no expanded values that means it's a literal value to pass on
    if (!nextValues.length) {
      nextValues = [{ expandedValue: val }];
    }

    nextValues = nextValues.map(v => ({ ...v, zoom }));
    expandedOutputs = expandedOutputs.concat(nextValues);
    nextValues.forEach(
      val =>
        val?.condition?.value && dataPropertyValues.add(val.condition.value)
    );
  }

  // For each data property value referenced, create interpolation across all zooms
  const expandedInterpolateValues = [...dataPropertyValues].reduce((acc, v) => {
    // Outputs filtered to those relevant by property
    // Expanded outputs always have an expandedValue and zoom property, with optional condition and descriptor
    const filteredOutputs = expandedOutputs
      .filter(output => !output.condition || output?.condition?.value === v)
      .sort((a, b) => a.zoom - b.zoom);

    // Build interpolation expression
    let exp =
      scaleType === 'step' ? [scaleType] : [scaleType, interpolationType];

    exp.push(['zoom']);

    if (filteredOutputs.length > 1) {
      for (let i = 0; i < filteredOutputs.length; i++) {
        const output = filteredOutputs[i];
        const isFirstStep = output.zoom === 0 && scaleType === 'step';
        if (!isFirstStep) {
          exp.push(output.zoom);
        }
        exp.push(output.expandedValue);
      }
    } else {
      exp = filteredOutputs[0].expandedValue;
    }

    // Grab the first expanded value data structure with a condition which should be the same except for value we're replacing
    // At least one output has a condition
    // It's not harmful to mutate this but makes debugging more difficult
    let nextExpandedValue = JSON.parse(
      JSON.stringify(filteredOutputs.find(o => !!o.condition))
    );
    nextExpandedValue.expandedValue = exp;
    delete nextExpandedValue.zoom;

    acc.push(nextExpandedValue);
    return acc;
  }, []);

  return expandedInterpolateValues;
};

// Pass along appropriate args to the appropriate function
const expandValueByType = (layer, type, key, value, descriptor) => {
  let expandedValues = [];
  switch (value[0]) {
    case 'case':
      expandedValues = expandCaseExpression(
        layer,
        type,
        key,
        value,
        descriptor
      );
      break;
    case 'match':
      expandedValues = expandMatchExpression(
        layer,
        type,
        key,
        value,
        descriptor
      );
      break;
    case 'interpolate':
    case 'step':
      expandedValues = expandScaleCondtionals(
        layer,
        type,
        key,
        value,
        descriptor
      );
      break;
    default:
      break;
  }
  return expandedValues;
};

/**
 * Expand a layer based on case and match expressions.
 *
 * The hope here is to get a series of valid layers for styling, where we
 * account for case and match expressions. For example, if a layer has a case
 * expression with two cases and a fallback, that layer will be expanded to
 * three separate layers, where each has the specific value for the case or
 * fallback that is relevant to it.
 */
const expandLayer = layer => {
  let expandedValues = [];
  let layers = [];

  const expandableProperties = getExpandableProperties(layer);
  if (expandableProperties.length === 0) return [layer];

  for (const expandableProperty of expandableProperties) {
    const { type, key, value } = expandableProperty;

    expandedValues = expandValueByType(layer, type, key, value);

    if (expandedValues.length > 0) {
      // For each value to expand, create a new layer with that value, then
      // recurse to further expand the layer, if necessary
      const nextLayers = expandedValues
        .map(({ descriptor, expandedValue, condition }) => {
          let combinedDescriptor = descriptor;
          if (layer?.metadata?.descriptor) {
            combinedDescriptor = `${layer.metadata.descriptor} > ${descriptor}`;
          }

          let conditions = [...(layer?.metadata?.conditions ?? [])];
          if (condition) conditions.push(condition);

          const nextLayerId = `${layer.id}-${descriptor}`;

          const newLayer = {
            ...layer,
            id: nextLayerId,
            metadata: {
              parentId: layer?.metadata?.parentId ?? layer.id,
              descriptor: combinedDescriptor,
              conditions
            },
            [type]: {
              ...layer[type],
              [key]: expandedValue
            }
          };

          return newLayer;
        })
        .reduce((agg, current) => agg.concat(current), []);

      layers = layers.concat(nextLayers);
    } else {
      layers = layers.concat([layer]);
    }
  }

  return layers;
};

export const expandLayers = layers => {
  return layers
    .map(layer => {
      // Until we have testing, better to wrap this and not break the app if something goes awry
      try {
        const expandedLayers = expandLayer(layer);
        return expandedLayers;
      } catch (err) {
        console.error(`There was a problem with expanding layers: ${err}`);
        return [layer];
      }
    })
    .reduce((agg, current) => agg.concat(current), []);
};
