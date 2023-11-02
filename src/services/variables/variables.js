import { Liquid } from 'liquidjs';
import {
  mapObjIndexed,
  path,
  prop,
  isNil,
  cond,
  propEq,
  T,
  invertObj,
  pickBy,
  isEmpty,
} from 'ramda';

import { VARIABLE_TYPE } from '~/constants/variables';
import {
  ValueComputingError,
  CodeExecutionError,
  VariableNestingLimitExceeded,
  VariableDoesNotExist,
} from '~/modules/runner/runner.exceptions';
import BaseService from '~/services/baseService';
import browser from '~/services/browser';

import {
  COMPUTED_VALUE_PREFIX,
  NOT_COMPUTED_VALUE,
  MAX_SUPPORTED_NESTING_LEVEL,
  TOO_DEEP_NESTING,
  UNDEFINED_VARIABLE,
} from './variables.constants';

const engine = new Liquid();

class Variables extends BaseService {
  constructor() {
    super('Variables');
  }

  #variables = {};

  #localVariables = {};

  #transformVariable = cond([
    [
      propEq('type', VARIABLE_TYPE.EVALUATE),
      (variable) => ({
        ...variable,
        computed: NOT_COMPUTED_VALUE,
      }),
    ],
    [
      T,
      (variable) => ({
        ...variable,
        computed: variable.value,
      }),
    ],
  ]);

  #getVariableValue = cond([
    [
      propEq('type', VARIABLE_TYPE.EVALUATE),
      async (variable, key, tabContext) =>
        browser.devTools.runtime.executeFunction(
          tabContext.currentTabId,
          variable.value,
          this.getComputedVariables(key),
        ),
    ],
    [T, prop('computed')],
  ]);

  getComputedVariables = (key) => mapObjIndexed(prop('computed'), this.getVariables(key));

  getVariables = (key) => ({
    ...((key ? this.#variables[key] : this.#variables) || {}),
    ...this.#localVariables,
  });

  getVariable = (sourceKey, key) => this.getVariables(sourceKey)[key];

  updateVariable = (sourceKey, key, variable) => {
    this.#variables[sourceKey][key] = { ...this.getVariable(sourceKey, key), ...variable };
  };

  isVariableComputed = (variable) =>
    variable?.computed !== NOT_COMPUTED_VALUE || !variable?.computed;

  #getOrderOfVariablesWithDependencies = (variables = {}) => {
    const variablesKeys = Object.keys(variables);
    const variablePriority = {};
    for (let index = 0; index < variablesKeys.length; index += 1) {
      const variableKey = variablesKeys[index];
      const variable = variables[variableKey];
      const { variablesKeys: variablesUsedInside } = this.#parseValue(
        variable.value ?? '',
        'value',
      );

      if (variablesUsedInside.length) {
        // Include only variables that have dependencies
        variablePriority[variableKey] = variablesUsedInside.length;
      }
    }
    return Object.keys(variablePriority).sort((a, b) => variablePriority[a] - variablePriority[b]);
  };

  markVariablesWithComputableDependencies = (key) => {
    const variables = this.getVariables(key);
    const variablesKeys = Object.keys(variables);

    for (let index = 0; index < variablesKeys.length; index += 1) {
      const variableKey = variablesKeys[index];
      const variable = variables[variableKey];
      const { variablesKeys: variablesUsedInside } = this.#parseValue(
        variable.value ?? '',
        'value',
      );

      const containsNotComputedVariable = variablesUsedInside.some(
        (usedVariableKey) => !this.isVariableComputed(variables[usedVariableKey]),
      );

      if (containsNotComputedVariable) {
        this.updateVariable(key, variableKey, {
          computed: NOT_COMPUTED_VALUE,
        });
      }
    }
  };

  precomputeVariables = async (key) => {
    const variables = this.getVariables(key);
    const sortedVariablesKeys = this.#getOrderOfVariablesWithDependencies(variables);

    // Compute variables
    for (let index = 0; index < sortedVariablesKeys.length; index += 1) {
      const variableKey = sortedVariablesKeys[index];
      const variable = variables[variableKey];
      if (variable.type !== VARIABLE_TYPE.EVALUATE) {
        // eslint-disable-next-line no-await-in-loop
        const { computedValue } = await this.computeValues({
          variablesSetKey: key,
          source: variable,
          sourceFields: ['value'],
          ignoreCodeExecution: true,
          throwExceptionOnUnsupportedNestingLevel: false,
          detectUndefinedVariables: false,
        });
        this.updateVariable(key, variableKey, {
          computed: computedValue || variable.value,
        });
      }
    }
  };

  setVariables = async (key, variablesMap = {}, shouldPrecompute) => {
    const preparedVariables = mapObjIndexed(this.#transformVariable, variablesMap);
    this.#variables[key] = preparedVariables;

    if (shouldPrecompute) {
      await this.precomputeVariables(key);
    }
    this.markVariablesWithComputableDependencies(key);
  };

  setLocalVariables = (variablesMap = {}) => {
    this.#localVariables = mapObjIndexed(this.#transformVariable, variablesMap);
  };

  setLocalVariable = async (key, variable, tabContext) => {
    const preparedVariable = this.#transformVariable(variable);
    const computedValue = await this.#getVariableValue(preparedVariable, key, tabContext);
    this.#localVariables[key] = { ...preparedVariable, computed: computedValue };
  };

  getLocalVariables = () => this.#localVariables;

  #getVariablesTypes = (template) => template.filter(prop('value')).map(path(['token', 'content']));

  #getComputedFieldKey = (key) =>
    `${COMPUTED_VALUE_PREFIX}${key.substring(0, 1).toUpperCase()}${key.substring(1)}`;

  #parseValue = (valueToParse, fieldKey) => {
    let parsedTemplate;
    try {
      parsedTemplate = engine.parse(valueToParse);
    } catch (error) {
      this.logInfo(`Trying to parse field "${fieldKey}" with value: "${valueToParse}"`);
      throw new ValueComputingError(error);
    }

    return {
      template: parsedTemplate,
      variablesKeys: this.#getVariablesTypes(parsedTemplate),
    };
  };

  #replaceVariablesToValues = async (
    variablesSetKey,
    valueToParse,
    template,
    variablesKeys,
    fieldKey,
    tabContext,
    ignoreCodeExecution,
    nestingLevel = 0,
  ) => {
    if (nestingLevel > MAX_SUPPORTED_NESTING_LEVEL) {
      this.logInfo('Too deep nesting level for value', valueToParse);
      throw new VariableNestingLimitExceeded();
    }

    const computedVariables = {};
    for (let v = 0; v < variablesKeys.length; v += 1) {
      const variableKey = variablesKeys[v];
      const variableData = { ...this.getVariable(variablesSetKey, variableKey) };

      if (isEmpty(variableData)) {
        throw new VariableDoesNotExist({
          error: variableKey,
        });
      }

      // If variable is built-in or created by a user
      if (variableData && !(ignoreCodeExecution && variableData.type === VARIABLE_TYPE.EVALUATE)) {
        const nestedParsingResult = this.#parseValue(variableData.computed, fieldKey);
        if (nestedParsingResult.variablesKeys.length) {
          // eslint-disable-next-line no-await-in-loop
          variableData.computed = await this.#replaceVariablesToValues(
            variablesSetKey,
            variableData.computed,
            nestedParsingResult.template,
            nestedParsingResult.variablesKeys,
            fieldKey,
            tabContext,
            ignoreCodeExecution,
            nestingLevel + 1,
          );
        }

        try {
          // eslint-disable-next-line no-await-in-loop
          computedVariables[variableKey] = await this.#getVariableValue(
            variableData,
            variablesSetKey,
            tabContext,
          );
        } catch (error) {
          throw new CodeExecutionError({
            error: error.message,
            forceFailed: true,
          });
        }

        this.updateVariable(variablesSetKey, variableKey, {
          computed: computedVariables[variableKey] ?? `${computedVariables[variableKey]}`,
        });
      }
    }

    return engine.renderSync(template, this.getComputedVariables(variablesSetKey));
  };

  computeValues = async ({
    variablesSetKey,
    source,
    sourceFields = [],
    executionContext = {},
    ignoreCodeExecution = false,
    throwExceptionOnUnsupportedNestingLevel = true,
    detectUndefinedVariables = true,
  }) => {
    const validSourceFields = sourceFields.filter((fieldKey) => !isNil(source[fieldKey]));
    const computedValues = {};

    for (let index = 0; index < validSourceFields.length; index += 1) {
      const fieldKey = validSourceFields[index];
      const computedFieldKey = this.#getComputedFieldKey(validSourceFields[index]);
      const valueToParse = source[computedFieldKey] || source[fieldKey];

      const { template, variablesKeys } = this.#parseValue(valueToParse, fieldKey);

      if (variablesKeys.length) {
        try {
          // eslint-disable-next-line no-await-in-loop
          computedValues[computedFieldKey] = await this.#replaceVariablesToValues(
            variablesSetKey,
            valueToParse,
            template,
            variablesKeys,
            fieldKey,
            executionContext,
            ignoreCodeExecution,
          );
        } catch (error) {
          if (error instanceof ValueComputingError && !throwExceptionOnUnsupportedNestingLevel) {
            // it handles case when we have nested variables and we don't want to throw an error eg. while recording
            computedValues[computedFieldKey] = TOO_DEEP_NESTING;
          } else if (error instanceof VariableDoesNotExist && !detectUndefinedVariables) {
            // it handles case when we have nested variables and we don't want to throw an error eg. while recording
            computedValues[computedFieldKey] = UNDEFINED_VARIABLE;
          } else {
            throw error;
          }
        }
      } else if (source[computedFieldKey]) {
        // If some variables was computed earlier and computed field exists e.g on BE.
        computedValues[computedFieldKey] = source[computedFieldKey];
      }
    }

    return computedValues;
  };

  convertTextFieldsToVariables = (
    sourceObject = {},
    fieldsToConvert = [],
    variablesSetKey,
    supportedVariables = [],
  ) => {
    const variablesToConvertFromText = supportedVariables.concat(['testRunId', 'testId']);
    const variables = pickBy(
      (value, key) =>
        variablesToConvertFromText.includes(key) && value && value !== NOT_COMPUTED_VALUE,
      this.getComputedVariables(variablesSetKey),
    );
    const valueToKeyMap = invertObj(variables);
    const variablesRegex = new RegExp(Object.keys(valueToKeyMap).join('|'), 'g');

    const convertedObject = { ...sourceObject };
    fieldsToConvert.forEach((fieldKey) => {
      const fieldValue = convertedObject[fieldKey];
      if (fieldValue && typeof fieldValue === 'string') {
        convertedObject[fieldKey] = fieldValue.replace(
          variablesRegex,
          (matched) => `{{${valueToKeyMap[matched]}}}`,
        );
      }
    });

    return convertedObject;
  };

  reset = ({ variables = {}, localVariables = {} } = {}) => {
    this.#variables = { ...variables };
    this.#localVariables = { ...localVariables };
  };
}

export default new Variables();
