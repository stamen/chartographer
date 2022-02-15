
const getExpandableProperties = layer => {
  return ['paint', 'layout']
    .map(type => {
      if (!layer[type]) return [];
      return Object.entries(layer[type])
	.map(([key, value]) => {
	  if (value[0] === 'case') return { type, key, value };
	  if (value[0] === 'match') return { type, key, value };
	})
	.filter(v => v);
    })
    .filter(v => v.length)
    .reduce((agg, current) => agg.concat(current), []);
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

  if (value[0] === 'case') {
    const [expressionType, ...cases] = value;

    for (let i = 0; i < cases.length; i += 2) {
      let descriptor = JSON.stringify(cases[i]);
      let caseValue = cases[i + 1];
      if (i === cases.length - 1) {
	descriptor = 'fallback';
	caseValue = cases[i];
      }
      expandedValues.push([descriptor, caseValue]);
    }
  }

  if (value[0] === 'match') {
    const [expressionType, input, ...matches] = value;

    for (let i = 0; i < matches.length; i += 2) {
      let descriptor = [
	JSON.stringify(input),
	JSON.stringify(matches[i]),
      ].join('==');
      let matchValue = matches[i + 1];

      if (i === matches.length - 1) {
	descriptor = 'fallback';
	matchValue = matches[i];
      }

      expandedValues.push([descriptor, matchValue]);
    }
  }

  if (expandedValues.length > 0) {
    // For each value to expand, create a new layer with that value, then
    // recurse to further expand the layer, if necessary
    return expandedValues
      .map(([descriptor, expandedValue]) => {
	let combinedDescriptor = descriptor;
	if (layer?.metadata?.descriptor) {
	  combinedDescriptor = `${layer.metadata.descriptor} > ${descriptor}`;
	}

	const newLayer = {
	  ...layer,
	  id: `${layer.id}-${descriptor}`,
	  metadata: {
	    parentId: layer?.metadata?.parentId ?? layer.id,
	    descriptor: combinedDescriptor,
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
  return layers.map(expandLayer)
    .reduce((agg, current) => agg.concat(current), []);
};
