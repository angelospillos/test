export type Step = {
    id: string;                           // A unique identifier for the step
    type: string;                         // Type of step (e.g., click, input, assert, scroll, etc.)
    waitingConditions?: WaitingCondition[]; // Conditions under which this step should execute
    // Other properties depending on the action type, like target elements, input values, etc.
  };
  
  export type WaitingCondition = {
    type: string;  // Refers to one of the types in WAITING_CONDITION_TYPE
    params?: any;  // Additional parameters if needed for the condition
  };
  