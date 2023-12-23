export type INodeFetchCacheCache = {
  get(key: string): Promise<{
    bodyStream: NodeJS.ReadableStream;
    metaData: Record<string, unknown>;
  } | undefined>;
  remove(key: string): Promise<unknown>;
  set(key: string, bodyStream: NodeJS.ReadableStream, metaData: Record<string, unknown>): Promise<{
    bodyStream: NodeJS.ReadableStream;
    metaData: Record<string, unknown>;
  }>;
};
