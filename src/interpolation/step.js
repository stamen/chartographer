export function getStepFunction(expression) {
  return zoom => {
    const steps = expression.slice(2).reverse();
    for (let i = 0; i < steps.length; i++) {
      const currentValue = steps[i];
      const currentZoom = steps[i + 1];
      if (currentZoom && zoom >= currentZoom) return currentValue;
    }
    return steps[0];
  };
}
