import { path, pick } from 'ramda';

import { RunnerTypes } from '~/modules/runner/runner.redux';
import { websocketPrefix } from '~/modules/websocket/websocket.redux';

import Logger from './logger';

const logger = Logger.get('Redux Action');

const getActionData = (action) => {
  if (!action.type) {
    return action;
  }

  if (action.type.startsWith(websocketPrefix)) {
    return {
      type: action.command || path(['data', 'command'], action) || action.type,
      calledViaWebsocket: true,
    };
  }

  if (action.type === RunnerTypes.SET_POTENTIAL_TIMEOUT_REASON_REQUESTED) {
    return {
      type: action.type,
      ...(action.reason
        ? pick(['error', 'errorCode'], action.reason.params ?? { errorCode: '<empty>' })
        : {}),
    };
  }

  if (
    [RunnerTypes.RUN_STEP_REQUESTED, RunnerTypes.UPDATE_STEP_RUN_STATUS_REQUESTED].includes(
      action.type,
    )
  ) {
    return {
      type: action.type,
      ...pick(['stepId', 'stepRunId', 'status'], action),
      stepId: action.stepId ?? action.step?.id,
      ...(action.step
        ? {
            stepId: action.step.id,
            stepType: action.step.type,
          }
        : {}),
    };
  }

  return { type: action.type };
};

export default () => (next) => (action) => {
  const { type, ...actionData } = getActionData(action);
  if (!type) {
    return null;
  }
  const argsList = Object.keys(actionData).map((key) => `\n${key}: ${actionData[key]}`);
  logger.debugAction(type, ...argsList);

  return next(action);
};
