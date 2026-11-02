// In-memory AsyncStorage, as documented by the library.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The Android date/time picker is a native dialog. This fake records each
// open() call; tests answer it with `require(...).__pick(date)` or `__cancel()`.
jest.mock('@react-native-community/datetimepicker', () => {
  const calls: { value: Date; mode: string; onChange: (e: unknown, d?: Date) => void }[] = [];
  return {
    __calls: calls,
    __pick: (date: Date) => calls[calls.length - 1].onChange({ type: 'set' }, date),
    __cancel: () => calls[calls.length - 1].onChange({ type: 'dismissed' }),
    // Plain functions, not jest.fn(): mock resets between tests would wipe them.
    DateTimePickerAndroid: {
      open: (opts: (typeof calls)[number]) => calls.push(opts),
      dismiss: () => {},
    },
  };
});

// expo-file-system: an in-memory disk. `__files` maps uri → contents;
// `__nextPick` is the text the next file picker returns (null = cancelled).
jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  const state: { nextPick: string | null } = { nextPick: null };
  class Directory {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
  }
  class File {
    uri: string;
    constructor(dir: Directory | string, name?: string) {
      const base = typeof dir === 'string' ? dir : dir.uri;
      this.uri = name ? `${base}/${name}` : base;
    }
    get exists() {
      return files.has(this.uri);
    }
    create() {
      files.set(this.uri, '');
    }
    delete() {
      files.delete(this.uri);
    }
    async write(content: string) {
      files.set(this.uri, content);
    }
    async text() {
      return files.get(this.uri) ?? '';
    }
    // Plain functions, not jest.fn(): mock resets between tests would wipe them.
    static async pickFileAsync() {
      const text = state.nextPick;
      state.nextPick = null;
      if (text == null) return { canceled: true, result: null };
      files.set('file:///picked/backup.json', text);
      return { canceled: false, result: new File('file:///picked/backup.json') };
    }
  }
  return {
    __files: files,
    __setNextPick: (text: string | null) => {
      state.nextPick = text;
    },
    File,
    Directory,
    Paths: { cache: new Directory('file:///cache'), document: new Directory('file:///document') },
  };
});

// expo-sharing: records what was shared. `__shared` holds each call's arguments.
jest.mock('expo-sharing', () => {
  const shared: unknown[][] = [];
  return {
    __shared: shared,
    isAvailableAsync: async () => true,
    shareAsync: async (...args: unknown[]) => {
      shared.push(args);
    },
  };
});
