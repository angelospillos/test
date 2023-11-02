/* eslint-disable max-classes-per-file */
import { nanoid } from 'nanoid';
import { omit } from 'ramda';

import { LOGS_UPLOAD_TIMEOUT } from '~/constants/test';
import i18n from '~/translations';

const INTERACTION_POSITION_OUT_OF_VIEWPORT = 'INTERACTION_POSITION_OUT_OF_VIEWPORT';
const SELECTOR_REQUIRED = 'SELECTOR_REQUIRED';
const ASSERT_FAILED = 'ASSERT_FAILED';
const UNRECOGNIZED_STEP_TYPE = 'UNRECOGNIZED_STEP_TYPE';

export const INITIALIZATION_ERROR = 'INITIALIZATION_ERROR';
export const STEP_RUN_INITIALIZATION_ERROR = 'STEP_RUN_INITIALIZATION_ERROR';
export const SCROLL_FAILED = 'SCROLL_FAILED';
export const NEXT_STEP_ELEMENT_REQUIRED = 'NEXT_STEP_ELEMENT_REQUIRED';
export const NEXT_ACTIVE_STEP_WITH_ELEMENT_REQUIRED = 'NEXT_ACTIVE_STEP_WITH_ELEMENT_REQUIRED';
export const WINDOW_OR_TAB_DOES_NOT_EXIST = 'WINDOW_OR_TAB_DOES_NOT_EXIST';
export const TAB_CLOSED = 'TAB_CLOSED';
export const DEBUGGER_DETACHED = 'DEBUGGER_DETACHED';
export const FRAME_DOES_NOT_EXIST = 'FRAME_DOES_NOT_EXIST';
export const ELEMENT_DOES_NOT_EXIST = 'ELEMENT_DOES_NOT_EXIST';
export const TIMEOUT = 'TIMEOUT';
export const FAILED_WAITING_CONDITIONS = 'FAILED_WAITING_CONDITIONS';
export const CODE_EXECUTION_ERROR = 'CODE_EXECUTION_ERROR';
export const RUNTIME_ERROR = 'RUNTIME_ERROR';
export const REQUEST_ERROR = 'REQUEST_ERROR';
export const WEBSOCKET_ERROR = 'WEBSOCKET_ERROR';
export const TYPED_TEXT_DIFFERENT_THAN_EXPECTED = 'TYPED_TEXT_DIFFERENT_THAN_EXPECTED';
export const MISSING_GOTO_STEP = 'MISSING_GOTO_STEP';
export const UNCHANGABLE_ELEMENT = 'UNCHANGABLE_ELEMENT';
export const INVALID_ELEMENT_SELECTOR = 'INVALID_ELEMENT_SELECTOR';
export const VALUE_COMPUTING_ERROR = 'VALUE_COMPUTING_ERROR';
export const VARIABLE_NESTING_LIMIT_EXCEEDED = 'VARIABLE_NESTING_LIMIT_EXCEEDED';
export const PAGE_LOADING_ERROR = 'PAGE_LOADING_ERROR';
export const EVENT_DISPATCHED_ON_INVALID_ELEMENT = 'EVENT_DISPATCHED_ON_INVALID_ELEMENT';
export const DIFFERENT_EXTENSION_DETECTED = 'DIFFERENT_EXTENSION_DETECTED';
export const FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR';
export const FILE_DOES_NOT_EXIST = 'FILE_DOES_NOT_EXIST';
export const WINDOW_MINIMIZED = 'WINDOW_MINIMIZED';
export const INVALID_URL = 'INVALID_URL';
export const INVALID_DATA_FORMAT = 'INVALID_DATA_FORMAT';
export const FRAME_IS_NOT_INITIALIZED = 'FRAME_IS_NOT_INITIALIZED';
export const INVALID_OPTION_INDEX = 'INVALID_OPTION_INDEX';
export const MISSING_OPTION_VALUE = 'MISSING_OPTION_VALUE';
export const MISSING_OPTION_TEXT = 'MISSING_OPTION_TEXT';
export const MISSING_OPTION_INDEX = 'MISSING_OPTION_INDEX';
export const INVALID_MOUSE_INPUT_PARAMS = 'INVALID_MOUSE_INPUT_PARAMS';
export const INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE';
export const MISSING_STEP_SCREENSHOT = 'MISSING_STEP_SCREENSHOT';
export const MISSING_ELEMENT_SCREENSHOT = 'MISSING_ELEMENT_SCREENSHOT';
export const WEBSOCKET_SETUP_ERROR = 'WEBSOCKET_SETUP_ERROR';
export const TAKING_SCREENSHOT_TIMEOUT = 'TAKING_SCREENSHOT_TIMEOUT';
export const PROMPT_DOES_NOT_EXIST = 'PROMPT_DOES_NOT_EXIST';
export const INVALID_PROMP_ANSWER = 'INVALID_PROMP_ANSWER';
export const UNHANDLED_PROMPT = 'UNHANDLED_PROMPT';
export const UNSUPPORTED_BROWSER = 'UNSUPPORTED_BROWSER';
export const FRAME_LOADS_TOO_LONG = 'FRAME_LOADS_TOO_LONG';
export const VARIABLE_DOES_NOT_EXIST = 'VARIABLE_DOES_NOT_EXIST';

export const EXCEPTIONS_TO_DUMP_STATE = [
  TIMEOUT,
  EVENT_DISPATCHED_ON_INVALID_ELEMENT,
  INTERACTION_POSITION_OUT_OF_VIEWPORT,
  SCROLL_FAILED,
  WINDOW_OR_TAB_DOES_NOT_EXIST,
  INITIALIZATION_ERROR,
  TAKING_SCREENSHOT_TIMEOUT,
  STEP_RUN_INITIALIZATION_ERROR,
  PAGE_LOADING_ERROR,
];

export const SERIALIZABLE_ERROR_FIELDS = [
  'stack',
  'message',
  'params',
  'name',
  'error',
  'errorCode',
  'errorId',
  'isHandled',
  'response',
];

export class RunnerError extends Error {
  constructor(name, message = null, errorCode, params = {}) {
    super(message || params.message || errorCode);

    this.params = {
      ...omit(['stack', 'message', 'name'], params),
      errorCode,
      error: params.error || message || params.message,
      errorId: nanoid(8).toLowerCase(),
    };

    this.name = name;
    if (params.stack) {
      this.stack = params.stack;
    } else {
      Error.captureStackTrace(this, RunnerError);
    }
  }
}

export class UnrecognizedStepTypeError extends RunnerError {
  constructor(params) {
    super('UnrecognizedStepTypeError', null, UNRECOGNIZED_STEP_TYPE, params);
  }
}

export class RuntimeError extends RunnerError {
  constructor(params) {
    super('RuntimeError', null, RUNTIME_ERROR, params);
  }
}

export class RequestError extends RunnerError {
  constructor(params) {
    super('RequestError', null, REQUEST_ERROR, params);
  }
}

export class InteractionPositionOutOfViewportError extends RunnerError {
  constructor(params) {
    super(
      'InteractionPositionOutOfViewportError',
      null,
      INTERACTION_POSITION_OUT_OF_VIEWPORT,
      params,
    );
  }
}

export class InvalidElementSelectorError extends RunnerError {
  constructor(selector, params) {
    super('InvalidElementSelectorError', selector, INVALID_ELEMENT_SELECTOR, params);
  }
}

export class SelectorRequiredError extends RunnerError {
  constructor() {
    super('SelectorRequiredError', null, SELECTOR_REQUIRED);
  }
}

export class AssertFailedError extends RunnerError {
  constructor() {
    super('AssertFailedError', null, ASSERT_FAILED);
  }
}

export class UnchangableElement extends RunnerError {
  constructor() {
    super('UnchangableElement', null, UNCHANGABLE_ELEMENT);
  }
}

export class FileUploadError extends RunnerError {
  constructor() {
    super('FileUploadError', null, FILE_UPLOAD_ERROR);
  }
}

export class FileDoesNotExist extends RunnerError {
  constructor() {
    super('FileDoesNotExist', null, FILE_DOES_NOT_EXIST);
  }
}

export class ScrollFailedError extends RunnerError {
  constructor(params) {
    super('ScrollFailedError', null, SCROLL_FAILED, params);
  }
}

export class NextActiveStepWithElementRequiredError extends RunnerError {
  constructor(params) {
    super(
      'NextActiveStepWithElementRequiredError',
      null,
      NEXT_ACTIVE_STEP_WITH_ELEMENT_REQUIRED,
      params,
    );
  }
}

export class NextStepElementRequiredError extends RunnerError {
  constructor(params) {
    super('NextStepElementRequiredError', null, NEXT_STEP_ELEMENT_REQUIRED, params);
  }
}

export class NextStepElementContitionsFailedError extends RunnerError {
  constructor(params) {
    super('NextStepElementRequiredError', null, NEXT_STEP_ELEMENT_REQUIRED, params);
  }
}

export class ElementDoesNotExist extends RunnerError {
  constructor(params) {
    super('ElementDoesNotExist', null, ELEMENT_DOES_NOT_EXIST, params);
  }
}

export class CodeExecutionError extends RunnerError {
  constructor(params) {
    super('CodeExecutionError', null, CODE_EXECUTION_ERROR, params);
  }
}

export class TabClosed extends RunnerError {
  constructor(params) {
    super('TabClosed', null, TAB_CLOSED, params);
  }
}

export class DebuggerDetached extends RunnerError {
  constructor() {
    super('DebuggerDetached', null, DEBUGGER_DETACHED, {
      message: i18n.t(
        'exceptions.debuggerDetached.defaultMessage',
        'Debugger was detached unexpectedly by the user',
      ),
    });
  }
}

export class InitializationError extends RunnerError {
  constructor(params) {
    super('InitializationError', null, INITIALIZATION_ERROR, params);
  }
}

export class StepRunInitializationError extends RunnerError {
  constructor(params) {
    super('StepRunInitializationError', null, STEP_RUN_INITIALIZATION_ERROR, params);
  }
}

export class UnsupportedBrowser extends RunnerError {
  constructor(params) {
    super('UnsupportedBrowser', null, UNSUPPORTED_BROWSER, params);
  }
}

export class MissingGotoStep extends RunnerError {
  constructor(params) {
    super('MissingGotoStep', null, MISSING_GOTO_STEP, params);
  }
}

export class FailedWaitingConditions extends RunnerError {
  constructor() {
    super('FailedWaitingConditions', null, FAILED_WAITING_CONDITIONS);
  }
}

export class ValueComputingError extends RunnerError {
  constructor(params) {
    super('ValueComputingError', null, VALUE_COMPUTING_ERROR, params);
  }
}

export class VariableNestingLimitExceeded extends RunnerError {
  constructor(params) {
    super('VariableNestingLimitExceeded', null, VARIABLE_NESTING_LIMIT_EXCEEDED, params);
  }
}

export class PageLoadingError extends RunnerError {
  constructor(message, params) {
    super('PageLoadingError', message, PAGE_LOADING_ERROR, params);
  }
}

export class WindowOrTabDoesNotExist extends RunnerError {
  constructor(params) {
    super('WindowOrTabDoesNotExist', null, WINDOW_OR_TAB_DOES_NOT_EXIST, params);
  }
}

export class FrameLoadsTooLong extends RunnerError {
  constructor(params) {
    super('FrameLoadsTooLong', null, FRAME_LOADS_TOO_LONG, params);
  }
}

export class EventDispatchedOnInvalidElement extends RunnerError {
  constructor(invalidElementSelector) {
    super(
      'EventDispatchedOnInvalidElement',
      invalidElementSelector,
      EVENT_DISPATCHED_ON_INVALID_ELEMENT,
    );
  }
}

export class WebsocketError extends RunnerError {
  constructor(message) {
    super('WebsocketError', message, WEBSOCKET_ERROR);
  }
}

export class TypedTextDifferentThanExpected extends RunnerError {
  constructor(params) {
    super('TypedTextDifferentThanExpected', null, TYPED_TEXT_DIFFERENT_THAN_EXPECTED, params);
  }
}

export class WindowMinimized extends RunnerError {
  constructor() {
    super('WindowMinimized', null, WINDOW_MINIMIZED);
  }
}

export class InvalidUrl extends RunnerError {
  constructor(params) {
    super('InvalidUrl', null, INVALID_URL, params);
  }
}

export class FrameDoesNotExist extends RunnerError {
  constructor(message) {
    super('FrameDoesNotExist', message, FRAME_DOES_NOT_EXIST);
  }
}

export class InvalidDataFormat extends RunnerError {
  constructor(message) {
    super('InvalidDataFormat', message, INVALID_DATA_FORMAT);
  }
}

export class FrameIsNotInitialized extends RunnerError {
  constructor(message) {
    super('FrameIsNotInitialized', message, FRAME_IS_NOT_INITIALIZED);
  }
}

export class InvalidOptionIndex extends RunnerError {
  constructor(message) {
    super('InvalidOptionIndex', message, INVALID_OPTION_INDEX);
  }
}

export class MissingOptionIndex extends RunnerError {
  constructor(message) {
    super('MissingOptionIndex', message, MISSING_OPTION_INDEX);
  }
}

export class MissingOptionText extends RunnerError {
  constructor(message) {
    super('MissingOptionText', message, MISSING_OPTION_TEXT);
  }
}

export class MissingOptionValue extends RunnerError {
  constructor(message) {
    super('MissingOptionValue', message, MISSING_OPTION_VALUE);
  }
}

export class InvalidMouseInputParams extends RunnerError {
  constructor(message) {
    super('InvalidMouseInputParams', message, INVALID_MOUSE_INPUT_PARAMS);
  }
}

export class InvalidFieldValue extends RunnerError {
  constructor(params) {
    super('InvalidFieldValue', null, INVALID_FIELD_VALUE, params);
  }
}

export class TakingScreenshotTimeout extends RunnerError {
  constructor() {
    super('TakingScreenshotTimeout', null, TAKING_SCREENSHOT_TIMEOUT);
  }
}

export class MissingStepScreenshot extends RunnerError {
  constructor(message) {
    super('MissingStepScreenshot', message);
  }
}

export class LogsUploadTimeout extends RunnerError {
  constructor() {
    super('LogsUploadTimeout', null, LOGS_UPLOAD_TIMEOUT);
  }
}

export class MissingElementScreenshot extends RunnerError {
  constructor(message) {
    super('MissingElementScreenshot', message);
  }
}

export class InvalidRequestParams extends RunnerError {
  constructor(paramsList) {
    super('InvalidRequestParams', paramsList);
  }
}

export class WebSocketSetupError extends RunnerError {
  constructor(params) {
    super('WebSocketSetupError', null, WEBSOCKET_SETUP_ERROR, params);
  }
}

export class PromptDoesNotExist extends RunnerError {
  constructor(params) {
    super('PromptDoesNotExist', null, PROMPT_DOES_NOT_EXIST, params);
  }
}

export class UnhandledPrompt extends RunnerError {
  constructor(params) {
    super('UnhandledPrompt', null, UNHANDLED_PROMPT, params);
  }
}

export class VariableDoesNotExist extends RunnerError {
  constructor(params) {
    super('VariableDoesNotExist', null, VARIABLE_DOES_NOT_EXIST, params);
  }
}
