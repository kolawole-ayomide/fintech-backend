import { IdempotencyService } from './idempotency.service';
import { ConflictError } from '@shared/errors/AppError';

jest.mock('@config/redis', () => ({
  __esModule: true,
  default: {
    set: jest.fn(),
    del: jest.fn(),
  },
}));

import redis from '@config/redis';

describe('IdempotencyService', () => {
  const service = new IdempotencyService();

  it('acquires a lock successfully when the key is free', async () => {
    (redis.set as jest.Mock).mockResolvedValue('OK');

    await expect(service.acquireLock('key-123')).resolves.toBeUndefined();
    expect(redis.set).toHaveBeenCalledWith(
      'idempotency:transfer:key-123',
      'locked',
      'EX',
      900,
      'NX'
    );
  });

  it('throws ConflictError when the key is already locked', async () => {
    (redis.set as jest.Mock).mockResolvedValue(null);

    await expect(service.acquireLock('key-123')).rejects.toThrow(ConflictError);
  });

  it('releases a lock by deleting the key', async () => {
    (redis.del as jest.Mock).mockResolvedValue(1);

    await service.releaseLock('key-123');

    expect(redis.del).toHaveBeenCalledWith('idempotency:transfer:key-123');
  });
});