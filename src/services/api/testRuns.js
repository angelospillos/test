import api from './common';

export const get = (id) => api.get(`/testruns/${id}/?omit=test_archive,steps_runs`);
