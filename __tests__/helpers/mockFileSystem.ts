/**
 * In-memory stand-in for `expo-file-system`'s `File`/`Paths` API.
 *
 * ExportService writes with `new File(Paths.document, name).write(json)` and hands the
 * resulting `uri` to expo-sharing. Tests need to read that content back to assert what was
 * exported -- and, for round-trip tests, to feed it to ImportService. This keeps every write
 * in a Map keyed by uri.
 *
 * Register with `jest.mock('expo-file-system', () => require('../../helpers/mockFileSystem'))`.
 */

const writes = new Map<string, string>();
const order: string[] = [];

export const Paths = {
  document: 'file:///test-documents',
  cache: 'file:///test-cache',
};

export class File {
  readonly uri: string;

  constructor(directory: string, filename: string) {
    this.uri = `${directory}/${filename}`;
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
};
