import api from './common';

export const startToClipboard = (data) => api.post('/extension/clipboard/start-recording/', data);

export const stopToClipboard = (data) => api.post('/extension/clipboard/stop-recording/', data);

export const stop = (data) => api.post('/extension/stop-recording/', data);

export const updateSteps = (data, ignoreGlobalErrorCatch = false) =>
  api.post('/extension/recorder/update-steps/', data, {
    params: {
      ignoreGlobalErrorCatch,
    },
  });

export const getVariables = (testId, testRunId, profileId) =>
  api.get(`/extension/profiles/${profileId}/variables/`, {
    params: {
      test_id: testId,
      test_run_id: testRunId,
    },
  });
