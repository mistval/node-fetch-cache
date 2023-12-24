import fs from 'fs';
import crypto from 'crypto';
import { Buffer } from 'buffer';
import { Request } from 'node-fetch';
import type { FetchInit, FetchResource, FormDataInternal } from '../types.js';
import { FormData } from '../types.js';

export const CACHE_VERSION = 5;

function md5(string_: string) {
  return crypto.createHash('md5').update(string_).digest('hex');
}

function getFormDataCacheKey(formData: FormData) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const cacheKey = { ...formData } as FormDataInternal;
  const boundary = formData.getBoundary();

  delete cacheKey._boundary;

  const boundaryReplaceRegex = new RegExp(boundary, 'g');

  cacheKey._streams = cacheKey._streams.map(s => {
    if (typeof s === 'string') {
      return s.replace(boundaryReplaceRegex, '');
    }

    return s;
  });

  return cacheKey;
}

function getHeadersCacheKeyJson(headers: string[][]): string[][] {
  return headers
    .map(([key, value]) => [key!.toLowerCase(), value!])
    .filter(([key, value]) => key !== 'cache-control' || value !== 'only-if-cached');
}

function getBodyCacheKeyJson(body: any): string | FormDataInternal | undefined {
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
    return getFormDataCacheKey(body);
  }

  if (body instanceof Buffer) {
    return body.toString();
  }

  throw new Error('Unsupported body type. Supported body types are: string, number, undefined, null, url.URLSearchParams, fs.ReadStream, FormData');
}

function getRequestCacheKey(request: Request) {
  return {
    headers: getHeadersCacheKeyJson([...request.headers.entries()]),
    method: request.method,
    redirect: request.redirect,
    referrer: request.referrer,
    url: request.url,
    body: getBodyCacheKeyJson(request.body),
  };
}

export function calculateCacheKey(resource: FetchResource, init?: FetchInit) {
  const resourceCacheKeyJson = resource instanceof Request
    ? getRequestCacheKey(resource)
    : { url: resource, body: undefined };

  const initCacheKeyJson = {
    body: undefined as (undefined | string | FormDataInternal),
    ...init,
    headers: getHeadersCacheKeyJson(Object.entries(init?.headers ?? {})),
  };

  resourceCacheKeyJson.body = getBodyCacheKeyJson(resourceCacheKeyJson.body);
  initCacheKeyJson.body = getBodyCacheKeyJson(initCacheKeyJson.body);

  delete initCacheKeyJson.agent;

  return md5(JSON.stringify([resourceCacheKeyJson, initCacheKeyJson, CACHE_VERSION]));
}
