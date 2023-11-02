export const GLOBAL_VARIABLES = {
  TIMESTAMP: 'timestamp',
  NIP: 'nip',
  REGON: 'regon',
  PESEL: 'pesel',
};

export const VARIABLE_TYPE = {
  EVALUATE: 'evaluate',
  ELEMENT: 'element',
  VALUE: 'value',
};

// fields that can be computed
export const COMPUTABLE_FIELDS = [
  'selector',
  'url',
  'username',
  'password',
  'value',
  'assertionExpectedValue',
  'frameLocation',
  'dndDropOn',
  'dndDragOn',
  /*
    Also `code` and `assertionJavaScript`
    but they have own executors.
  */
];

// fields that can be computed and contain selectors list
export const COMPUTABLE_SELECTOR_FIELDS = ['selectors', 'dndDropSelectors'];

// fields that can be partially/fully converted to variables during recording
export const CONVERTABLE_FIELDS = [
  'url',
  'username',
  'password',
  'value',
  'assertionExpectedValue',
];
