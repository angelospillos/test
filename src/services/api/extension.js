import api from './common';

export const updateStepScreenshot = (data) => api.post('/draft-tests/step/screenshot/', data);
