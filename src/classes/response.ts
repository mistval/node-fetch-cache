import type { ReadableStream } from "stream/web";
import { NFCResponseMetadata } from '../types.js';

async function createNFCResponseClass() {
  return class NFCResponse extends Response {
    static serializeMetaFromNodeFetchResponse(response: Response): NFCResponseMetadata {
      const headers = Array.from(response.headers.entries()).reduce<Record<string, string[]>>(function(headers, [key, value]) {
        headers[key] = [...(headers[key] ?? []), value];

        return headers;
      }, {})

      const metaData = {
        url: response.url,
        redirected: response.redirected,
        status: response.status,
        statusText: response.statusText,
        headers: headers,
        counter: (response as any).counter as number,
      };

      return metaData;
    }

    static cacheMissResponse(
      url: string,
    ) {
      return new NFCResponse(
        new Blob().stream() as ReadableStream,
        {
          url,
          redirected: false,
          status: 504,
          statusText: 'Gateway Timeout',
          headers: {},
          counter: 0,
        },
        async () => undefined,
        false,
        true,
      );
    }

    public override url;
    public override redirected;

    constructor(
      bodyStream: ReadableStream,
      public metaData: Omit<ResponseInit, 'headers'> & {
        url: string;
        redirected: boolean;
        counter: number;
        headers: Record<string, string[]>;
      },
      public readonly ejectFromCache: () => Promise<unknown>,
      public readonly returnedFromCache: boolean,
      public readonly isCacheMiss = false,
    ) {
      super(
        bodyStream,
        metaData as any
      );

      this.url = metaData.url;
      this.redirected = metaData.redirected
    }

    public override clone(): Response {
      return new NFCResponse(super.body as ReadableStream, this.metaData, this.ejectFromCache, this.returnedFromCache, this.isCacheMiss)
    }
  }
}

export type NFCResponseClass = Awaited<ReturnType<typeof createNFCResponseClass>>;
export type NFCResponse = InstanceType<NFCResponseClass>;

let cachedClass: NFCResponseClass | undefined;

export async function getNFCResponseClass() {
  if (!cachedClass) {
    cachedClass = await createNFCResponseClass();
  }

  return cachedClass;
}
