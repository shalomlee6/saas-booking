import { HttpInterceptorFn } from '@angular/common/http';

/** Cookie-based auth for normal users. Bearer only for super-admin impersonation. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Guard for SSR / environments where localStorage is unavailable.
  const token =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('sb_impersonation_token')
      : null;
  if (token) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(cloned);
  }
  return next(req);
};
