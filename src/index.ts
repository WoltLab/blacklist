import 'reflect-metadata';
import { Container } from 'typedi';

import { Manager } from './manager';

(async (): Promise<void> => {
  const manager = Container.get(Manager);
  await manager.setup();
  await manager.update();
  await manager.rebuildIndex();
})();
