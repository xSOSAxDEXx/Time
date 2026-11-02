import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { SwitchRow } from '../SwitchRow';

function Harness() {
  const [on, setOn] = useState(false);
  return (
    <SwitchRow label="Made-up setting" description="A test switch" value={on} onChange={setOn} />
  );
}

test('tapping the label toggles the switch, like tapping the switch', async () => {
  await render(<Harness />);
  const sw = screen.getByLabelText('Made-up setting');
  expect(sw.props.value).toBe(false);
  await act(async () => fireEvent.press(screen.getByText('Made-up setting')));
  expect(screen.getByLabelText('Made-up setting').props.value).toBe(true);
  await act(async () => fireEvent(screen.getByLabelText('Made-up setting'), 'valueChange', false));
  expect(screen.getByLabelText('Made-up setting').props.value).toBe(false);
});
