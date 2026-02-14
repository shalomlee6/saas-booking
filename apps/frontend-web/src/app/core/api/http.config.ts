import { HttpInterceptorFn } from '@angular/common/http';

/** Prefer impersonation token so backend (which prefers Authorization Bearer) uses it. Keeps withCredentials via ApiService. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('sb_impersonation_token') || localStorage.getItem('sb_token');
  if (token) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(cloned);
  }
  return next(req);
};
