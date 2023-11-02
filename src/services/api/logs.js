import api from '~/services/api/common';

export const uploadTestRunLogs = (testRunId, data) =>
  api.post(`/testruns/${testRunId}/logs/`, data);
