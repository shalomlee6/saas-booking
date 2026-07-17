export interface Environment {
  production: boolean;
  useMocks: boolean;
  mockPublicApi: boolean;
  apiUrl: string;
  adminDomain: string;     // ← הוסף את זה
}

export const environment: Environment = {
  production: false,
  useMocks: false,
  mockPublicApi: false,
  /** Owner API base (empty = same-origin `/api` via proxy). */
  apiUrl: '',
  adminDomain: 'boki.co.il',
};
