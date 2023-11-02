import api from './common';

export const getList = (params) => api.get('/projects/', { params });
