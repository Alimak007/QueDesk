import { http } from '@/lib/api';

export const authApi = {
  session: () => http.get('/auth/session').then((d) => d.user ?? null),
  login: (credentials) => http.post('/auth/login', credentials).then((d) => d.user),
  logout: () => http.post('/auth/logout'),
  updateProfile: (body) => http.patch('/auth/me', body).then((d) => d.user),
  changePassword: (body) => http.post('/auth/change-password', body).then((d) => d.user),
};
