import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Builds the JSON API prefix used by HttpClient.
 * - Empty: same-origin `/api` (Angular dev proxy or app served with API under `/api`).
 * - Non-empty: `environment.apiUrl` may be either the API host (`https://api.example.com`)
 *   or the full API root already ending in `/api` — avoid doubling to `/api/api/...` (404s).
 */
function buildApiBaseUrl(): string {
  const raw = (environment.apiUrl ?? '').trim().replace(/\/$/, '');
  if (!raw) return '/api';
  if (raw.endsWith('/api')) return raw;
  return `${raw}/api`;
}

export type ApiQueryParams = Record<string, string | number | boolean | undefined | null>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = buildApiBaseUrl();

  constructor(private readonly http: HttpClient) {}

  private buildUrl(path: string): string {
    const segment = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${segment}`;
  }

  private toHttpParams(query?: ApiQueryParams): HttpParams | undefined {
    if (!query) return undefined;
    let params = new HttpParams();
    let has = false;
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
      has = true;
    }
    return has ? params : undefined;
  }

  get<T>(path: string, query?: ApiQueryParams): Observable<T> {
    return this.http.get<T>(this.buildUrl(path), {
      withCredentials: true,
      params: this.toHttpParams(query),
    });
  }

  post<T>(path: string, body: unknown, query?: ApiQueryParams): Observable<T> {
    return this.http.post<T>(this.buildUrl(path), body, {
      withCredentials: true,
      params: this.toHttpParams(query),
    });
  }

  put<T>(path: string, body: unknown, query?: ApiQueryParams): Observable<T> {
    return this.http.put<T>(this.buildUrl(path), body, {
      withCredentials: true,
      params: this.toHttpParams(query),
    });
  }

  /** POST multipart (e.g. file upload). Do not set Content-Type — browser sets boundary. */
  postFormData<T>(path: string, body: FormData, query?: ApiQueryParams): Observable<T> {
    return this.http.post<T>(this.buildUrl(path), body, {
      withCredentials: true,
      params: this.toHttpParams(query),
    });
  }

  patch<T>(path: string, body: unknown, query?: ApiQueryParams): Observable<T> {
    return this.http.patch<T>(this.buildUrl(path), body, {
      withCredentials: true,
      params: this.toHttpParams(query),
    });
  }

  delete<T>(path: string, query?: ApiQueryParams): Observable<T> {
    return this.http.delete<T>(this.buildUrl(path), {
      withCredentials: true,
      params: this.toHttpParams(query),
    });
  }

  /** DELETE with a JSON request body (used when the endpoint needs extra context, e.g. reason). */
  deleteWithBody<T>(path: string, body: unknown, query?: ApiQueryParams): Observable<T> {
    return this.http.request<T>('DELETE', this.buildUrl(path), {
      body,
      withCredentials: true,
      params: this.toHttpParams(query),
    });
  }
}
