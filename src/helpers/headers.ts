import { Request as NodeFetchRequest } from 'node-fetch';
import { FetchInit, FetchResource } from '../types.js';

function headerKeyIsCacheControl(key: string) {
  return key.trim().toLowerCase() === 'cache-control';
}

function headerValueContainsOnlyIfCached(cacheControlValue: string | undefined) {
  return cacheControlValue
    ?.split?.(',')
    .map(d => d.trim().toLowerCase())
    .includes('only-if-cached');
}

export function hasOnlyIfCachedOption(resource: FetchResource, init: FetchInit) {
  if (
    Object.entries(init?.headers ?? {})
      .some(
        ([key, value]) => headerKeyIsCacheControl(key) && headerValueContainsOnlyIfCached(value as string | undefined),
      )
  ) {
    return true;
  }

  if (
    resource instanceof NodeFetchRequest
    && headerValueContainsOnlyIfCached(resource.headers.get('Cache-Control') ?? undefined)
  ) {
    return true;
  }

  return false;
}
