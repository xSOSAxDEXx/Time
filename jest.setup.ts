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
