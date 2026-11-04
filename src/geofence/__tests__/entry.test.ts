import { GEOFENCE_TASK } from '../native';

jest.mock('expo-router/entry', () => ({}));

// Android starts the app's code with no screen when it reports arriving or
// leaving with the app closed, so the task must come from the entry file.
it('the entry file defines the arrive-and-leave task before any screen loads', () => {
  const tasks = (jest.requireMock('expo-task-manager') as { __tasks: Map<string, unknown> })
    .__tasks;
  tasks.clear();
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loads the entry file fresh
    require('../../../index');
  });
  expect(tasks.has(GEOFENCE_TASK)).toBe(true);
});

it('package.json starts the app from that entry file', () => {
  expect(require('../../../package.json').main).toBe('index.ts');
});
