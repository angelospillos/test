import api from './common';

export const updateExtensionSettings = (data) => api.put('/user-settings/extension/', data);
