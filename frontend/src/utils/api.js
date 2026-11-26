/**
 * AgriNexus API Client Utility
 * Manages in-memory JWT Bearer tokens, automatic header injection, and unauthorized session handling.
 */

let inMemoryAuthToken = '';

// Clean up any legacy token persistence keys from earlier versions
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    window.localStorage.removeItem('agrinexus_token');
    window.localStorage.removeItem('agrinexus_user');
  } catch {
    // Ignore storage access errors in restricted environments
  }
}

export const getAuthToken = () => inMemoryAuthToken;

export const setAuthToken = (token) => {
  inMemoryAuthToken = typeof token === 'string' ? token : '';
};

export const clearAuthToken = () => {
  inMemoryAuthToken = '';
};

const baseFetch =
  typeof window !== 'undefined' && typeof window.fetch === 'function'
    ? window.fetch.bind(window)
    : fetch;

export async function apiFetch(url, options = {}) {
  const urlStr = typeof url === 'string' ? url : url.toString();
  const nextOptions = { ...options };

  if (urlStr.startsWith('/api') && !urlStr.startsWith('/api/health')) {
    const token = getAuthToken();
    const existingHeaders = options.headers || {};
    const headers =
      existingHeaders instanceof Headers
        ? new Headers(existingHeaders)
        : { ...existingHeaders };

    if (token) {
      if (headers instanceof Headers) {
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      } else if (!headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    nextOptions.headers = headers;
  }

  const response = await baseFetch(url, nextOptions);

  if (
    response.status === 401 &&
    urlStr.startsWith('/api') &&
    !urlStr.includes('/api/auth/login') &&
    !urlStr.includes('/api/auth/signup') &&
    !urlStr.includes('/api/auth/admin-setup')
  ) {
    window.dispatchEvent(new CustomEvent('agrinexus:unauthorized'));
  }

  return response;
}
