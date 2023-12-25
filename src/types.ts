import type fs from 'fs';
import fetch, { Response as NodeFetchResponse } from 'node-fetch';
import FormData from 'form-data';

export type FetchResource = Parameters<typeof fetch>[0];
export type FetchInit = Parameters<typeof fetch>[1];
export type CacheStrategy = (response: NodeFetchResponse) => Promise<boolean> | boolean;

export type FormDataInternal = {
  _boundary?: string;
  _streams: Array<string | fs.ReadStream>;
} & FormData;

export { FormData };

export type NFCResponseMetadata = {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string[]>;
  size: number;
  timeout: number;
  counter: any;
};

export type INodeFetchCacheCache = {
  get(key: string): Promise<{
    bodyStream: NodeJS.ReadableStream;
    metaData: NFCResponseMetadata;
  } | undefined>;
  remove(key: string): Promise<void | unknown>;
  set(key: string, bodyStream: NodeJS.ReadableStream, metaData: NFCResponseMetadata): Promise<{
    bodyStream: NodeJS.ReadableStream;
    metaData: NFCResponseMetadata;
  }>;
};
