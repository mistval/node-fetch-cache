import type { ReadableStream } from "stream/web";
import { FormData } from 'formdata-node';

export type FetchResource = Parameters<typeof fetch>[0];
export type FetchInit = Parameters<typeof fetch>[1];
export type CacheStrategy = (response: Response) => Promise<boolean> | boolean;

export { FormData };

export type NFCResponseMetadata = {
  url: string;
  redirected: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string[]>;
  counter: number;
};

export type INodeFetchCacheCache = {
  get(key: string): Promise<{
    bodyStream: ReadableStream;
    metaData: NFCResponseMetadata;
  } | undefined>;
  set(
    key: string,
    bodyStream: ReadableStream,
    metaData: NFCResponseMetadata
  ): Promise<{
    bodyStream: ReadableStream;
    metaData: NFCResponseMetadata;
  }>;
  remove(key: string): Promise<void | unknown>;
};

export type ISynchronizationStrategy = {
  doWithExclusiveLock<TReturnType>(
    key: string,
    action: () => Promise<TReturnType>,
  ): Promise<TReturnType>;
};
