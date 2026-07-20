import { ShotString, ShotStringData } from '../../../src/models/ShotString';
import { ShotStringRow } from '../../../src/types/database.types';

describe('ShotString Model', () => {
  const validData: ShotStringData = {
    ammoId: 1,
    sessionDate: '2024-01-15',
    shotNumber: 1,
    velocity: 2750,
    temperature: 72,
    notes: 'First shot of the day',
  };

  describe('constructor', () => {
    it('should create a valid ShotString instance', () => {
      const shotString = new ShotString(validData);

      expect(shotString.ammoId).toBe(1);
      expect(shotString.sessionDate).toBe('2024-01-15');
      expect(shotString.shotNumber).toBe(1);
      expect(shotString.velocity).toBe(2750);
      expect(shotString.temperature).toBe(72);
      expect(shotString.notes).toBe('First shot of the day');
    });

    it('should create instance with optional id and createdAt', () => {
      const data: ShotStringData = {
        ...validData,
        id: 5,
        createdAt: '2024-01-15T12:00:00Z',
      };
      const shotString = new ShotString(data);

      expect(shotString.id).toBe(5);
      expect(shotString.createdAt).toBe('2024-01-15T12:00:00Z');
    });

    it('should allow undefined notes', () => {
      const data: ShotStringData = {
        ammoId: 1,
        sessionDate: '2024-01-15',
        shotNumber: 1,
        velocity: 2750,
        temperature: 72,
      };
      const shotString = new ShotString(data);

      expect(shotString.notes).toBeUndefined();
    });
  });

  describe('validation', () => {
    describe('ammoId', () => {
      it('should throw error when ammoId is missing', () => {
        const data = { ...validData, ammoId: undefined } as unknown as ShotStringData;
        expect(() => new ShotString(data)).toThrow('Ammo ID is required');
      });

      it('should throw error when ammoId is zero', () => {
        expect(() => new ShotString({ ...validData, ammoId: 0 })).toThrow(
          'Ammo ID must be a positive number'
        );
      });

      it('should throw error when ammoId is negative', () => {
        expect(() => new ShotString({ ...validData, ammoId: -1 })).toThrow(
          'Ammo ID must be a positive number'
        );
      });
    });

    describe('sessionDate', () => {
      it('should throw error when sessionDate is empty', () => {
        expect(() => new ShotString({ ...validData, sessionDate: '' })).toThrow(
          'Session date is required'
        );
      });

      it('should throw error when sessionDate is whitespace only', () => {
        expect(() => new ShotString({ ...validData, sessionDate: '   ' })).toThrow(
          'Session date is required'
        );
      });
    });

    describe('shotNumber', () => {
      it('should throw error when shotNumber is zero', () => {
        expect(() => new ShotString({ ...validData, shotNumber: 0 })).toThrow(
          'Shot number must be a positive integer'
        );
      });

      it('should throw error when shotNumber is negative', () => {
        expect(() => new ShotString({ ...validData, shotNumber: -1 })).toThrow(
          'Shot number must be a positive integer'
        );
      });

      it('should accept shot number of 1', () => {
        const shotString = new ShotString({ ...validData, shotNumber: 1 });
        expect(shotString.shotNumber).toBe(1);
      });

      it('should accept large shot numbers', () => {
        const shotString = new ShotString({ ...validData, shotNumber: 100 });
        expect(shotString.shotNumber).toBe(100);
      });
    });

    describe('velocity', () => {
      it('should throw error when velocity is zero', () => {
        expect(() => new ShotString({ ...validData, velocity: 0 })).toThrow(
          'Velocity must be between 0 and 5000 fps'
        );
      });

      it('should throw error when velocity is negative', () => {
        expect(() => new ShotString({ ...validData, velocity: -100 })).toThrow(
          'Velocity must be between 0 and 5000 fps'
        );
      });

      it('should throw error when velocity exceeds 5000', () => {
        expect(() => new ShotString({ ...validData, velocity: 5001 })).toThrow(
          'Velocity must be between 0 and 5000 fps'
        );
      });

      it('should accept velocity at upper bound', () => {
        const shotString = new ShotString({ ...validData, velocity: 5000 });
        expect(shotString.velocity).toBe(5000);
      });

      it('should accept low velocity', () => {
        const shotString = new ShotString({ ...validData, velocity: 800 });
        expect(shotString.velocity).toBe(800);
      });
    });

    describe('temperature', () => {
      it('should throw error when temperature is below -60F', () => {
        expect(() => new ShotString({ ...validData, temperature: -61 })).toThrow(
          'Temperature must be between -60 and 140 Fahrenheit'
        );
      });

      it('should throw error when temperature exceeds 140F', () => {
        expect(() => new ShotString({ ...validData, temperature: 141 })).toThrow(
          'Temperature must be between -60 and 140 Fahrenheit'
        );
      });

      it('should accept temperature at lower bound', () => {
        const shotString = new ShotString({ ...validData, temperature: -60 });
        expect(shotString.temperature).toBe(-60);
      });

      it('should accept temperature at upper bound', () => {
        const shotString = new ShotString({ ...validData, temperature: 140 });
        expect(shotString.temperature).toBe(140);
      });
    });
  });

  describe('toRow', () => {
    it('should convert to database row format with snake_case', () => {
      const shotString = new ShotString(validData);
      const row = shotString.toRow();

      expect(row).toEqual({
        ammo_id: 1,
        session_date: '2024-01-15',
        shot_number: 1,
        velocity: 2750,
        temperature: 72,
        notes: 'First shot of the day',
      });
    });

    it('should handle undefined notes', () => {
      const data: ShotStringData = {
        ammoId: 1,
        sessionDate: '2024-01-15',
        shotNumber: 1,
        velocity: 2750,
        temperature: 72,
      };
      const shotString = new ShotString(data);
      const row = shotString.toRow();

      expect(row.notes).toBeUndefined();
    });
  });

  describe('fromRow', () => {
    it('should create instance from database row', () => {
      const row: ShotStringRow = {
        id: 1,
        ammo_id: 2,
        session_date: '2024-01-15',
        shot_number: 3,
        velocity: 2750,
        temperature: 72,
        notes: 'Test note',
        created_at: '2024-01-15T12:00:00Z',
      };

      const shotString = ShotString.fromRow(row);

      expect(shotString.id).toBe(1);
      expect(shotString.ammoId).toBe(2);
      expect(shotString.sessionDate).toBe('2024-01-15');
      expect(shotString.shotNumber).toBe(3);
      expect(shotString.velocity).toBe(2750);
      expect(shotString.temperature).toBe(72);
      expect(shotString.notes).toBe('Test note');
      expect(shotString.createdAt).toBe('2024-01-15T12:00:00Z');
    });

    it('should handle undefined notes in row', () => {
      const row: ShotStringRow = {
        id: 1,
        ammo_id: 2,
        session_date: '2024-01-15',
        shot_number: 3,
        velocity: 2750,
        temperature: 72,
        created_at: '2024-01-15T12:00:00Z',
      };

      const shotString = ShotString.fromRow(row);
      expect(shotString.notes).toBeUndefined();
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON format', () => {
      const data: ShotStringData = {
        id: 1,
        ammoId: 2,
        sessionDate: '2024-01-15',
        shotNumber: 3,
        velocity: 2750,
        temperature: 72,
        notes: 'Test note',
        createdAt: '2024-01-15T12:00:00Z',
      };
      const shotString = new ShotString(data);
      const json = shotString.toJSON();

      expect(json).toEqual({
        id: 1,
        ammoId: 2,
        sessionDate: '2024-01-15',
        shotNumber: 3,
        velocity: 2750,
        temperature: 72,
        notes: 'Test note',
        createdAt: '2024-01-15T12:00:00Z',
      });
    });
  });

  describe('fromJSON', () => {
    it('should create instance from JSON', () => {
      const json: ShotStringData = {
        id: 1,
        ammoId: 2,
        sessionDate: '2024-01-15',
        shotNumber: 3,
        velocity: 2750,
        temperature: 72,
        notes: 'Test note',
        createdAt: '2024-01-15T12:00:00Z',
      };

      const shotString = ShotString.fromJSON(json);

      expect(shotString.id).toBe(1);
      expect(shotString.ammoId).toBe(2);
      expect(shotString.sessionDate).toBe('2024-01-15');
      expect(shotString.shotNumber).toBe(3);
      expect(shotString.velocity).toBe(2750);
      expect(shotString.temperature).toBe(72);
      expect(shotString.notes).toBe('Test note');
      expect(shotString.createdAt).toBe('2024-01-15T12:00:00Z');
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data integrity through row conversion', () => {
      const original = new ShotString(validData);
      const row = original.toRow();
      const converted = ShotString.fromRow({
        id: 1,
        ...row,
        created_at: '2024-01-15T12:00:00Z',
      });

      expect(converted.ammoId).toBe(original.ammoId);
      expect(converted.sessionDate).toBe(original.sessionDate);
      expect(converted.shotNumber).toBe(original.shotNumber);
      expect(converted.velocity).toBe(original.velocity);
      expect(converted.temperature).toBe(original.temperature);
      expect(converted.notes).toBe(original.notes);
    });

    it('should maintain data integrity through JSON conversion', () => {
      const data: ShotStringData = {
        id: 1,
        ammoId: 2,
        sessionDate: '2024-01-15',
        shotNumber: 3,
        velocity: 2750,
        temperature: 72,
        notes: 'Test note',
        createdAt: '2024-01-15T12:00:00Z',
      };
      const original = new ShotString(data);
      const json = original.toJSON();
      const converted = ShotString.fromJSON(json);

      expect(converted.id).toBe(original.id);
      expect(converted.ammoId).toBe(original.ammoId);
      expect(converted.sessionDate).toBe(original.sessionDate);
      expect(converted.shotNumber).toBe(original.shotNumber);
      expect(converted.velocity).toBe(original.velocity);
      expect(converted.temperature).toBe(original.temperature);
      expect(converted.notes).toBe(original.notes);
      expect(converted.createdAt).toBe(original.createdAt);
    });
  });
});
