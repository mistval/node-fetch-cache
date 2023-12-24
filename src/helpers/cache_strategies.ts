import type { NFCResponse } from '../classes/response.js';
import type { CacheStrategy } from '../types.js';

export const cacheOKAYOnly: CacheStrategy = (response: NFCResponse) => response.ok;
export const cacheNon5xxOnly: CacheStrategy = (response: NFCResponse) => response.status < 500;
