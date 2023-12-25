import type { Response } from 'node-fetch';
import type { CacheStrategy } from '../types.js';

export const cacheOkayOnly: CacheStrategy = (response: Response) => response.ok;
export const cacheNon5xxOnly: CacheStrategy = (response: Response) => response.status < 500;
