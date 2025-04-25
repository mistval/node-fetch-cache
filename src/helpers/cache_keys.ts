import type { FetchInit, FetchResource } from '../types.js';
import { FormData } from '../types.js';
import * as fs from "fs";

export const CACHE_VERSION = 6;

async function sha1(string_: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(string_))),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
}

function getFormDataCacheKeyJson(formData: FormData) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const cacheKey = {
    type: 'FormData',
    entries: Array.from(formData.entries()),
  };

  return cacheKey;
}

function getHeadersCacheKeyJson(headers: string[][]): string[][] {
  return headers
    .map(([key, value]) => [key!.toLowerCase(), value!])
    .filter(([key, value]) => key !== 'cache-control' || value !== 'only-if-cached');
}

function getBodyCacheKeyJson(body: unknown): string | object | undefined {
  if (!body) {
    return undefined;
  }

  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  if (body instanceof fs.ReadStream) {
    return body.path.toString();
  }

  if (body instanceof FormData) {
    return getFormDataCacheKeyJson(body);
  }

  if (body instanceof ArrayBuffer) {
    return body.toString();
  }

  throw new Error('Unsupported body type. Supported body types are: string, number, undefined, null, url.URLSearchParams, fs.ReadStream, FormData');
}

async function getRequestCacheKeyJson(request: Request) {
  const body = await request.arrayBuffer();

  return {
    headers: getHeadersCacheKeyJson(Array.from(request.headers.entries())),
    method: request.method,
    redirect: request.redirect,
    referrer: request.referrer,
    url: request.url,
    body: getBodyCacheKeyJson(body),
    // Confirmed that this property exists, but it's not in the types
    follow: (request as any).follow, // eslint-disable-line @typescript-eslint/no-unsafe-assignment
    // Confirmed that this property exists, but it's not in the types
    compress: (request as any).compress // eslint-disable-line @typescript-eslint/no-unsafe-assignment
  };
}

export async function calculateCacheKey(resource: FetchResource, init?: FetchInit) {
  const resourceCacheKeyJson = resource instanceof Request
    ? await getRequestCacheKeyJson(resource)
    : { url: resource, body: undefined };

  const initCacheKeyJson = {
    body: undefined as (undefined | string | object),
    ...init,
    headers: getHeadersCacheKeyJson(Object.entries(init?.headers ?? {})),
  };

  resourceCacheKeyJson.body = getBodyCacheKeyJson(resourceCacheKeyJson.body);
  initCacheKeyJson.body = getBodyCacheKeyJson(initCacheKeyJson.body);

  // @ts-expect-error
  delete initCacheKeyJson.agent;

  return sha1(JSON.stringify([resourceCacheKeyJson, initCacheKeyJson, CACHE_VERSION]));
}
