import { GeofencingEventType, type LocationRegion } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { handleGeoEvent } from './handle';
import { GEOFENCE_TASK } from './native';

/**
 * Android runs this when the phone arrives at or leaves one of the circles,
 * even with Clocked closed. It must be defined when the app's code loads,
 * so the root layout imports this file.
 */
TaskManager.defineTask<{ eventType: GeofencingEventType; region: LocationRegion }>(
  GEOFENCE_TASK,
  async ({ data, error }) => {
    if (error || !data?.region?.identifier) return;
    await handleGeoEvent({
      kind: data.eventType === GeofencingEventType.Enter ? 'enter' : 'exit',
      place: data.region.identifier,
      at: Date.now(),
    });
  },
);
