export const isCloud = () => process.env.ENV === 'selenium';

export const isDebugEnabled = () =>
  process.env.ENV === 'development' || ['true', 'verbose'].includes(process.env.DEBUG);

export const isVerboseEnabled = () => process.env.DEBUG === 'verbose';
