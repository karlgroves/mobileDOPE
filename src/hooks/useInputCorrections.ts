import { useMemo } from 'react';
import { Alert } from 'react-native';

import { useAmmoStore } from '../store/useAmmoStore';
import { inputCorrectionsFor } from '../utils/inputCorrections';

import { useSnapshotsFor } from './useSnapshotsFor';

import type { CorrectableInput } from '../components/InputCorrectionsCard';
import type { AmmoProfile } from '../models/AmmoProfile';
import type { DOPELogData } from '../models/DOPELog';
import type { RifleProfile } from '../models/RifleProfile';

/**
 * Muzzle-velocity and BC suggestions for one rifle and load, and the action that
 * applies one (#64).
 *
 * Loads the environment snapshot each log was shot in, feeds the logs to
 * {@link inputCorrectionsFor}, and confirms with the shooter before writing a
 * suggestion back to the ammo profile.
 */
export const useInputCorrections = ({
  logs: filteredLogs,
  rifle,
  ammo,
  unit: correctionUnit,
}: {
  logs: DOPELogData[];
  rifle: RifleProfile | undefined;
  ammo: AmmoProfile | undefined;
  unit: 'MIL' | 'MOA';
}) => {
  const { updateAmmoProfile } = useAmmoStore();

  const environmentById = useSnapshotsFor(filteredLogs);

  const corrections = useMemo(
    () =>
      rifle && ammo && environmentById
        ? inputCorrectionsFor({
            logs: filteredLogs,
            rifle,
            ammo,
            environmentById,
            unit: correctionUnit,
          })
        : undefined,
    [filteredLogs, rifle, ammo, environmentById, correctionUnit]
  );

  /** Confirm, then write the one suggested field back to the ammo profile. */
  const applyCorrection = (input: CorrectableInput, value: number) => {
    if (!ammo?.id) return;
    const isVelocity = input === 'muzzleVelocity';
    const field = isVelocity
      ? 'muzzleVelocity'
      : ammo.ballisticCoefficientG7
        ? 'ballisticCoefficientG7'
        : 'ballisticCoefficientG1';
    const label = isVelocity
      ? 'muzzle velocity'
      : `${field === 'ballisticCoefficientG7' ? 'G7' : 'G1'} BC`;
    const from = ammo[field];
    const to = isVelocity ? `${value} fps` : String(value);

    Alert.alert(
      `Update ${label}?`,
      `Change ${ammo.name}'s ${label} from ${isVelocity ? `${from} fps` : from} to ${to}. ` +
        'Every solution for this load will use the new value. Verify it on the range ' +
        'or with a chronograph before relying on it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: () => {
            updateAmmoProfile(ammo.id!, { ...ammo.toJSON(), [field]: value }).catch((error) =>
              Alert.alert(
                'Update Failed',
                error instanceof Error ? error.message : 'Could not update the profile'
              )
            );
          },
        },
      ]
    );
  };

  return { corrections, applyCorrection };
};
