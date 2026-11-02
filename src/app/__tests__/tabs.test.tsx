import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import ChartsScreen from '../(tabs)/charts';
import WeekScreen from '../(tabs)/index';
import TabsLayout from '../(tabs)/_layout';
import SettingsScreen from '../(tabs)/settings';
import SummaryScreen from '../(tabs)/summary';

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': WeekScreen,
  '(tabs)/summary': SummaryScreen,
  '(tabs)/charts': ChartsScreen,
  '(tabs)/settings': SettingsScreen,
};

describe('tab navigation', () => {
  it('opens on the week screen with all four tabs available', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByRole('header', { name: 'Clocked' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Week, log your time')).toBeOnTheScreen();
    expect(screen.getByLabelText('Summary and all weeks')).toBeOnTheScreen();
    expect(screen.getByLabelText('Charts of hours per day and week')).toBeOnTheScreen();
    expect(screen.getByLabelText('Settings')).toBeOnTheScreen();
  });

  it.each([
    ['Summary and all weeks', 'Summary'],
    ['Charts of hours per day and week', 'Charts'],
    ['Settings', 'Settings'],
  ])('the "%s" tab opens its screen', async (tab, heading) => {
    await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByLabelText(tab));
    expect(await screen.findByRole('header', { name: heading })).toBeOnTheScreen();
  });
});
