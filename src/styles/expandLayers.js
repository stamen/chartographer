const getExpandableProperties = layer => {
  return ['paint', 'layout']
    .map(type => {
      if (!layer[type]) return [];
      return Object.entries(layer[type])
        .map(([key, value]) => {
          if (value[0] === 'case') return { type, key, value };
          if (value[0] === 'match') return { type, key, value };
          if (
            (value[0] === 'interpolate' || value[0] === 'step') &&
            value.flat(Infinity).some(v => v === 'match' || v === 'case')
          ) {
            return { type, key, value };
          }
        })
        .filter(v => v);
    })
    .filter(v => v.length)
    .reduce((agg, current) => agg.concat(current), []);
};

/**
 * Expand a case expression to all the possible values the case could output
 *
 * @param {string} type - 'layout' or 'paint'
 * @param {string} key - the property name
 * @param {Array} expression - the expression
 * @returns {Array} the expanded values
 */
const expandCaseExpression = (type, key, expression) => {
  const [expressionType, ...cases] = expression;
  let expandedValues = [];

  for (let i = 0; i < cases.length; i += 2) {
    let descriptor = JSON.stringify(cases[i]);
    let output = cases[i + 1];
    if (i === cases.length - 1) {
      descriptor = 'fallback';
      output = cases[i];
    }
    expandedValues.push({
      descriptor,
      expandedValue: output,
      condition: {
        conditionType: 'case',
        type,
        key,
        value: descriptor
      }
    });
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
 * @returns {Array} the expanded values
 */
const expandMatchExpression = (layer, type, key, expression) => {
  const [expressionType, input, ...matches] = expression;
  let expandedValues = [];

  for (let i = 0; i < matches.length; i += 2) {
    let matchSeekValue = matches[i];
    let output = matches[i + 1];

    let descriptor = [
      JSON.stringify(input),
      JSON.stringify(matchSeekValue)
    ].join('==');

    if (i === matches.length - 1) {
      descriptor = matchSeekValue = 'fallback';
      output = matches[i];
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

    expandedValues.push({
      descriptor,
      expandedValue: output,
      condition: {
        conditionType: 'match',
        type,
        key,
        input,
        value: matchSeekValue
      }
    });
  }

  return expandedValues;
};

// -----------------------------------------------------------------------------------------------------------------------

const expandInterpolateCondtionals = (layer, type, key, value) => {
  const [interpolationType] = value;

  let inputOutputs = [];
  let zooms = [];
  let outputs = [];

  // Pull out outputs and zooms from interpolation
  switch (interpolationType) {
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
      const fallback = inputOutputs.pop();
      zooms.push(0);
      inputOutputs.forEach((val, i) =>
        i % 2 === 0 ? outputs.push(val) : zooms.push(val)
      );
      outputs.push(fallback);
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
      id: `${layer.id}-${zooms[i]}`,
      [type]: {
        ...layer[type],
        [key]: val
      }
    };
    let nextValues =
      val[0] === 'match'
        ? expandMatchExpression(fakeLayer, type, key, val)
        : expandCaseExpression(type, key, val);
    nextValues = nextValues.map(v => ({ ...v, zoom }));
    expandedOutputs = expandedOutputs.concat(nextValues);
    nextValues.forEach(val => dataPropertyValues.add(val.condition.value));
  }

  // For each data property value referenced, create interpolation across all zooms
  const expandedInterpolateValues = [...dataPropertyValues].reduce((acc, v) => {
    // Outputs filtered to those relevant by property
    const filteredOutputs = expandedOutputs.filter(
      output => output.condition.value === v
    );

    // Build interpolation expression
    let exp =
      interpolationType === 'step'
        ? [interpolationType]
        : [interpolationType, ['linear']];

    exp.push(['zoom']);

    for (let i = 0; i < zooms.length; i++) {
      const output =
        filteredOutputs[i] || filteredOutputs[filteredOutputs.length - 1];
      const zoom = zooms[i];
      const isFirstStep = output.zoom === 0 && interpolationType === 'step';
      if (!isFirstStep) {
        exp.push(zoom);
      }
      exp.push(output.expandedValue);
    }

    // Grab the first expanded value data structure which should be the same except for value we're replacing
    let nextExpandedValue = filteredOutputs[0];
    nextExpandedValue.expandedValue = exp;
    delete nextExpandedValue.zoom;

    acc.push(nextExpandedValue);
    return acc;
  }, []);

  return expandedInterpolateValues;
};

// -----------------------------------------------------------------------------------------------------------------------

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

  const expandableProperties = getExpandableProperties(layer);
  if (expandableProperties.length === 0) return [layer];

  const { type, key, value } = expandableProperties[0];

  switch (value[0]) {
    case 'case':
      expandedValues = expandCaseExpression(type, key, value);
      break;
    case 'match':
      expandedValues = expandMatchExpression(layer, type, key, value);
      break;
    case 'interpolate':
    case 'step':
      expandedValues = expandInterpolateCondtionals(layer, type, key, value);
      break;
    default:
      break;
  }

  if (expandedValues.length > 0) {
    // For each value to expand, create a new layer with that value, then
    // recurse to further expand the layer, if necessary
    return expandedValues
      .map(({ descriptor, expandedValue, condition }) => {
        let combinedDescriptor = descriptor;
        if (layer?.metadata?.descriptor) {
          combinedDescriptor = `${layer.metadata.descriptor} > ${descriptor}`;
        }

        let conditions = [...(layer?.metadata?.conditions ?? [])];
        if (condition) conditions.push(condition);

        const newLayer = {
          ...layer,
          id: `${layer.id}-${descriptor}`,
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

        return expandLayer(newLayer);
      })
      .reduce((agg, current) => agg.concat(current), []);
  }

  return [layer];
};

export const expandLayers = layers => {
  return layers
    .map(expandLayer)
    .reduce((agg, current) => agg.concat(current), []);
};
