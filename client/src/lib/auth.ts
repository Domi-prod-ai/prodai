// Auth helper – tisztán in-memory (deploy kompatibilis)

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface AuthCompany {
  id: number;
  name: string;
}

let _token: string | null = null;
let _user: AuthUser | null = null;
let _company: AuthCompany | null = null;

export function saveAuth(token: string, user: AuthUser, company: AuthCompany) {
  _token = token;
  _user = user;
  _company = company;
}

export function getToken(): string | null { return _token; }
export function getUser(): AuthUser | null { return _user; }
export function getCompany(): AuthCompany | null { return _company; }
export function isLoggedIn(): boolean { return !!_token; }

export function logout() {
  _token = null;
  _user = null;
  _company = null;
}

export function authHeaders(): Record<string, string> {
  return _token ? { Authorization: `Bearer ${_token}` } : {};
}

// Alias saveAuth-hoz (visszafelé kompatibilis)
export const setAuthData = saveAuth;
