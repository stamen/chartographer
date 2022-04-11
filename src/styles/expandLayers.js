import { evaluateExpression } from './evaluate-expression';

const isHandledConditional = value => {
  if (!Array.isArray(value)) return false;
  return value[0] === 'match' || value[0] === 'case';
};

const isHandledScale = value => {
  const isInterpolate =
    value[0] === 'interpolate' && value?.[2]?.[0] === 'zoom';
  const isStep = value[0] === 'step' && value?.[1]?.[0] === 'zoom';
  const isScale = isInterpolate || isStep;
  return isScale && value.some(v => isHandledConditional(v));
};

const getExpandableProperties = layer => {
  return ['paint', 'layout']
    .map(type => {
      if (!layer[type]) return [];
      return Object.entries(layer[type])
        .map(([key, value]) => {
          if (isHandledConditional(value)) return { type, key, value };
          if (isHandledScale(value)) {
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
 * @param {string} layer - the layer the expression is part of
 * @param {string} type - 'layout' or 'paint'
 * @param {string} key - the property name
 * @param {Array} expression - the expression
 * @returns {Array} the expanded values
 */
const expandCaseExpression = (layer, type, key, expression) => {
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

// Spreads matching properties from arrays in match expressions so they can
// be followed along a scale function
const spreadMatchExpression = matchExp => {
  const inputOutputs = matchExp.slice(2);
  let fallback = inputOutputs.pop();

  if (Array.isArray(fallback) && fallback[0] === 'match') {
    fallback = spreadMatchExpression(fallback);
  }

  let nextInputOutputs = [];
  for (let i = 0; i < inputOutputs.length; i += 2) {
    nextInputOutputs.push([inputOutputs[i], inputOutputs[i + 1]]);
  }

  nextInputOutputs = nextInputOutputs.reduce((acc, pair) => {
    let [inputs, output] = pair;

    if (Array.isArray(output[0]) && output[0] === 'match') {
      output = spreadMatchExpression(output);
    }

    if (Array.isArray(inputs)) {
      inputs.forEach(input => {
        acc.push(input, output);
      });
    } else {
      acc.push(inputs, output);
    }
    return acc;
  }, []);

  const nextMatchExp = [
    matchExp[0],
    matchExp[1],
    ...nextInputOutputs,
    fallback
  ];

  return nextMatchExp;
};

// Turns nested expanded values into a conditional expression we can use to evaluate at different zooms
const nestedExpandedValuesToExpression = expanded => {
  let caseExpression = ['case'];
  if (Object.keys(expanded).length === 1) {
    return Object.values(expanded)[0].expandedValue;
  }
  const expression = Object.keys(expanded).reduce((acc, cond) => {
    let next = expanded[cond];
    if (next.descriptor) {
      if (JSON.parse(cond) !== 'fallback') {
        acc.push(['!=', ['index-of', cond, ['get', 'condition']], -1]);
      }
      acc.push(next.expandedValue);
      return acc;
    }
    if (JSON.parse(cond) !== 'fallback') {
      acc.push(['!=', ['index-of', cond, ['get', 'condition']], -1]);
    }
    acc.push(nestedExpandedValuesToExpression(next));
    return acc;
  }, []);
  caseExpression = caseExpression.concat(expression);
  return caseExpression;
};

// Creates nested obj of expanded values with a list of all conditions they use
const getNestedExpandedValues = (layer, allConditions) => {
  const expandableProperties = getExpandableProperties(layer);
  const { type, key, value } = expandableProperties[0];

  return expandValueByType(layer, type, key, value).reduce((acc, expV) => {
    let currentCondition = 'fallback';
    if (expV.condition.value !== 'fallback') {
      currentCondition =
        expV.condition.conditionType === 'case'
          ? JSON.parse(expV.condition.value)
          : ['==', expV.condition.input, expV.condition.value];
    }
    const nextConditions = allConditions
      ? allConditions.concat([currentCondition])
      : [currentCondition];

    if (!isHandledConditional(expV.expandedValue)) {
      acc[JSON.stringify(currentCondition)] = {
        ...expV,
        allConditions: nextConditions
      };
      return acc;
    }
    const nextLayer = {
      ...layer,
      [type]: {
        ...layer[type],
        [key]: expV.expandedValue
      }
    };
    const recursed = getNestedExpandedValues(nextLayer, nextConditions);
    acc[JSON.stringify(currentCondition)] = Object.keys(recursed).reduce(
      (accum, cond) => {
        const item = recursed[cond];
        accum[cond] = {
          ...item,
          descriptor: `${expV.descriptor}-${item.descriptor}`
        };
        return accum;
      },
      {}
    );
    return acc;
  }, {});
};

const flattenNestedExpandedValues = expanded => {
  return Object.keys(expanded).reduce((acc, cond) => {
    if (expanded[cond].descriptor) {
      acc.push(expanded[cond]);
    } else {
      acc = acc.concat(flattenNestedExpandedValues(expanded[cond]));
    }
    return acc;
  }, []);
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

  outputs = outputs.map(output => {
    if (output[0] === 'match') {
      return spreadMatchExpression(output);
    }
    return output;
  });

  let expandedOutputs = [];

  // Create a new expression to check values by
  // This lets us use the expression evaluator in Mapbox GL to determine
  // non-matching conditionals' values at zooms they aren't specified at
  let expandedValueScaleExpression = [scaleType];
  if (scaleType === 'interpolate') {
    expandedValueScaleExpression.push(interpolationType);
  }
  expandedValueScaleExpression.push(['zoom']);

  for (let i = 0; i < outputs.length; i++) {
    const val = outputs[i];
    const zoom = zooms[i];

    const isFirstStep = scaleType === 'step' && zoom === 0;

    if (!isFirstStep) {
      expandedValueScaleExpression.push(zoom);
    }

    // If a zoom output is not a conditional, just use the value and zoom and push the value to the new expression
    if (!isHandledConditional(val)) {
      expandedOutputs = expandedOutputs.concat([{ value: val, zoom }]);
      expandedValueScaleExpression.push(val);
      continue;
    }

    const nestedExpandedValues = getNestedExpandedValues({
      ...layer,
      [type]: {
        ...layer[type],
        [key]: val
      }
    });

    const conditionalExpression =
      nestedExpandedValuesToExpression(nestedExpandedValues);

    expandedValueScaleExpression.push(conditionalExpression);

    expandedOutputs = expandedOutputs.concat(
      flattenNestedExpandedValues(nestedExpandedValues).map(v => ({
        ...v,
        zoom
      }))
    );
  }

  // Reduce duplicates across zooms since we'll recalculate the expanded values
  expandedOutputs = expandedOutputs.reduce((acc, output) => {
    if (!acc.some(item => item.descriptor === output.descriptor)) {
      acc.push(output);
    }
    return acc;
  }, []);

  expandedOutputs = expandedOutputs.map(val => {
    let scaleExpression = [scaleType];
    if (scaleType === 'interpolate') {
      scaleExpression.push(interpolationType);
    }
    scaleExpression.push(['zoom']);

    zooms.forEach(zoom => {
      const isFirstStep = scaleType === 'step' && zoom === 0;

      if (!isFirstStep) {
        scaleExpression.push(zoom);
      }

      if (!val.expandedValue && val.value !== undefined) {
        // Really we should continue and ignore here
        scaleExpression.push(val.value);
      } else {
        const properties = {
          condition: val.allConditions.map(c => JSON.stringify(c))
        };

        const evaluated = evaluateExpression({
          layerType: layer.type,
          propertyType: type,
          propertyId: key,
          properties,
          value: expandedValueScaleExpression,
          zoom: Math.max(zoom, 1)
        });

        scaleExpression.push(evaluated);
      }
    });

    const nextVal = { ...val, expandedValue: scaleExpression };
    delete nextVal.allConditions;
    delete nextVal.zoom;
    return nextVal;
  });

  return expandedOutputs.filter(item => !!item.descriptor);
};

// Pass along appropriate args to the appropriate function
const expandValueByType = (layer, type, key, value) => {
  let expandedValues = [];
  switch (value[0]) {
    case 'case':
      expandedValues = expandCaseExpression(layer, type, key, value);
      break;
    case 'match':
      expandedValues = expandMatchExpression(layer, type, key, value);
      break;
    case 'interpolate':
    case 'step':
      if (isHandledScale(value)) {
        expandedValues = expandScaleCondtionals(layer, type, key, value);
      }
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

  const expandableProperties = getExpandableProperties(layer);
  if (expandableProperties.length === 0) return [layer];

  const { type, key, value } = expandableProperties[0];

  expandedValues = expandValueByType(layer, type, key, value);

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
