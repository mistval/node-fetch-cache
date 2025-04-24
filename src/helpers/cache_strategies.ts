import type { CacheStrategy } from '../types.js';

export const cacheOkayOnly: CacheStrategy = async (response: Response) => response.ok;
export const cacheNon5xxOnly: CacheStrategy = async (response: Response) => response.status < 500;
