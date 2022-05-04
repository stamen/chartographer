import { latest } from '@mapbox/mapbox-gl-style-spec';
import mergeWith from 'lodash.mergewith';
import merge from 'lodash.merge';

import { expression } from '@mapbox/mapbox-gl-style-spec';
const { isExpression } = expression;
import { evaluateExpression } from './evaluate-expression';

const mergeWithCustomizer = (objValue, srcValue) => {
  if (Array.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
};

export const isHandledConditional = value => {
  if (!Array.isArray(value)) return false;
  return value[0] === 'match' || value[0] === 'case';
};

export const isHandledScale = value => {
  const isInterpolate =
    value[0] === 'interpolate' && value?.[2]?.[0] === 'zoom';
  const isStep = value[0] === 'step' && value?.[1]?.[0] === 'zoom';
  const isScale = isInterpolate || isStep;
  return isScale && value.some(v => isHandledConditional(v));
};

export const parseScaleExpression = value => {
  const [scaleType] = value;
  let inputOutputs = [];
  let zooms = [];
  let scaleOutputs = [];
  let inputs = [];
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
  const properties = flatValue.filter(
    (item, i) => i !== 0 && flatValue[i - 1] === 'get'
  );
  // Just first one for now assuming 1
  const property = properties[0];
  const inputs = flatValue.filter(
    item => !properties.includes(item) && !isExpression([item])
  );
  return { [property]: inputs };
};

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
      // TODO this is naive handling to get a property similar to on case expressions
      const property = value[1]
        .flat(Infinity)
        .filter(v => !isExpression([v]))[0];
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
    outputs: [...new Set(outputs)],
    properties
  };
};

export const getPropertyValues = value => {
  let zooms = [];
  let properties = {};
  if (isHandledScale(value)) {
    ({ zooms, properties } = parseScaleExpression(value));
  } else {
    ({ properties } = parseConditionalExpression(value));
  }

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

export const getPropertyCombos = properties => {
  const keys = Object.keys(properties);
  const values = Object.values(properties);
  let combos = [];
  const max = keys.length - 1;

  const helper = (arr, i) => {
    for (let j = 0; j < values[i].length; j++) {
      const a = arr.slice(0); // clone arr
      a.push({ [keys[i]]: values[i][j] });
      if (i === max) combos.push(a);
      else helper(a, i + 1);
    }
  };

  helper([], 0);

  // Merge and dedupe the combos
  combos = combos
    .map(arr => merge({}, ...arr))
    .reduce((acc, combo) => {
      const hasCombo = acc.find(item =>
        Object.keys(item).every(k => combo[k] === item[k])
      );
      if (!hasCombo) {
        acc.push(combo);
      }
      return acc;
    }, []);

  return combos;
};

const createExpression = ({
  layerType,
  paintOrLayout,
  propertyId,
  value,
  properties,
  zoom
}) => {
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

const createZoomExpression = (
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
    const evaluatedExpression = createExpression({
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

export const expandLayer = layer => {
  const expandedProperties = getExpandableProperties(layer);
  if (!expandedProperties.length) return [layer];
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

  const propertyCombos = getPropertyCombos(properties);

  let nextLayers = [];

  for (const combo of propertyCombos) {
    const nextLayer = JSON.parse(JSON.stringify(layer));

    let nextId = Object.keys(combo).reduce((acc, prop) => {
      acc.push([prop, '==', JSON.stringify(combo[prop])].join(''));
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
        nextValue = createZoomExpression(zooms, args);
      } else {
        nextValue = createExpression(args);
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

  return nextLayers;
};

const expandLayers = layers => {
  const nextLayers = layers.reduce((acc, l) => {
    acc = acc.concat(expandLayer(l));
    return acc;
  }, []);

  return nextLayers;
};

export { expandLayers };
