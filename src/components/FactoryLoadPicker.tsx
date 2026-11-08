import React, { useState } from 'react';

import { FactoryLoad, factoryLoadById, factoryLoadsFor } from '../constants/factoryLoads';

import { Picker } from './Picker';

/** Props for {@link FactoryLoadPicker}. */
export interface FactoryLoadPickerProps {
  /** The form's current caliber; narrows the list when it has factory loads. */
  caliber: string | undefined;
  /** Called with the chosen load. The form copies its figures into editable fields. */
  onSelect: (load: FactoryLoad) => void;
}

/**
 * "Start from a factory load" on a new ammunition profile (#225).
 *
 * Choosing a load copies the manufacturer's published figures into the form
 * once. It holds no link to the load afterwards: the shooter can change any
 * field, and the saved profile keeps whatever the form says at save time.
 */
export const FactoryLoadPicker: React.FC<FactoryLoadPickerProps> = ({ caliber, onSelect }) => {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const options = factoryLoadsFor(caliber).map((load) => ({ label: load.name, value: load.id }));

  const handleChange = (id: string) => {
    const load = factoryLoadById(id);
    if (!load) return;
    setSelectedId(id);
    onSelect(load);
  };

  return (
    <Picker
      label="Factory Load"
      value={selectedId}
      onValueChange={handleChange}
      options={options}
      placeholder="Optional: start from a factory load"
      helperText="Fills in the manufacturer's published BC and velocity. You can change every field. Velocity is from their test barrel, so chronograph yours."
    />
  );
};
