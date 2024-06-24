
import util from 'util';
import 'dotenv/config.js';
import { expect } from 'chai';
import { createSandbox, SinonStubbedInstance, createStubInstance } from 'sinon';
import FetchCache, {
  RedisCache,
  NFCResponse,
} from '../src/index.js';

let redisStub: SinonStubbedInstance<any>;
let Redis: any;
let response: NFCResponse;

const wait = util.promisify(setTimeout);

const DUMMY_JSON_URL = 'https://dummyjson.com/products/1';
const expectedJson = {
  id: 1,
  title: 'Essence Mascara Lash Princess',
  description:
    'The Essence Mascara Lash Princess is a popular mascara known for its volumizing and lengthening effects. Achieve dramatic lashes with this long-lasting and cruelty-free formula.',
  category: 'beauty',
  price: 9.99,
  discountPercentage: 7.17,
  rating: 4.94,
  stock: 5,
};

describe('Redis cache tests', () => {
  before(async function () {
    try {
      // @ts-ignore
      const module = await import('ioredis');
      Redis = module.default;
    } catch {
      console.warn('Redis Cache Tests: ioredis is not installed, skipping tests');
      this.skip();
    }
  });

  let redisCache: SinonStubbedInstance<any>;
  let sandbox;
  let mockRedisInstance;

  beforeEach(() => {
    sandbox = createSandbox();

    if (Redis) {
      mockRedisInstance = createStubInstance(Redis);
    }

    // Inject the mock Redis instance into RedisClient
    redisCache = new RedisCache({}, mockRedisInstance);

    // Default behavior for redisCache.get
    mockRedisInstance.get.resolves(null);

    // Setup behavior for set and del affecting get
    mockRedisInstance.set.callsFake((key: string, value: string) => {
      mockRedisInstance.get.withArgs(key).resolves(value);
    });

    mockRedisInstance.del.callsFake((key: string) => {
      mockRedisInstance.get.withArgs(key).resolves(null);
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Supports TTL', async () => {
    redisCache = new RedisCache({ ttl: 100 }, mockRedisInstance);

    const redisCachedFetch = FetchCache.create({ cache: redisCache });

    let response = await redisCachedFetch(DUMMY_JSON_URL);
    expect(response.returnedFromCache).to.be.false;

    response = await redisCachedFetch(DUMMY_JSON_URL);
    expect(response.returnedFromCache).to.be.true;

    await wait(200);

    response = await redisCachedFetch(DUMMY_JSON_URL);
    expect(response.returnedFromCache).to.be.false;
  });

  it('Can get product JSON body', async () => {
    const redisCachedFetch = FetchCache.create({ cache: redisCache });

    response = await redisCachedFetch(DUMMY_JSON_URL);
    expect(response.returnedFromCache).to.be.false;

    const body1 = await response.json();
    expect(body1).to.be.an('object');
    expect(body1).to.include(expectedJson);

    response = await redisCachedFetch(DUMMY_JSON_URL);
    expect(response.returnedFromCache).to.be.true;

    const body2 = await response.json();
    expect(body2).to.be.an('object');
    expect(body2).to.include(expectedJson);
  });

  it('Can eject from cache', async () => {
    const redisCachedFetch = FetchCache.create({ cache: redisCache });

    response = await redisCachedFetch(DUMMY_JSON_URL);
    expect(response.returnedFromCache).to.be.false;

    response = await redisCachedFetch(DUMMY_JSON_URL);
    expect(response.returnedFromCache).to.be.true;

    await response.ejectFromCache();

    response = await redisCachedFetch(DUMMY_JSON_URL);
    expect(response.returnedFromCache).to.be.false;

    response = await redisCachedFetch(DUMMY_JSON_URL);
    expect(response.returnedFromCache).to.be.true;
  });

  // Should we be testing 'Cache-Control': 'only-if-cached' for redis?
});
