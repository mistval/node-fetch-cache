import locko from 'locko';
import { ISynchronizationStrategy } from '../types.js';

export class LockoSynchronizationStrategy implements ISynchronizationStrategy {
  async doWithExclusiveLock<TReturnType>(key: string, action: () => Promise<TReturnType>) {
    return locko.doWithLock(key, action);
  }
}
