import type fs from 'fs';
import fetch, { Response } from 'node-fetch';
import FormData from 'form-data';

export type FetchResource = Parameters<typeof fetch>[0];
export type FetchInit = Parameters<typeof fetch>[1];
export type CacheStrategy = (response: Response) => Promise<boolean> | boolean;

export type FormDataInternal = {
  _boundary?: string;
  _streams: Array<string | fs.ReadStream>;
} & FormData;

export { FormData };
