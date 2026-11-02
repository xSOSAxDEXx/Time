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

// expo-notifications: records what's scheduled. Tests set `__permission`
// ('granted' | 'undetermined' | 'denied') and read `__scheduled` (id → request).
jest.mock('expo-notifications', () => {
  const state = { permission: 'undetermined' as string, askAnswer: 'granted' as string };
  const scheduled = new Map<string, { content: unknown; trigger: { date: Date } }>();
  const result = (p: string) => ({
    granted: p === 'granted',
    canAskAgain: p !== 'denied',
    status: p,
  });
  // Plain functions, not jest.fn(): mock resets between tests would wipe them.
  return {
    __scheduled: scheduled,
    __setPermission: (p: string, askAnswer = 'granted') => {
      state.permission = p;
      state.askAnswer = askAnswer;
    },
    AndroidImportance: { HIGH: 4 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationHandler: () => {},
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    setNotificationCategoryAsync: async () => null,
    dismissNotificationAsync: async () => {},
    getLastNotificationResponseAsync: async () => null,
    addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
    setNotificationChannelAsync: async () => null,
    getPermissionsAsync: async () => result(state.permission),
    requestPermissionsAsync: async () => {
      state.permission = state.askAnswer;
      return result(state.permission);
    },
    cancelScheduledNotificationAsync: async (id: string) => {
      scheduled.delete(id);
    },
    scheduleNotificationAsync: async (req: {
      identifier: string;
      content: unknown;
      trigger: { date: Date };
    }) => {
      scheduled.set(req.identifier, req);
      return req.identifier;
    },
  };
});

// expo-location: tests set `__access` ('always' | 'whileUsing' | 'undetermined' |
// 'denied'), `__position`, and read `__geofences` (null when stopped).
jest.mock('expo-location', () => {
  const state = {
    access: 'undetermined' as string,
    askAnswer: 'always' as string,
    position: { latitude: 40, longitude: -75 },
    geofences: null as unknown[] | null,
  };
  const fg = () => ({
    granted: state.access === 'always' || state.access === 'whileUsing',
    canAskAgain: state.access !== 'denied',
  });
  return {
    __state: state,
    Accuracy: { High: 4 },
    GeofencingEventType: { Enter: 1, Exit: 2 },
    getForegroundPermissionsAsync: async () => fg(),
    getBackgroundPermissionsAsync: async () => ({ granted: state.access === 'always' }),
    requestForegroundPermissionsAsync: async () => {
      if (state.access === 'undetermined') state.access = state.askAnswer;
      return fg();
    },
    requestBackgroundPermissionsAsync: async () => ({ granted: state.access === 'always' }),
    getCurrentPositionAsync: async () => ({ coords: { ...state.position } }),
    hasStartedGeofencingAsync: async () => state.geofences != null,
    startGeofencingAsync: async (_task: string, regions: unknown[]) => {
      state.geofences = regions;
    },
    stopGeofencingAsync: async () => {
      state.geofences = null;
    },
  };
});

// expo-task-manager: keeps defined tasks so tests can run them (`__tasks`).
jest.mock('expo-task-manager', () => {
  const tasks = new Map<string, unknown>();
  return {
    __tasks: tasks,
    defineTask: (name: string, fn: unknown) => tasks.set(name, fn),
  };
});
