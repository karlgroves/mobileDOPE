import databaseService from '../../../src/services/database/DatabaseService';
import {
  installTestDatabase,
  openDatabaseAsync,
  uninstallTestDatabase,
} from '../../helpers/testDatabase';

import type { TestDatabase } from '../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

/**
 * The test-database harness releases its own handles (#77).
 *
 * Every service suite installs one of these per test, so a handle the harness
 * forgets is a handle leaked a few hundred times a run. `DatabaseService.close()`
 * early-returns when its `db` is null, which is the state that would strand one:
 * a test that closed the service itself leaves the harness with nothing to close
 * through, and `active = null` then drops a live database.
 *
 * No suite does that today -- #77 checked. This guards the harness against a
 * future one, and against the coupling being changed rather than the caller.
 *
 * `node:sqlite`'s `DatabaseSync` is synchronous and holds no libuv handle, so
 * this is not what keeps the event loop open -- it is a correctness gap in the
 * harness, and the harness is the thing every other suite trusts.
 */

/** Whether the underlying sqlite handle is still usable. */
const isOpen = async (db: TestDatabase): Promise<boolean> => {
  try {
    await db.getAllAsync('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

describe('test database harness', () => {
  afterEach(async () => {
    await uninstallTestDatabase();
  });

  it('closes the handle on the ordinary path', async () => {
    const db = await installTestDatabase();
    expect(await isOpen(db)).toBe(true);

    await uninstallTestDatabase();

    expect(await isOpen(db)).toBe(false);
  });

  it('closes the handle itself rather than delegating to the service', async () => {
    // The leak path, forced. Calling `databaseService.close()` from a test does
    // not demonstrate this -- that call closes the handle on its way past, so
    // the assertion would hold even if the harness dropped it. Stubbing the
    // service's close to a no-op is what actually reproduces the state the
    // early-return in `DatabaseService.close()` creates: its reference is gone,
    // `active` is about to be reassigned, and nothing else knows about the
    // database.
    const db = await installTestDatabase();
    // Asserted before the spy goes in: `isOpen` reports false for *any* error,
    // so without this the test would also pass on a handle that was never
    // usable in the first place.
    expect(await isOpen(db)).toBe(true);

    const close = jest.spyOn(databaseService, 'close').mockResolvedValue(undefined);

    try {
      await uninstallTestDatabase();
    } finally {
      close.mockRestore();
    }

    expect(await isOpen(db)).toBe(false);
  });

  it('closes a still-open handle when a suite installs twice without uninstalling', async () => {
    // An unbalanced beforeEach/afterEach, or an install inside a test. The first
    // handle is otherwise unreachable the moment `active` is reassigned.
    const first = await installTestDatabase();
    expect(await isOpen(first)).toBe(true);

    const second = await installTestDatabase();

    expect(first).not.toBe(second);
    expect(await isOpen(first)).toBe(false);
    expect(await isOpen(second)).toBe(true);
  });

  it('tolerates being uninstalled twice', async () => {
    // afterEach runs after a test that already tore down; closing a closed
    // sqlite handle throws, so the second call must be a no-op rather than a
    // failure reported against an unrelated test.
    await installTestDatabase();
    await uninstallTestDatabase();

    await expect(uninstallTestDatabase()).resolves.toBeUndefined();
  });

  it('refuses to hand out a database once uninstalled', async () => {
    await installTestDatabase();
    await uninstallTestDatabase();

    await expect(openDatabaseAsync()).rejects.toThrow('No test database installed');
  });
});
