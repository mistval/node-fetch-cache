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

function headerEntryIsCacheControlOnlyIfCached(pair: [string, string]) {
  return headerKeyIsCacheControl(pair[0]) && headerValueContainsOnlyIfCached(pair[1]);
}

export async function hasOnlyIfCachedOption(resource: FetchResource, init: FetchInit) {
  const initHeaderEntries = Object.entries(init?.headers ?? {});
  const initHeaderEntriesContainsCacheControlOnlyIfCached = initHeaderEntries.some(
    pair => headerEntryIsCacheControlOnlyIfCached(pair as [string, string]),
  );

  if (initHeaderEntriesContainsCacheControlOnlyIfCached) {
    return true;
  }

  const { Request: NodeFetchRequest } = await import('node-fetch');

  if (
    resource instanceof NodeFetchRequest
    && headerValueContainsOnlyIfCached(resource.headers.get('Cache-Control') ?? undefined)
  ) {
    return true;
  }

  return false;
}
