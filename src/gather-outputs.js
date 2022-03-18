// Gathers outputs of expression based on expression type
const gatherOutputs = exp => {
  // Prevent unwanted mutations
  const expression = JSON.parse(JSON.stringify(exp));
  if (typeof expression === 'number') return [expression];
  const outputs = [];
  const expressionType = expression.hasOwnProperty('stops')
    ? 'legacy'
    : expression[0];

  switch (expressionType) {
    case 'case': {
      let inputOutputs = expression.slice(1);
      const fallback = inputOutputs.pop();
      inputOutputs.forEach((val, i) => i % 2 !== 0 && outputs.push(val));
      outputs.push(fallback);
      break;
    }
    case 'match': {
      let inputOutputs = expression.slice(2);
      const fallback = inputOutputs.pop();
      inputOutputs.forEach((val, i) => i % 2 !== 0 && outputs.push(val));
      outputs.push(fallback);
      break;
    }
    case 'interpolate': {
      let inputOutputs = expression.slice(3);
      inputOutputs.forEach((val, i) => i % 2 !== 0 && outputs.push(val));
      break;
    }
    case 'step': {
      let inputOutputs = expression.slice(2);
      const fallback = inputOutputs.pop();
      inputOutputs.forEach((val, i) => i % 2 === 0 && outputs.push(val));
      outputs.push(fallback);
      break;
    }
    case 'legacy': {
      let inputOutputs = expression.stops;
      inputOutputs.forEach(val => outputs.push(val[1]));
      break;
    }
    default:
      return expression;
  }
  if (outputs.some(item => Array.isArray(item))) {
    return outputs.reduce((acc, item) => {
      if (Array.isArray(item)) {
        acc = acc.concat(gatherOutputs(item));
      } else {
        acc = acc.concat([item]);
      }
      return acc;
    }, []);
  }
  return outputs;
};

export { gatherOutputs };
