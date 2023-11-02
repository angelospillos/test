import api from './common';

export const login = (data) => api.post('/rest-auth/login/', data);

export const logout = () => api.post('/rest-auth/logout/');
