// The app's first code. Android's arrive-and-leave task is defined here,
// before Expo Router starts: when Android wakes Punch'd in the background
// (app closed), no screen loads, so a task defined from a screen or the root
// layout is never found and the arrival or departure is dropped.
import './src/geofence/task';
import 'expo-router/entry';
