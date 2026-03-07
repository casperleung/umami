import { buildPath } from '@/lib/url';

export interface ErrorResponse {
  error: {
    status: number;
    message: string;
    code?: string;
  };
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  data?: any;
  error?: ErrorResponse;
}

export async function request(
  method: string,
  url: string,
  body?: string,
  headers: object = {},
): Promise<FetchResponse> {
  return fetch(url, {
    method,
    cache: 'no-cache',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...headers,
    },
    body,
  }).then(async res => {
    let data: any = null;
    const contentType = res.headers.get('content-type') || '';

    if (res.status === 204) {
      data = {};
    } else if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }

    if (data === null) {
      const text = await res.text().catch(() => '');

      if (!text) {
        data = res.ok
          ? {}
          : {
              error: {
                status: res.status,
                message: res.statusText || 'Unexpected empty response',
              },
            };
      } else {
        try {
          data = JSON.parse(text);
        } catch {
          data = res.ok
            ? { message: text }
            : {
                error: {
                  status: res.status,
                  message: text,
                },
              };
        }
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
    };
  });
}

export async function httpGet(path: string, params: object = {}, headers: object = {}) {
  return request('GET', buildPath(path, params), undefined, headers);
}

export async function httpDelete(path: string, params: object = {}, headers: object = {}) {
  return request('DELETE', buildPath(path, params), undefined, headers);
}

export async function httpPost(path: string, params: object = {}, headers: object = {}) {
  return request('POST', path, JSON.stringify(params), headers);
}

export async function httpPut(path: string, params: object = {}, headers: object = {}) {
  return request('PUT', path, JSON.stringify(params), headers);
}
