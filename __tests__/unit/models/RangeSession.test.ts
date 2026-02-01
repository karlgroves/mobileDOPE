import { RangeSession, RangeSessionData } from '../../../src/models/RangeSession';
import { RangeSessionRow } from '../../../src/types/database.types';

describe('RangeSession Model', () => {
  const validData: RangeSessionData = {
    rifleId: 1,
    ammoId: 2,
    environmentId: 3,
    sessionName: 'Morning Session',
    startTime: '2024-01-15T08:00:00Z',
    distance: 100,
    shotCount: 0,
    coldBoreShot: true,
    notes: 'Perfect conditions',
  };

  describe('constructor', () => {
    it('should create a valid RangeSession instance', () => {
      const session = new RangeSession(validData);

      expect(session.rifleId).toBe(1);
      expect(session.ammoId).toBe(2);
      expect(session.environmentId).toBe(3);
      expect(session.sessionName).toBe('Morning Session');
      expect(session.startTime).toBe('2024-01-15T08:00:00Z');
      expect(session.distance).toBe(100);
      expect(session.shotCount).toBe(0);
      expect(session.coldBoreShot).toBe(true);
      expect(session.notes).toBe('Perfect conditions');
    });

    it('should create instance with optional id, endTime, and createdAt', () => {
      const data: RangeSessionData = {
        ...validData,
        id: 5,
        endTime: '2024-01-15T12:00:00Z',
        createdAt: '2024-01-15T08:00:00Z',
      };
      const session = new RangeSession(data);

      expect(session.id).toBe(5);
      expect(session.endTime).toBe('2024-01-15T12:00:00Z');
      expect(session.createdAt).toBe('2024-01-15T08:00:00Z');
    });

    it('should allow undefined optional fields', () => {
      const data: RangeSessionData = {
        rifleId: 1,
        ammoId: 2,
        environmentId: 3,
        startTime: '2024-01-15T08:00:00Z',
        distance: 100,
        shotCount: 0,
        coldBoreShot: false,
      };
      const session = new RangeSession(data);

      expect(session.sessionName).toBeUndefined();
      expect(session.endTime).toBeUndefined();
      expect(session.notes).toBeUndefined();
    });
  });

  describe('validation', () => {
    describe('rifleId', () => {
      it('should throw error when rifleId is missing', () => {
        const data = { ...validData, rifleId: undefined } as unknown as RangeSessionData;
        expect(() => new RangeSession(data)).toThrow('Rifle ID is required');
      });

      it('should throw error when rifleId is zero', () => {
        expect(() => new RangeSession({ ...validData, rifleId: 0 })).toThrow(
          'Rifle ID must be a positive number'
        );
      });

      it('should throw error when rifleId is negative', () => {
        expect(() => new RangeSession({ ...validData, rifleId: -1 })).toThrow(
          'Rifle ID must be a positive number'
        );
      });
    });

    describe('ammoId', () => {
      it('should throw error when ammoId is missing', () => {
        const data = { ...validData, ammoId: undefined } as unknown as RangeSessionData;
        expect(() => new RangeSession(data)).toThrow('Ammo ID is required');
      });

      it('should throw error when ammoId is zero', () => {
        expect(() => new RangeSession({ ...validData, ammoId: 0 })).toThrow(
          'Ammo ID must be a positive number'
        );
      });

      it('should throw error when ammoId is negative', () => {
        expect(() => new RangeSession({ ...validData, ammoId: -1 })).toThrow(
          'Ammo ID must be a positive number'
        );
      });
    });

    describe('environmentId', () => {
      it('should throw error when environmentId is missing', () => {
        const data = { ...validData, environmentId: undefined } as unknown as RangeSessionData;
        expect(() => new RangeSession(data)).toThrow('Environment ID is required');
      });

      it('should throw error when environmentId is zero', () => {
        expect(() => new RangeSession({ ...validData, environmentId: 0 })).toThrow(
          'Environment ID must be a positive number'
        );
      });

      it('should throw error when environmentId is negative', () => {
        expect(() => new RangeSession({ ...validData, environmentId: -1 })).toThrow(
          'Environment ID must be a positive number'
        );
      });
    });

    describe('startTime', () => {
      it('should throw error when startTime is empty', () => {
        expect(() => new RangeSession({ ...validData, startTime: '' })).toThrow(
          'Start time is required'
        );
      });

      it('should throw error when startTime is whitespace only', () => {
        expect(() => new RangeSession({ ...validData, startTime: '   ' })).toThrow(
          'Start time is required'
        );
      });
    });

    describe('distance', () => {
      it('should throw error when distance is zero', () => {
        expect(() => new RangeSession({ ...validData, distance: 0 })).toThrow(
          'Distance must be between 0 and 5000 yards'
        );
      });

      it('should throw error when distance is negative', () => {
        expect(() => new RangeSession({ ...validData, distance: -1 })).toThrow(
          'Distance must be between 0 and 5000 yards'
        );
      });

      it('should throw error when distance exceeds 5000', () => {
        expect(() => new RangeSession({ ...validData, distance: 5001 })).toThrow(
          'Distance must be between 0 and 5000 yards'
        );
      });

      it('should accept distance at upper bound', () => {
        const session = new RangeSession({ ...validData, distance: 5000 });
        expect(session.distance).toBe(5000);
      });

      it('should accept short distance', () => {
        const session = new RangeSession({ ...validData, distance: 25 });
        expect(session.distance).toBe(25);
      });
    });

    describe('shotCount', () => {
      it('should throw error when shotCount is negative', () => {
        expect(() => new RangeSession({ ...validData, shotCount: -1 })).toThrow(
          'Shot count cannot be negative'
        );
      });

      it('should accept zero shotCount', () => {
        const session = new RangeSession({ ...validData, shotCount: 0 });
        expect(session.shotCount).toBe(0);
      });

      it('should accept positive shotCount', () => {
        const session = new RangeSession({ ...validData, shotCount: 50 });
        expect(session.shotCount).toBe(50);
      });
    });
  });

  describe('toRow', () => {
    it('should convert to database row format with snake_case', () => {
      const session = new RangeSession(validData);
      const row = session.toRow();

      expect(row).toEqual({
        rifle_id: 1,
        ammo_id: 2,
        environment_id: 3,
        session_name: 'Morning Session',
        start_time: '2024-01-15T08:00:00Z',
        end_time: undefined,
        distance: 100,
        shot_count: 0,
        cold_bore_shot: true,
        notes: 'Perfect conditions',
      });
    });

    it('should handle endTime when present', () => {
      const data: RangeSessionData = {
        ...validData,
        endTime: '2024-01-15T12:00:00Z',
      };
      const session = new RangeSession(data);
      const row = session.toRow();

      expect(row.end_time).toBe('2024-01-15T12:00:00Z');
    });

    it('should handle undefined optional fields', () => {
      const data: RangeSessionData = {
        rifleId: 1,
        ammoId: 2,
        environmentId: 3,
        startTime: '2024-01-15T08:00:00Z',
        distance: 100,
        shotCount: 0,
        coldBoreShot: false,
      };
      const session = new RangeSession(data);
      const row = session.toRow();

      expect(row.session_name).toBeUndefined();
      expect(row.notes).toBeUndefined();
    });
  });

  describe('fromRow', () => {
    it('should create instance from database row', () => {
      const row: RangeSessionRow = {
        id: 1,
        rifle_id: 2,
        ammo_id: 3,
        environment_id: 4,
        session_name: 'Test Session',
        start_time: '2024-01-15T08:00:00Z',
        end_time: '2024-01-15T12:00:00Z',
        distance: 100,
        shot_count: 20,
        cold_bore_shot: true,
        notes: 'Test notes',
        created_at: '2024-01-15T08:00:00Z',
      };

      const session = RangeSession.fromRow(row);

      expect(session.id).toBe(1);
      expect(session.rifleId).toBe(2);
      expect(session.ammoId).toBe(3);
      expect(session.environmentId).toBe(4);
      expect(session.sessionName).toBe('Test Session');
      expect(session.startTime).toBe('2024-01-15T08:00:00Z');
      expect(session.endTime).toBe('2024-01-15T12:00:00Z');
      expect(session.distance).toBe(100);
      expect(session.shotCount).toBe(20);
      expect(session.coldBoreShot).toBe(true);
      expect(session.notes).toBe('Test notes');
      expect(session.createdAt).toBe('2024-01-15T08:00:00Z');
    });

    it('should handle undefined optional fields in row', () => {
      const row: RangeSessionRow = {
        id: 1,
        rifle_id: 2,
        ammo_id: 3,
        environment_id: 4,
        start_time: '2024-01-15T08:00:00Z',
        distance: 100,
        shot_count: 0,
        cold_bore_shot: false,
        created_at: '2024-01-15T08:00:00Z',
      };

      const session = RangeSession.fromRow(row);

      expect(session.sessionName).toBeUndefined();
      expect(session.endTime).toBeUndefined();
      expect(session.notes).toBeUndefined();
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON format', () => {
      const data: RangeSessionData = {
        id: 1,
        rifleId: 2,
        ammoId: 3,
        environmentId: 4,
        sessionName: 'Test Session',
        startTime: '2024-01-15T08:00:00Z',
        endTime: '2024-01-15T12:00:00Z',
        distance: 100,
        shotCount: 20,
        coldBoreShot: true,
        notes: 'Test notes',
        createdAt: '2024-01-15T08:00:00Z',
      };
      const session = new RangeSession(data);
      const json = session.toJSON();

      expect(json).toEqual({
        id: 1,
        rifleId: 2,
        ammoId: 3,
        environmentId: 4,
        sessionName: 'Test Session',
        startTime: '2024-01-15T08:00:00Z',
        endTime: '2024-01-15T12:00:00Z',
        distance: 100,
        shotCount: 20,
        coldBoreShot: true,
        notes: 'Test notes',
        createdAt: '2024-01-15T08:00:00Z',
      });
    });
  });

  describe('fromJSON', () => {
    it('should create instance from JSON', () => {
      const json: RangeSessionData = {
        id: 1,
        rifleId: 2,
        ammoId: 3,
        environmentId: 4,
        sessionName: 'Test Session',
        startTime: '2024-01-15T08:00:00Z',
        endTime: '2024-01-15T12:00:00Z',
        distance: 100,
        shotCount: 20,
        coldBoreShot: true,
        notes: 'Test notes',
        createdAt: '2024-01-15T08:00:00Z',
      };

      const session = RangeSession.fromJSON(json);

      expect(session.id).toBe(1);
      expect(session.rifleId).toBe(2);
      expect(session.ammoId).toBe(3);
      expect(session.environmentId).toBe(4);
      expect(session.sessionName).toBe('Test Session');
      expect(session.startTime).toBe('2024-01-15T08:00:00Z');
      expect(session.endTime).toBe('2024-01-15T12:00:00Z');
      expect(session.distance).toBe(100);
      expect(session.shotCount).toBe(20);
      expect(session.coldBoreShot).toBe(true);
      expect(session.notes).toBe('Test notes');
      expect(session.createdAt).toBe('2024-01-15T08:00:00Z');
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data integrity through row conversion', () => {
      const original = new RangeSession(validData);
      const row = original.toRow();
      const converted = RangeSession.fromRow({
        id: 1,
        ...row,
        cold_bore_shot: row.cold_bore_shot,
        created_at: '2024-01-15T08:00:00Z',
      });

      expect(converted.rifleId).toBe(original.rifleId);
      expect(converted.ammoId).toBe(original.ammoId);
      expect(converted.environmentId).toBe(original.environmentId);
      expect(converted.sessionName).toBe(original.sessionName);
      expect(converted.startTime).toBe(original.startTime);
      expect(converted.distance).toBe(original.distance);
      expect(converted.shotCount).toBe(original.shotCount);
      expect(converted.coldBoreShot).toBe(original.coldBoreShot);
      expect(converted.notes).toBe(original.notes);
    });

    it('should maintain data integrity through JSON conversion', () => {
      const data: RangeSessionData = {
        id: 1,
        rifleId: 2,
        ammoId: 3,
        environmentId: 4,
        sessionName: 'Test Session',
        startTime: '2024-01-15T08:00:00Z',
        endTime: '2024-01-15T12:00:00Z',
        distance: 100,
        shotCount: 20,
        coldBoreShot: true,
        notes: 'Test notes',
        createdAt: '2024-01-15T08:00:00Z',
      };
      const original = new RangeSession(data);
      const json = original.toJSON();
      const converted = RangeSession.fromJSON(json);

      expect(converted.id).toBe(original.id);
      expect(converted.rifleId).toBe(original.rifleId);
      expect(converted.ammoId).toBe(original.ammoId);
      expect(converted.environmentId).toBe(original.environmentId);
      expect(converted.sessionName).toBe(original.sessionName);
      expect(converted.startTime).toBe(original.startTime);
      expect(converted.endTime).toBe(original.endTime);
      expect(converted.distance).toBe(original.distance);
      expect(converted.shotCount).toBe(original.shotCount);
      expect(converted.coldBoreShot).toBe(original.coldBoreShot);
      expect(converted.notes).toBe(original.notes);
      expect(converted.createdAt).toBe(original.createdAt);
    });
  });
});
