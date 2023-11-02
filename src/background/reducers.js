import { resettableReducer } from 'reduxsauce';

import actionStateReducer from '~/modules/actionState/actionState.redux';
import { CoreTypes, reducer as coreReducer } from '~/modules/core/core.redux';
import { reducer as extensionReducer } from '~/modules/extension/extension.redux';
import { reducer as projectReducer, ProjectTypes } from '~/modules/project/project.redux';
import { reducer as recorderReducer, RecorderTypes } from '~/modules/recorder/recorder.redux';
import { reducer as resultReducer } from '~/modules/runner/result.redux';
import { reducer as runnerReducer, RunnerTypes } from '~/modules/runner/runner.redux';
import { reducer as uistateReducer, UIStateTypes } from '~/modules/uistate/uistate.redux';
import { reducer as userReducer } from '~/modules/user/user.redux';
import { reducer as websocketReducer } from '~/modules/websocket/websocket.redux';
// <-- IMPORT MODULE REDUCER -->

export default () => ({
  actionState: resettableReducer(CoreTypes.SETUP_SESSION_REQUESTED)(actionStateReducer),
  user: userReducer,
  extension: extensionReducer,
  recorder: resettableReducer(RecorderTypes.RESET_REQUESTED)(recorderReducer),
  runner: resettableReducer(RunnerTypes.RESET_REQUESTED)(runnerReducer),
  result: resettableReducer(RunnerTypes.RESET_REQUESTED)(resultReducer),
  websocket: websocketReducer,
  uistate: resettableReducer(UIStateTypes.RESET_REQUESTED)(uistateReducer),
  core: coreReducer,
  project: resettableReducer(ProjectTypes.RESET_REQUESTED)(projectReducer),
  // <-- INJECT MODULE REDUCER -->
});
