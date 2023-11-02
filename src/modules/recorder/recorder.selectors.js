import { path, prop, pick, pathEq } from 'ramda';
import { createSelector } from 'reselect';

import { SCREEN_RESOLUTION_TYPE } from '~/constants/test';

export const selectRecorderDomain = (state) => state.recorder;

export const selectRecordingGroupSequence = createSelector(
  selectRecorderDomain,
  (state) => `00000000-0000-0000-0000-${String(path(['groupSequence'], state)).padStart(12, '0')}`,
);

export const selectProcessingData = createSelector(
  selectRecorderDomain,
  pick(['steps', 'stepsOrder', 'tabContext', 'cachedScreenshots', 'variables']),
);

export const selectRecordingTestIdAndDraftGroupId = createSelector(
  selectRecorderDomain,
  (state) => ({
    testId: path(['test', 'id'], state),
    // from backend
    groupId: path(['test', 'lastGroupId'], state),
  }),
);

export const selectIsRecordingOnMobile = createSelector(
  selectRecorderDomain,
  pathEq(['test', 'screenSizeType'], SCREEN_RESOLUTION_TYPE.MOBILE),
);

export const selectRecordingProfileId = createSelector(
  selectRecorderDomain,
  path(['test', 'runProfileId']),
);

export const selectRecordingProjectSettings = createSelector(
  selectRecorderDomain,
  path(['project', 'settings']),
);

export const selectRecordingProjectId = createSelector(
  selectRecorderDomain,
  path(['project', 'id']),
);

export const selectRecordingProjectSlug = createSelector(
  selectRecorderDomain,
  path(['project', 'slug']),
);

export const selectRecordingIncognitoMode = createSelector(
  selectRecordingProjectSettings,
  prop('incognitoMode'),
);

export const selectRecordingVariables = createSelector(selectRecorderDomain, prop('variables'));

export const selectRecordingContext = createSelector(selectRecorderDomain, prop('context'));

export const selectStepScreenshot = (stepId) =>
  createSelector(selectRecorderDomain, path(['cachedScreenshots', stepId]));

export const selectIsSaving = createSelector(selectRecorderDomain, prop('isSaving'));

export const selectIsRecording = createSelector(
  selectRecorderDomain,
  selectIsSaving,
  (state, isSaving) => prop('isRecording', state) && !isSaving,
);

export const selectRecordingMode = createSelector(selectRecorderDomain, prop('mode'));

export const selectIsMulitpleModeEnabled = createSelector(
  selectRecorderDomain,
  prop('multipleMode'),
);

export const selectRecordingTestId = createSelector(selectRecorderDomain, prop('testId'));

export const selectRecordingTestRunId = createSelector(selectRecorderDomain, prop('testRunId'));

export const selectRecordingLog = createSelector(selectRecorderDomain, prop('log'));

export const selectIsRecordingToClipboard = createSelector(
  selectRecorderDomain,
  prop('isClipboard'),
);

export const selectHasInitialState = createSelector(selectRecorderDomain, prop('isInitial'));

export const selectIsRecordingProcessing = createSelector(
  selectIsRecording,
  selectRecorderDomain,
  (isRecording, state) => isRecording && Boolean(state.processing.length),
);

export const selectRecordedStepsNumber = createSelector(selectRecorderDomain, prop('stepsNumber'));

export const selectPendingLocalVariableEvent = createSelector(
  selectRecorderDomain,
  prop('pendingLocalVariableEvent'),
);
