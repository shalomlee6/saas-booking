import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:5088/api',
  withCredentials: true
});

api.interceptors.request.use((config) => {
  // Use impersonation token if available, otherwise use normal token
  const impersonationToken = localStorage.getItem('sb_impersonation_token');
  const token = impersonationToken || localStorage.getItem('sb_token');
  
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});