import { act, fireEvent, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { DOPELog } from '../../../src/models/DOPELog';
import { RifleProfile } from '../../../src/models/RifleProfile';
import { TargetImage } from '../../../src/models/TargetImage';
import { DOPELogDetail } from '../../../src/screens/DOPELogDetail';
import { targetImageRepository } from '../../../src/services/database';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { validAmmo, validDopeLog, validRifle } from '../../helpers/fixtures';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * A log shows the target marked for it (#63).
 *
 * Marking a target is only worth doing if the result is visible where the
 * shooter reviews the log. The saved marks are measured again here from the
 * stored scale -- not read back from a number frozen at save time -- so this
 * asserts real figures for a known group.
 */

const mockDeleteTargetPhoto = jest.fn();
jest.mock('../../../src/services/TargetPhotoService', () => ({
  pickTargetPhoto: jest.fn(),
  deleteTargetPhoto: (uri: string) => mockDeleteTargetPhoto(uri),
}));

const LOG_ID = 7;
let focusListener: (() => void) | undefined;
const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn((_event: string, listener: () => void) => {
    focusListener = listener;
    return jest.fn();
  }),
};
const route = { params: { logId: LOG_ID }, key: 'k', name: 'DOPELogDetail' } as never;

const target = (over: Partial<ConstructorParameters<typeof TargetImage>[0]> = {}) =>
  new TargetImage({
    id: 3,
    dopeLogId: LOG_ID,
    imageUri: 'builtin:bullseye',
    targetType: 'bullseye',
    poiMarkers: [
      { x: 0.5, y: 0.5, shotNumber: 1 },
      { x: 0.6, y: 0.5, shotNumber: 2 },
    ],
    targetWidthInches: 10,
    aspectRatio: 1,
    ...over,
  });

const render = () =>
  renderWithProviders(<DOPELogDetail route={route} navigation={navigation as never} />);

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  focusListener = undefined;
  useDOPEStore.setState({
    dopeLogs: [
      new DOPELog({
        ...validDopeLog({ rifleId: 1, ammoId: 1, environmentId: 1 }, { distance: 100 }),
        id: LOG_ID,
      }),
    ],
  });
  useRifleStore.setState({ rifles: [new RifleProfile({ ...validRifle(), id: 1 })] });
  useAmmoStore.setState({ ammoProfiles: [new AmmoProfile({ ...validAmmo(), id: 1 })] });
});

describe('DOPE Log Details, marked target', () => {
  it('shows the saved target with its shots and the group measured from them', async () => {
    jest.spyOn(targetImageRepository, 'getByDopeLogId').mockResolvedValue([target()]);
    const screen = render();

    const view = await screen.findByTestId('log-target');
    expect(view.props.accessibilityLabel).toBe('Marked target, 2 shots marked');
    // Shots are placed once the target has a size, as on a device.
    fireEvent(view, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 300 } } });
    expect(within(view).getByText('2')).toBeTruthy();
    expect(
      within(screen.getByTestId('log-target-statistics')).getByLabelText(
        'Extreme spread, 1.00 inches, 0.95 MOA'
      )
    ).toBeTruthy();
    expect(screen.getByText('Edit Target')).toBeTruthy();
  });

  it('offers to mark a target when the log has none', async () => {
    jest.spyOn(targetImageRepository, 'getByDopeLogId').mockResolvedValue([]);
    const screen = render();

    await waitFor(() => expect(targetImageRepository.getByDopeLogId).toHaveBeenCalled());
    expect(screen.queryByTestId('log-target')).toBeNull();

    fireEvent.press(screen.getByText('Mark Target'));
    expect(navigation.navigate).toHaveBeenCalledWith('TargetMarking', { logId: LOG_ID });
  });

  it('shows a target saved on the marking screen when it comes back into view', async () => {
    const load = jest.spyOn(targetImageRepository, 'getByDopeLogId').mockResolvedValue([]);
    const screen = render();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    load.mockResolvedValue([target()]);
    await act(async () => {
      focusListener?.();
    });

    expect(await screen.findByTestId('log-target')).toBeTruthy();
  });

  it('deletes the target photo along with the log', async () => {
    // The row goes with the log by foreign-key cascade; the file in the app's
    // storage would not, and a photo nobody can see is still kept data.
    jest
      .spyOn(targetImageRepository, 'getByDopeLogId')
      .mockResolvedValue([
        target({ targetType: 'photo', imageUri: 'file:///documents/targets/t.jpg' }),
      ]);
    const deleteDopeLog = jest.fn().mockResolvedValue(undefined);
    useDOPEStore.setState({ deleteDopeLog });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      void buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const screen = render();
    await screen.findByTestId('log-target');

    await act(async () => {
      fireEvent.press(screen.getByText('Delete'));
    });

    expect(deleteDopeLog).toHaveBeenCalledWith(LOG_ID);
    expect(mockDeleteTargetPhoto).toHaveBeenCalledWith('file:///documents/targets/t.jpg');
  });
});
