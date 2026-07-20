import { TargetImage, TargetImageData, POIMarker } from '../../../src/models/TargetImage';
import { TargetImageRow } from '../../../src/types/database.types';

describe('TargetImage Model', () => {
  const validPOIMarkers: POIMarker[] = [
    { x: 100, y: 150, shotNumber: 1 },
    { x: 110, y: 145, shotNumber: 2 },
    { x: 105, y: 155, shotNumber: 3 },
  ];

  const validData: TargetImageData = {
    dopeLogId: 1,
    imageUri: '/path/to/target-image.jpg',
    targetType: 'paper',
    poiMarkers: validPOIMarkers,
    groupSize: 1.5,
  };

  describe('constructor', () => {
    it('should create a valid TargetImage instance with dopeLogId', () => {
      const targetImage = new TargetImage(validData);

      expect(targetImage.dopeLogId).toBe(1);
      expect(targetImage.rangeSessionId).toBeUndefined();
      expect(targetImage.imageUri).toBe('/path/to/target-image.jpg');
      expect(targetImage.targetType).toBe('paper');
      expect(targetImage.poiMarkers).toEqual(validPOIMarkers);
      expect(targetImage.groupSize).toBe(1.5);
    });

    it('should create a valid TargetImage instance with rangeSessionId', () => {
      const data: TargetImageData = {
        rangeSessionId: 2,
        imageUri: '/path/to/target-image.jpg',
        targetType: 'steel',
        poiMarkers: [],
      };
      const targetImage = new TargetImage(data);

      expect(targetImage.dopeLogId).toBeUndefined();
      expect(targetImage.rangeSessionId).toBe(2);
      expect(targetImage.targetType).toBe('steel');
    });

    it('should create instance with optional id and createdAt', () => {
      const data: TargetImageData = {
        ...validData,
        id: 5,
        createdAt: '2024-01-15T12:00:00Z',
      };
      const targetImage = new TargetImage(data);

      expect(targetImage.id).toBe(5);
      expect(targetImage.createdAt).toBe('2024-01-15T12:00:00Z');
    });

    it('should allow undefined groupSize', () => {
      const data: TargetImageData = {
        dopeLogId: 1,
        imageUri: '/path/to/target-image.jpg',
        targetType: 'paper',
        poiMarkers: [],
      };
      const targetImage = new TargetImage(data);

      expect(targetImage.groupSize).toBeUndefined();
    });

    it('should allow empty poiMarkers array', () => {
      const data: TargetImageData = {
        dopeLogId: 1,
        imageUri: '/path/to/target-image.jpg',
        targetType: 'paper',
        poiMarkers: [],
      };
      const targetImage = new TargetImage(data);

      expect(targetImage.poiMarkers).toEqual([]);
    });
  });

  describe('validation', () => {
    describe('imageUri', () => {
      it('should throw error when imageUri is empty', () => {
        expect(() => new TargetImage({ ...validData, imageUri: '' })).toThrow(
          'Image URI is required'
        );
      });

      it('should throw error when imageUri is whitespace only', () => {
        expect(() => new TargetImage({ ...validData, imageUri: '   ' })).toThrow(
          'Image URI is required'
        );
      });
    });

    describe('targetType', () => {
      it('should throw error when targetType is empty', () => {
        expect(() => new TargetImage({ ...validData, targetType: '' })).toThrow(
          'Target type is required'
        );
      });

      it('should throw error when targetType is whitespace only', () => {
        expect(() => new TargetImage({ ...validData, targetType: '   ' })).toThrow(
          'Target type is required'
        );
      });

      it('should accept various target types', () => {
        const types = ['paper', 'steel', 'IPSC', 'bullseye', 'F-Class', 'vital_zone'];
        types.forEach((type) => {
          const targetImage = new TargetImage({ ...validData, targetType: type });
          expect(targetImage.targetType).toBe(type);
        });
      });
    });

    describe('dopeLogId and rangeSessionId', () => {
      it('should throw error when both dopeLogId and rangeSessionId are missing', () => {
        const data: TargetImageData = {
          imageUri: '/path/to/image.jpg',
          targetType: 'paper',
          poiMarkers: [],
        };
        expect(() => new TargetImage(data)).toThrow(
          'Either DOPE Log ID or Range Session ID is required'
        );
      });

      it('should accept when only dopeLogId is provided', () => {
        const data: TargetImageData = {
          dopeLogId: 1,
          imageUri: '/path/to/image.jpg',
          targetType: 'paper',
          poiMarkers: [],
        };
        const targetImage = new TargetImage(data);
        expect(targetImage.dopeLogId).toBe(1);
      });

      it('should accept when only rangeSessionId is provided', () => {
        const data: TargetImageData = {
          rangeSessionId: 1,
          imageUri: '/path/to/image.jpg',
          targetType: 'paper',
          poiMarkers: [],
        };
        const targetImage = new TargetImage(data);
        expect(targetImage.rangeSessionId).toBe(1);
      });

      it('should accept when both dopeLogId and rangeSessionId are provided', () => {
        const data: TargetImageData = {
          dopeLogId: 1,
          rangeSessionId: 2,
          imageUri: '/path/to/image.jpg',
          targetType: 'paper',
          poiMarkers: [],
        };
        const targetImage = new TargetImage(data);
        expect(targetImage.dopeLogId).toBe(1);
        expect(targetImage.rangeSessionId).toBe(2);
      });
    });

    describe('groupSize', () => {
      it('should throw error when groupSize is negative', () => {
        expect(() => new TargetImage({ ...validData, groupSize: -0.1 })).toThrow(
          'Group size cannot be negative'
        );
      });

      it('should accept zero groupSize', () => {
        const targetImage = new TargetImage({ ...validData, groupSize: 0 });
        expect(targetImage.groupSize).toBe(0);
      });

      it('should accept positive groupSize', () => {
        const targetImage = new TargetImage({ ...validData, groupSize: 2.5 });
        expect(targetImage.groupSize).toBe(2.5);
      });
    });

    describe('poiMarkers', () => {
      it('should throw error when poiMarkers is not an array', () => {
        const data = { ...validData, poiMarkers: 'invalid' } as unknown as TargetImageData;
        expect(() => new TargetImage(data)).toThrow('POI markers must be an array');
      });

      it('should throw error when poiMarker is missing x coordinate', () => {
        const invalidMarkers = [{ y: 100, shotNumber: 1 }] as unknown as POIMarker[];
        expect(() => new TargetImage({ ...validData, poiMarkers: invalidMarkers })).toThrow(
          'POI marker must have x and y coordinates'
        );
      });

      it('should throw error when poiMarker is missing y coordinate', () => {
        const invalidMarkers = [{ x: 100, shotNumber: 1 }] as unknown as POIMarker[];
        expect(() => new TargetImage({ ...validData, poiMarkers: invalidMarkers })).toThrow(
          'POI marker must have x and y coordinates'
        );
      });

      it('should accept poiMarker without shotNumber', () => {
        const markersWithoutShotNum: POIMarker[] = [{ x: 100, y: 150 }];
        const targetImage = new TargetImage({ ...validData, poiMarkers: markersWithoutShotNum });
        expect(targetImage.poiMarkers[0].shotNumber).toBeUndefined();
      });
    });
  });

  describe('toRow', () => {
    it('should convert to database row format with snake_case', () => {
      const targetImage = new TargetImage(validData);
      const row = targetImage.toRow();

      expect(row).toEqual({
        dope_log_id: 1,
        range_session_id: undefined,
        image_uri: '/path/to/target-image.jpg',
        target_type: 'paper',
        poi_markers: JSON.stringify(validPOIMarkers),
        group_size: 1.5,
      });
    });

    it('should serialize poiMarkers as JSON string', () => {
      const targetImage = new TargetImage(validData);
      const row = targetImage.toRow();

      expect(typeof row.poi_markers).toBe('string');
      expect(JSON.parse(row.poi_markers)).toEqual(validPOIMarkers);
    });

    it('should handle empty poiMarkers', () => {
      const data: TargetImageData = {
        dopeLogId: 1,
        imageUri: '/path/to/image.jpg',
        targetType: 'paper',
        poiMarkers: [],
      };
      const targetImage = new TargetImage(data);
      const row = targetImage.toRow();

      expect(row.poi_markers).toBe('[]');
    });
  });

  describe('fromRow', () => {
    it('should create instance from database row', () => {
      const row: TargetImageRow = {
        id: 1,
        dope_log_id: 2,
        range_session_id: 3,
        image_uri: '/path/to/image.jpg',
        target_type: 'steel',
        poi_markers: JSON.stringify(validPOIMarkers),
        group_size: 2.0,
        created_at: '2024-01-15T12:00:00Z',
      };

      const targetImage = TargetImage.fromRow(row);

      expect(targetImage.id).toBe(1);
      expect(targetImage.dopeLogId).toBe(2);
      expect(targetImage.rangeSessionId).toBe(3);
      expect(targetImage.imageUri).toBe('/path/to/image.jpg');
      expect(targetImage.targetType).toBe('steel');
      expect(targetImage.poiMarkers).toEqual(validPOIMarkers);
      expect(targetImage.groupSize).toBe(2.0);
      expect(targetImage.createdAt).toBe('2024-01-15T12:00:00Z');
    });

    it('should handle undefined optional fields in row', () => {
      const row: TargetImageRow = {
        id: 1,
        dope_log_id: 2,
        image_uri: '/path/to/image.jpg',
        target_type: 'paper',
        poi_markers: '[]',
        created_at: '2024-01-15T12:00:00Z',
      };

      const targetImage = TargetImage.fromRow(row);

      expect(targetImage.rangeSessionId).toBeUndefined();
      expect(targetImage.groupSize).toBeUndefined();
    });

    it('should parse JSON poi_markers from row', () => {
      const markers: POIMarker[] = [{ x: 50, y: 75, shotNumber: 1 }];
      const row: TargetImageRow = {
        id: 1,
        dope_log_id: 2,
        image_uri: '/path/to/image.jpg',
        target_type: 'paper',
        poi_markers: JSON.stringify(markers),
        created_at: '2024-01-15T12:00:00Z',
      };

      const targetImage = TargetImage.fromRow(row);
      expect(targetImage.poiMarkers).toEqual(markers);
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON format', () => {
      const data: TargetImageData = {
        id: 1,
        dopeLogId: 2,
        rangeSessionId: 3,
        imageUri: '/path/to/image.jpg',
        targetType: 'paper',
        poiMarkers: validPOIMarkers,
        groupSize: 1.5,
        createdAt: '2024-01-15T12:00:00Z',
      };
      const targetImage = new TargetImage(data);
      const json = targetImage.toJSON();

      expect(json).toEqual({
        id: 1,
        dopeLogId: 2,
        rangeSessionId: 3,
        imageUri: '/path/to/image.jpg',
        targetType: 'paper',
        poiMarkers: validPOIMarkers,
        groupSize: 1.5,
        createdAt: '2024-01-15T12:00:00Z',
      });
    });
  });

  describe('fromJSON', () => {
    it('should create instance from JSON', () => {
      const json: TargetImageData = {
        id: 1,
        dopeLogId: 2,
        rangeSessionId: 3,
        imageUri: '/path/to/image.jpg',
        targetType: 'paper',
        poiMarkers: validPOIMarkers,
        groupSize: 1.5,
        createdAt: '2024-01-15T12:00:00Z',
      };

      const targetImage = TargetImage.fromJSON(json);

      expect(targetImage.id).toBe(1);
      expect(targetImage.dopeLogId).toBe(2);
      expect(targetImage.rangeSessionId).toBe(3);
      expect(targetImage.imageUri).toBe('/path/to/image.jpg');
      expect(targetImage.targetType).toBe('paper');
      expect(targetImage.poiMarkers).toEqual(validPOIMarkers);
      expect(targetImage.groupSize).toBe(1.5);
      expect(targetImage.createdAt).toBe('2024-01-15T12:00:00Z');
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data integrity through row conversion', () => {
      const original = new TargetImage(validData);
      const row = original.toRow();
      const converted = TargetImage.fromRow({
        id: 1,
        dope_log_id: row.dope_log_id,
        range_session_id: row.range_session_id,
        image_uri: row.image_uri,
        target_type: row.target_type,
        poi_markers: row.poi_markers,
        group_size: row.group_size,
        created_at: '2024-01-15T12:00:00Z',
      });

      expect(converted.dopeLogId).toBe(original.dopeLogId);
      expect(converted.rangeSessionId).toBe(original.rangeSessionId);
      expect(converted.imageUri).toBe(original.imageUri);
      expect(converted.targetType).toBe(original.targetType);
      expect(converted.poiMarkers).toEqual(original.poiMarkers);
      expect(converted.groupSize).toBe(original.groupSize);
    });

    it('should maintain data integrity through JSON conversion', () => {
      const data: TargetImageData = {
        id: 1,
        dopeLogId: 2,
        rangeSessionId: 3,
        imageUri: '/path/to/image.jpg',
        targetType: 'paper',
        poiMarkers: validPOIMarkers,
        groupSize: 1.5,
        createdAt: '2024-01-15T12:00:00Z',
      };
      const original = new TargetImage(data);
      const json = original.toJSON();
      const converted = TargetImage.fromJSON(json);

      expect(converted.id).toBe(original.id);
      expect(converted.dopeLogId).toBe(original.dopeLogId);
      expect(converted.rangeSessionId).toBe(original.rangeSessionId);
      expect(converted.imageUri).toBe(original.imageUri);
      expect(converted.targetType).toBe(original.targetType);
      expect(converted.poiMarkers).toEqual(original.poiMarkers);
      expect(converted.groupSize).toBe(original.groupSize);
      expect(converted.createdAt).toBe(original.createdAt);
    });
  });
});
