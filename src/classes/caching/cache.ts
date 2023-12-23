export interface INodeFetchCacheCache {
    get(key: string): Promise<{
        bodyStream: NodeJS.ReadableStream;
        metaData: object;
    } | undefined>;
    remove(key: string): Promise<unknown>;
    set(key: string, bodyStream: NodeJS.ReadableStream, metaData: object): Promise<{
        bodyStream: NodeJS.ReadableStream;
        metaData: object;
    }>;
}
