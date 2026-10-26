import { act, fireEvent, waitFor, within } from '@testing-library/react-native';
import React from 'react';

import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { DOPELog } from '../../../src/models/DOPELog';
import { RifleProfile } from '../../../src/models/RifleProfile';
import { TargetImage } from '../../../src/models/TargetImage';
import { TargetMarking } from '../../../src/screens/TargetMarking';
import { targetImageRepository } from '../../../src/services/database';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { validAmmo, validDopeLog, validRifle } from '../../helpers/fixtures';
import { renderWithProviders } from '../../helpers/renderWithProviders';

import type { TargetImageData } from '../../../src/models/TargetImage';

/**
 * Marking points of impact on a target, from a DOPE log (#63).
 *
 * The flow a shooter goes through: tap where each shot landed, see the shots
 * numbered and the group measured as they go, correct a mistake, save it to the
 * log. The statistics are `groupAnalysis`'s and the scaling `targetMarking`'s,
 * each tested on its own; what is tested here is that the screen actually feeds
 * the marks through them and stores what a later screen can measure again.
 *
 * The photo picker is a native module, so `TargetPhotoService` is replaced; what
 * it does with the picker is tested in `TargetPhotoService.test.ts`.
 */

const mockPickTargetPhoto = jest.fn();
const mockDeleteTargetPhoto = jest.fn();
jest.mock('../../../src/services/TargetPhotoService', () => ({
  pickTargetPhoto: () => mockPickTargetPhoto(),
  deleteTargetPhoto: (uri: string) => mockDeleteTargetPhoto(uri),
}));

const LOG_ID = 7;

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const route = { params: { logId: LOG_ID }, key: 'k', name: 'TargetMarking' } as never;

const updateDopeLog = jest.fn();
let saved: TargetImageData | undefined;

const seed = (distance = 100) => {
  useDOPEStore.setState({
    dopeLogs: [
      new DOPELog({
        ...validDopeLog({ rifleId: 1, ammoId: 1, environmentId: 1 }, { distance }),
        id: LOG_ID,
      }),
    ],
    updateDopeLog,
  });
  useRifleStore.setState({ rifles: [new RifleProfile({ ...validRifle(), id: 1 })] });
  useAmmoStore.setState({ ammoProfiles: [new AmmoProfile({ ...validAmmo(), id: 1 })] });
};

const render = async (existing: TargetImage[] = []) => {
  jest.spyOn(targetImageRepository, 'getByDopeLogId').mockResolvedValue(existing);
  const screen = renderWithProviders(
    <TargetMarking route={route} navigation={navigation as never} />
  );
  await waitFor(() => expect(targetImageRepository.getByDopeLogId).toHaveBeenCalledWith(LOG_ID));
  // The surface is measured by layout; on a device that happens before a tap can.
  fireEvent(screen.getByTestId('target-surface'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 300 } },
  });
  return screen;
};

const tap = (screen: Awaited<ReturnType<typeof render>>, x: number, y: number) =>
  fireEvent.press(screen.getByTestId('target-surface'), {
    nativeEvent: { locationX: x, locationY: y },
  });

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  saved = undefined;
  seed();
  jest.spyOn(targetImageRepository, 'create').mockImplementation(async (data) => {
    saved = data;
    // Through the real model, so the screen is handed what the database would hand it.
    return new TargetImage({ ...data, id: 99 });
  });
  jest.spyOn(targetImageRepository, 'update').mockImplementation(async (id, data) => {
    saved = data as TargetImageData;
    return new TargetImage({ ...(data as TargetImageData), id });
  });
});

describe('Target marking', () => {
  it('marks a shot where the target is tapped, numbered in shot order', async () => {
    const screen = await render();

    tap(screen, 150, 150);
    tap(screen, 165, 140);

    const surface = within(screen.getByTestId('target-surface'));
    expect(surface.getByText('1')).toBeTruthy();
    expect(surface.getByText('2')).toBeTruthy();
    expect(screen.getByTestId('target-surface').props.accessibilityLabel).toMatch(/2 shots marked/);
  });

  it('undoes the last shot, and clears them all', async () => {
    const screen = await render();
    tap(screen, 150, 150);
    tap(screen, 165, 140);
    tap(screen, 140, 160);

    fireEvent.press(screen.getByText('Undo Last Shot'));
    const surface = () => within(screen.getByTestId('target-surface'));
    expect(surface().queryByText('3')).toBeNull();
    expect(surface().getByText('2')).toBeTruthy();

    fireEvent.press(screen.getByText('Clear Shots'));
    expect(surface().queryByText('1')).toBeNull();
  });

  it('asks for the target width before giving a size, rather than guessing one', async () => {
    const screen = await render();
    tap(screen, 150, 150);
    tap(screen, 180, 150);

    expect(screen.getByText(/Enter the target width/)).toBeTruthy();
    expect(screen.queryByText(/ in$/)).toBeNull();
  });

  it('measures the group live as shots are added, in inches and MOA', async () => {
    const screen = await render();
    fireEvent.changeText(screen.getByLabelText('Target width'), '10');

    // 30 points apart on a 300-point, 10-inch target: one inch.
    tap(screen, 150, 150);
    tap(screen, 180, 150);

    // 1 inch at 100 yards is 0.95 true MOA.
    const stats = within(screen.getByTestId('group-statistics'));
    expect(stats.getByLabelText('Extreme spread, 1.00 inches, 0.95 MOA')).toBeTruthy();
    expect(stats.getByLabelText('Horizontal spread, 1.00 inches, 0.95 MOA')).toBeTruthy();
    expect(stats.getByLabelText('Vertical spread, 0.00 inches, 0.00 MOA')).toBeTruthy();
    expect(stats.getByLabelText('Mean radius, 0.50 inches, 0.48 MOA')).toBeTruthy();
    expect(stats.getByLabelText('CEP (50%), 0.50 inches, 0.48 MOA')).toBeTruthy();

    tap(screen, 150, 210);
    // Two inches below the first shot: the widest pair is now shot 2 to shot 3,
    // one inch across and two down -- the square root of 5.
    expect(stats.getByLabelText('Extreme spread, 2.24 inches, 2.14 MOA')).toBeTruthy();
    expect(stats.getByText('2.24 in · 2.14 MOA')).toBeTruthy();
  });

  it('saves the marks as fractions of the target, with the scale, to this log', async () => {
    const screen = await render();
    fireEvent.changeText(screen.getByLabelText('Target width'), '10');
    tap(screen, 150, 150);
    tap(screen, 180, 150);

    await act(async () => {
      fireEvent.press(screen.getByText('Save Target'));
    });

    expect(saved).toEqual(
      expect.objectContaining({
        dopeLogId: LOG_ID,
        targetType: 'bullseye',
        targetWidthInches: 10,
        aspectRatio: 1,
        poiMarkers: [
          { x: 0.5, y: 0.5, shotNumber: 1 },
          { x: 0.6, y: 0.5, shotNumber: 2 },
        ],
      })
    );
    expect(saved?.groupSize).toBeCloseTo(1, 10);
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('records the measured group size on the log, replacing a typed one', async () => {
    const screen = await render();
    fireEvent.changeText(screen.getByLabelText('Target width'), '10');
    tap(screen, 150, 150);
    tap(screen, 180, 150);

    await act(async () => {
      fireEvent.press(screen.getByText('Save Target'));
    });

    expect(updateDopeLog).toHaveBeenCalledWith(LOG_ID, { groupSize: expect.closeTo(1, 10) });
  });

  it('leaves the log group size alone when the group cannot be measured', async () => {
    // One shot is not a group, and no width is no inches: either way the log
    // keeps whatever the shooter typed rather than being overwritten with nothing.
    const screen = await render();
    fireEvent.changeText(screen.getByLabelText('Target width'), '10');
    tap(screen, 150, 150);

    await act(async () => {
      fireEvent.press(screen.getByText('Save Target'));
    });

    expect(saved).toBeDefined();
    expect(updateDopeLog).not.toHaveBeenCalled();
  });

  it('offers nothing to save until a shot is marked', async () => {
    const screen = await render();
    expect(screen.getByTestId('save-target').props.accessibilityState.disabled).toBe(true);
  });

  it('marks on a chosen photo, keeping its shape, and starts its shots afresh', async () => {
    mockPickTargetPhoto.mockResolvedValue({
      uri: 'file:///documents/targets/target-1.jpg',
      aspectRatio: 4 / 3,
    });
    const screen = await render();
    tap(screen, 150, 150);

    await act(async () => {
      fireEvent.press(screen.getByText('Use a Photo'));
    });

    // Marks belong to the image they were made on.
    expect(within(screen.getByTestId('target-surface')).queryByText('1')).toBeNull();
    expect(screen.getByTestId('target-photo').props.source).toEqual({
      uri: 'file:///documents/targets/target-1.jpg',
    });

    fireEvent(screen.getByTestId('target-surface'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 400 } },
    });
    tap(screen, 150, 100);
    await act(async () => {
      fireEvent.press(screen.getByText('Save Target'));
    });

    expect(saved).toEqual(
      expect.objectContaining({
        targetType: 'photo',
        imageUri: 'file:///documents/targets/target-1.jpg',
        aspectRatio: 4 / 3,
        poiMarkers: [{ x: 0.5, y: 0.25, shotNumber: 1 }],
      })
    );
  });

  it('opens a saved target with its marks and width, and saves over it', async () => {
    const existing = new TargetImage({
      id: 42,
      dopeLogId: LOG_ID,
      imageUri: 'builtin:bullseye',
      targetType: 'bullseye',
      poiMarkers: [
        { x: 0.5, y: 0.5, shotNumber: 1 },
        { x: 0.6, y: 0.5, shotNumber: 2 },
      ],
      targetWidthInches: 10,
      aspectRatio: 1,
    });
    const screen = await render([existing]);

    await waitFor(() =>
      expect(within(screen.getByTestId('target-surface')).getByText('2')).toBeTruthy()
    );
    expect(screen.getByDisplayValue('10.00')).toBeTruthy();

    tap(screen, 150, 180);
    await act(async () => {
      fireEvent.press(screen.getByText('Save Target'));
    });

    expect(targetImageRepository.update).toHaveBeenCalledWith(42, expect.anything());
    expect(targetImageRepository.create).not.toHaveBeenCalled();
    expect(saved?.poiMarkers).toHaveLength(3);
  });

  it('deletes the photo a saved target used when it is replaced', async () => {
    const existing = new TargetImage({
      id: 42,
      dopeLogId: LOG_ID,
      imageUri: 'file:///documents/targets/old.jpg',
      targetType: 'photo',
      poiMarkers: [{ x: 0.5, y: 0.5, shotNumber: 1 }],
      aspectRatio: 1,
    });
    const screen = await render([existing]);
    await waitFor(() => expect(screen.getByText('Use Plain Target')).toBeTruthy());

    fireEvent.press(screen.getByText('Use Plain Target'));
    fireEvent(screen.getByTestId('target-surface'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 300 } },
    });
    tap(screen, 150, 150);
    await act(async () => {
      fireEvent.press(screen.getByText('Save Target'));
    });

    expect(mockDeleteTargetPhoto).toHaveBeenCalledWith('file:///documents/targets/old.jpg');
  });

  it('removes a saved target whose shots have all been cleared', async () => {
    const existing = new TargetImage({
      id: 42,
      dopeLogId: LOG_ID,
      imageUri: 'file:///documents/targets/old.jpg',
      targetType: 'photo',
      poiMarkers: [{ x: 0.5, y: 0.5, shotNumber: 1 }],
      aspectRatio: 1,
    });
    const remove = jest.spyOn(targetImageRepository, 'delete').mockResolvedValue(true);
    const screen = await render([existing]);
    await waitFor(() => expect(screen.getByText('Clear Shots')).toBeTruthy());

    fireEvent.press(screen.getByText('Clear Shots'));
    await act(async () => {
      fireEvent.press(screen.getByText('Remove Target'));
    });

    expect(remove).toHaveBeenCalledWith(42);
    expect(mockDeleteTargetPhoto).toHaveBeenCalledWith('file:///documents/targets/old.jpg');
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
