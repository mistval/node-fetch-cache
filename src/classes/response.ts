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
        redirected: response.redirected,
        url: response.url,
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
          status: 504,
          statusText: 'Gateway Timeout',
          headers: {},
          counter: 0,
          redirected: false,
        },
        async () => undefined,
        false,
        true,
      );
    }

    static setUrlAndRedirected(target: Response, url: string, redirected: boolean) {
      Object.defineProperty(target, 'url', {
        get: () => url,
        enumerable: true,
        configurable: true,
      });

      Object.defineProperty(target, 'redirected', {
        get: () => redirected,
        enumerable: true,
        configurable: true,
      });
    }

    constructor(
      bodyStream: ReadableStream,
      metaData: Omit<ResponseInit, 'headers'> & {
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
        metaData as any,
      );

      NFCResponse.setUrlAndRedirected(this, metaData.url, metaData.redirected);
    }

    override clone(): Response {
      const superClone = super.clone();
      NFCResponse.setUrlAndRedirected(superClone, this.url, this.redirected);
      return superClone;
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
