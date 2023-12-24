import type fs from 'fs';
import type fetch from 'node-fetch';
import FormData from 'form-data';
import type { NFCResponse } from './classes/response';

export type FetchResource = Parameters<typeof fetch>[0];
export type FetchInit = Parameters<typeof fetch>[1];
export type CacheStrategy = (response: NFCResponse) => Promise<boolean> | boolean;

export type FormDataInternal = {
  _boundary?: string;
  _streams: Array<string | fs.ReadStream>;
} & FormData;

export { FormData };
