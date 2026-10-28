/**
 * In-memory stand-in for `expo-file-system`'s `File`/`Paths` API.
 *
 * ExportService writes with `new File(Paths.document, name).write(json)` and hands the
 * resulting `uri` to expo-sharing. Tests need to read that content back to assert what was
 * exported -- and, for round-trip tests, to feed it to ImportService. This keeps every write
 * in a Map keyed by uri.
 *
 * Automatic backups (#66) also need `Directory` -- create, list -- and `File.delete()`/`name`,
 * which model the real API's synchronous calls.
 *
 * Register with `jest.mock('expo-file-system', () => require('../../helpers/mockFileSystem'))`.
 */

const writes = new Map<string, string>();
const order: string[] = [];

export const Paths = {
  document: 'file:///test-documents',
  cache: 'file:///test-cache',
};

/** A directory argument may be a uri string or a `Directory`, as in the real API. */
const uriOf = (parent: string | Directory): string =>
  typeof parent === 'string' ? parent : parent.uri;

export class File {
  readonly uri: string;

  constructor(directory: string | Directory, filename: string) {
    this.uri = `${uriOf(directory)}/${filename}`;
  }

  get name(): string {
    return this.uri.slice(this.uri.lastIndexOf('/') + 1);
  }

  delete(): void {
    if (!writes.has(this.uri)) throw new Error(`No such file: ${this.uri}`);
    writes.delete(this.uri);
    order.splice(order.indexOf(this.uri), 1);
  }

  async write(contents: string): Promise<void> {
    if (!writes.has(this.uri)) order.push(this.uri);
    writes.set(this.uri, contents);
  }

  async text(): Promise<string> {
    const contents = writes.get(this.uri);
    if (contents === undefined) throw new Error(`No such file: ${this.uri}`);
    return contents;
  }

  get exists(): boolean {
    return writes.has(this.uri);
  }
}

const directories = new Set<string>();

export class Directory {
  readonly uri: string;

  constructor(parent: string | Directory, name: string) {
    this.uri = `${uriOf(parent)}/${name}`;
  }

  get exists(): boolean {
    return directories.has(this.uri);
  }

  create(options: { idempotent?: boolean; intermediates?: boolean } = {}): void {
    if (directories.has(this.uri) && !options.idempotent) {
      throw new Error(`Directory exists: ${this.uri}`);
    }
    directories.add(this.uri);
  }

  /** Files directly inside this directory. */
  list(): File[] {
    const prefix = `${this.uri}/`;
    return order
      .filter((uri) => uri.startsWith(prefix) && !uri.slice(prefix.length).includes('/'))
      .map((uri) => new File(this.uri, uri.slice(prefix.length)));
  }
}

/** Contents written to `uri`, or undefined if nothing was written there. */
export const readWritten = (uri: string): string | undefined => writes.get(uri);

/** Uri of the most recently created file, for tests that do not capture it directly. */
export const lastWrittenUri = (): string | undefined => order[order.length - 1];

/** Every uri written, in creation order. */
export const writtenUris = (): string[] => [...order];

/** Clear all recorded writes. Call from `beforeEach`. */
export const resetFileSystem = (): void => {
  writes.clear();
  order.length = 0;
  directories.clear();
};
