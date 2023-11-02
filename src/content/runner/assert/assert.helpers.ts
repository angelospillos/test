// TODO: Add proper type if steps types are already merged
export const getExpectedValue = (step) =>
  step.computedAssertionExpectedValue || step.assertionExpectedValue;
