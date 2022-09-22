import cartesian from 'cartesian';
import mergeWith from 'lodash.mergewith';
import { propertyValueComboLimitStore } from '../stores';
import { expression, latest } from '@mapbox/mapbox-gl-style-spec';
const { isExpression } = expression;
import { evaluateExpression } from './evaluate-expression';

let comboValueLimit;
propertyValueComboLimitStore.subscribe(value => {
  comboValueLimit = value;
});

const FALLBACKS = {
  string: 'FALLBACK',
  number: -1000,
  array: [],
  object: {},
  boolean: false
};

const mergeWithCustomizer = (objValue, srcValue) => {
  if (Array.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
};

// Math operators from the style spec
const mathOperators = Object.entries(
  latest?.expression_name?.values ?? {}
)?.reduce((acc, kv) => {
  const [k, v] = kv;
  if (v?.group === 'Math') {
    acc.push(k);
  }
  return acc;
}, []);

export const isHandledConditional = value => {
  if (!Array.isArray(value)) return false;
  if (mathOperators.includes(value[0])) {
    return value.some(v => isHandledConditional(v));
  }
  return value[0] === 'match' || value[0] === 'case';
};

export const isHandledScale = value => {
  const isInterpolate =
    value[0] === 'interpolate' && value?.[2]?.[0] === 'zoom';
  const isStep = value[0] === 'step' && value?.[1]?.[0] === 'zoom';
  const isScale = isInterpolate || isStep;
  return isScale && value.some(v => isHandledConditional(v));
};

// Parses a scale expression and returns all properties in nested conditionals along with relevant zooms
export const parseScaleExpression = value => {
  const [scaleType] = value;
  let inputOutputs = [];
  let zooms = [];
  let scaleOutputs = [];
  let outputs = [];
  let properties = {};

  // Pull out outputs and zooms from interpolation
  switch (scaleType) {
    case 'interpolate':
    case 'interpolate-hcl':
    case 'interpolate-lab': {
      inputOutputs = value.slice(3);
      inputOutputs.forEach((val, i) =>
        i % 2 !== 0 ? scaleOutputs.push(val) : zooms.push(val)
      );
      break;
    }
    case 'step': {
      inputOutputs = value.slice(2);
      inputOutputs.forEach((val, i) =>
        i % 2 === 0 ? scaleOutputs.push(val) : zooms.push(val)
      );
      break;
    }
  }
  for (const scaleOutput of scaleOutputs) {
    if (isHandledConditional(scaleOutput)) {
      const { outputs: scaleOutputs, properties: scaleProperties } =
        parseConditionalExpression(scaleOutput);
      outputs = [...new Set(outputs.concat(scaleOutputs))];
      properties = mergeWith(properties, scaleProperties, mergeWithCustomizer);
    }
  }
  return { zooms, outputs, properties };
};

// TODO this needs to be a little more advanced
// assumes one property for now
const parseCaseCondition = value => {
  const flatValue = value.flat(Infinity);
  const lookups = ['get', 'has', 'in'];
  const properties = flatValue.filter(
    (item, i) => i !== 0 && lookups.includes(flatValue[i - 1])
  );
  // Just first one for now assuming 1
  const property = properties[0];
  let inputs = flatValue.filter(
    item => !properties.includes(item) && !isExpression([item])
  );
  // This is a hack for ref length we should handle better
  if (flatValue.includes('length') && properties.length === 1) {
    inputs = inputs.map(num => `${num}`.repeat(num));
  }
  return { [property]: inputs };
};

// Returns properties and outputs of conditional expression
export const parseConditionalExpression = value => {
  const expressionType = value[0];
  let inputOutputs = [];
  let inputs = [];
  let outputs = [];
  let properties = {};

  switch (expressionType) {
    case 'case': {
      inputOutputs = value.slice(1);
      let caseInputs = [];
      const fallback = inputOutputs.pop();
      inputOutputs.forEach((val, i) =>
        i % 2 !== 0 ? outputs.push(val) : caseInputs.push(val)
      );
      outputs.push(fallback);

      caseInputs.forEach(input => {
        const caseProperties = parseCaseCondition(input);
        inputs = inputs.concat(caseInputs);
        properties = mergeWith(properties, caseProperties, mergeWithCustomizer);
      });

      break;
    }
    case 'match': {
      inputOutputs = value.slice(2);
      const fallback = inputOutputs.pop();
      inputOutputs.forEach((val, i) =>
        i % 2 !== 0 ? outputs.push(val) : inputs.push(val)
      );
      outputs.push(fallback);

      const flatCondition = value[1].flat(Infinity);
      // TODO this is naive handling to get a property similar to on case expressions
      const property = flatCondition.filter(v => !isExpression([v]))[0];

      // This is a hack for ref length we should handle better
      if (flatCondition.includes('length')) {
        inputs = inputs.map(num => `${num}`.repeat(num));
      }

      properties = { [property]: inputs.flat(Infinity) };
      break;
    }
  }

  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i];
    if (isHandledConditional(output)) {
      const {
        inputs: nestedInputs,
        outputs: nestedOutputs,
        properties: nestedProperties
      } = parseConditionalExpression(output);

      outputs.splice(i, 1, ...nestedOutputs);
      inputs = inputs.concat(nestedInputs);
      properties = mergeWith(properties, nestedProperties, mergeWithCustomizer);
    }
  }

  return {
    inputs,
    outputs: [...new Set(outputs)],
    properties
  };
};

// Gets the referenced data properties and referenced values from expressions
export const getPropertyValues = value => {
  let zooms = [];
  let properties = {};
  if (isHandledScale(value)) {
    ({ zooms, properties } = parseScaleExpression(value));
  } else {
    ({ properties } = parseConditionalExpression(value));
  }

  // TODO can we make this more reliable? Sets fallback based on type of value
  // If this causes problems, we may be better without fallbacks
  // Note: fallbacks defined are _likely_ fallback property values, but not guaranteed based on expression
  properties = Object.keys(properties).reduce((acc, prop) => {
    let valueType = typeof properties[prop][0];
    if (valueType === 'object' && Array.isArray(valueType)) {
      valueType = 'array';
    }
    const values =
      valueType !== undefined
        ? properties[prop].concat([FALLBACKS[valueType]])
        : properties[prop];
    acc[prop] = [...new Set(values)];
    return acc;
  }, {});

  return {
    propertyValues: properties,
    zooms
  };
};

export const getExpandableProperties = layer => {
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
    .reduce((agg, current) => agg.concat(current), [])
    .map(v => {
      const { propertyValues, zooms } = getPropertyValues(v.value);
      return { ...v, properties: propertyValues, zooms };
    });
};

// Returns an expression with non-conditional `get` expressions replaced by the name of the property as a string
// The property list contains all get expressions that are relevant to the conditions
const replaceInternalGets = (value, propertyList) => {
  if (!Array.isArray(value)) return value;
  if (value[0] === 'get' && !propertyList.includes(value[1])) return value[1];
  return value.map(v => replaceInternalGets(v, propertyList));
};

// Creates new expression for expanded layer based on the properties given
const evaluateExpressionForProperties = ({
  layerType,
  paintOrLayout,
  propertyId,
  value,
  properties,
  zoom
}) => {
  if (propertyId === 'text-field') {
    value = replaceInternalGets(value, Object.keys(properties));
  }
  const evaluated = evaluateExpression({
    layerType,
    propertyType: paintOrLayout,
    propertyId,
    properties,
    value,
    zoom
  });
  return evaluated;
};

// Creates new zoom based expression for expanded layer based on the properties given
// Scale expressions are always on the outermost expression
const createEvaluatedZoomExpression = (
  zooms,
  { layerType, paintOrLayout, propertyId, value, properties }
) => {
  const initialKey = `${paintOrLayout}_${layerType}`;
  const propertySpec = latest[initialKey][propertyId];
  const allowsInterpolate = propertySpec?.expression?.interpolated;

  let expression = [];

  if (allowsInterpolate) {
    expression.push('interpolate', ['linear'], ['zoom']);
  } else {
    expression.push('step', ['zoom']);
    zooms = [0, ...zooms];
  }

  for (let i = 0; i < zooms.length; i++) {
    const zoom = zooms[i];
    const evaluatedExpression = evaluateExpressionForProperties({
      layerType,
      paintOrLayout,
      propertyId,
      value,
      properties,
      zoom
    });
    if (!allowsInterpolate && zoom === 0 && i === 0) {
      expression.push(evaluatedExpression);
    }
    expression.push(zoom, evaluatedExpression);
  }

  return expression;
};

// Creates a layer for each combination of properties referenced in previous existing layer
export const expandLayer = layer => {
  const expandedProperties = getExpandableProperties(layer);
  if (!expandedProperties.length)
    return { expandedLayers: [layer], comboLimitHit: false };
  let zooms = [];
  let propertyPaths = [];
  let properties = {};

  expandedProperties.forEach(property => {
    let {
      type: propertyType,
      key: propertyId,
      properties: propertyData,
      value: propertyValue,
      zooms: propertyZooms
    } = property;

    propertyPaths.push([propertyType, propertyId]);
    properties = mergeWith(properties, propertyData, mergeWithCustomizer);

    // Add zooms 0.1 after actual zooms for step functions so that
    // we can safely create interpolate functions that look like step functions
    // TODO this is naive handling and doesn't account for exponential functions
    if (propertyZooms.length) {
      const scaleType = propertyValue[0];
      if (scaleType === 'step') {
        propertyZooms = propertyZooms.reduce((acc, z) => {
          acc.push(z, z + 0.1);
          return acc;
        }, []);
      }
    }

    zooms = [...new Set(zooms.concat(propertyZooms))];
  });

  let propertyCombos = cartesian(properties);

  // Dedupe the combos
  propertyCombos = propertyCombos.reduce((acc, combo) => {
    const hasCombo = acc.find(item =>
      Object.keys(item).every(k => combo[k] === item[k])
    );
    if (!hasCombo) {
      acc.push(combo);
    }
    return acc;
  }, []);

  const fullComboAmt = propertyCombos.length;
  propertyCombos = propertyCombos.slice(0, comboValueLimit);
  const slicedComboAmt = propertyCombos.length;

  let nextLayers = [];

  for (const combo of propertyCombos) {
    const nextLayer = JSON.parse(JSON.stringify(layer));

    let nextId = Object.keys(combo).reduce((acc, prop) => {
      const propValue =
        FALLBACKS[combo[prop]] !== undefined ? 'FALLBACK' : combo[prop];
      acc.push([prop, ': ', JSON.stringify(propValue)].join(''));
      return acc;
    }, []);
    nextId = `${nextLayer.id}/${nextId.join('/')}`;
    nextLayer.id = nextId;
    for (const path of propertyPaths) {
      const [paintOrLayout, propertyId] = path;
      let nextValue = nextLayer[paintOrLayout][propertyId];
      const args = {
        layerType: layer.type,
        paintOrLayout,
        propertyId,
        value: nextValue,
        properties: combo
      };

      if (zooms.length) {
        nextValue = createEvaluatedZoomExpression(zooms, args);
      } else {
        nextValue = evaluateExpressionForProperties(args);
      }
      // If next value is invalid, then remove the property
      if (nextValue === null) {
        delete nextLayer[paintOrLayout][propertyId];
      } else {
        nextLayer[paintOrLayout][propertyId] = nextValue;
      }
    }

    nextLayers.push(nextLayer);
  }

  return {
    expandedLayers: nextLayers,
    comboLimitHit: fullComboAmt > slicedComboAmt
  };
};
