import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const BASE_URL = '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = BASE_URL;

  constructor(private readonly http: HttpClient) {}

  get<T>(path: string): Observable<T> {
    const url = path.startsWith('/') ? `${this.baseUrl}${path}` : `${this.baseUrl}/${path}`;
    return this.http.get<T>(url, { withCredentials: true });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    const url = path.startsWith('/') ? `${this.baseUrl}${path}` : `${this.baseUrl}/${path}`;
    return this.http.post<T>(url, body, { withCredentials: true });
  }

  put<T>(path: string, body: unknown): Observable<T> {
    const url = path.startsWith('/') ? `${this.baseUrl}${path}` : `${this.baseUrl}/${path}`;
    return this.http.put<T>(url, body, { withCredentials: true });
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    const url = path.startsWith('/') ? `${this.baseUrl}${path}` : `${this.baseUrl}/${path}`;
    return this.http.patch<T>(url, body, { withCredentials: true });
  }

  delete<T>(path: string): Observable<T> {
    const url = path.startsWith('/') ? `${this.baseUrl}${path}` : `${this.baseUrl}/${path}`;
    return this.http.delete<T>(url, { withCredentials: true });
  }
}
