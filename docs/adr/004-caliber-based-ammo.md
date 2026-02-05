# ADR-004: Caliber-Based Ammunition Architecture

**Status:** Accepted

**Date:** 2024-01-25

## Context

The app needs to manage the relationship between rifles and ammunition. Two primary architectural approaches were considered:

### Option 1: Foreign Key Relationship

```sql
CREATE TABLE ammo_profiles (
  id INTEGER PRIMARY KEY,
  rifle_id INTEGER NOT NULL,  -- FK to rifles
  name TEXT,
  ...
  FOREIGN KEY (rifle_id) REFERENCES rifle_profiles(id)
);
```

**Pros:**

- Strict referential integrity
- Clear ownership model
- Prevents orphaned ammo records

**Cons:**

- Ammo tied to single rifle
- Same ammo must be duplicated for multiple rifles
- Cannot share ammo across rifles of same caliber
- User friction when managing multiple rifles

### Option 2: Caliber-Based Matching

```sql
CREATE TABLE ammo_profiles (
  id INTEGER PRIMARY KEY,
  caliber TEXT NOT NULL,  -- String match to rifle caliber
  name TEXT,
  ...
);
```

**Pros:**

- Ammo can be used with any rifle of matching caliber
- No duplication needed
- Natural user mental model
- Flexible for future features (ammo marketplace, sharing)

**Cons:**

- Weaker referential integrity
- Application-layer filtering required
- Potential for orphaned ammo (no matching rifles)

### Real-World Usage Pattern

Shooters typically:

1. Own multiple rifles in the same caliber (.308, 6.5 CM, etc.)
2. Use the same ammunition across those rifles
3. Track load development separately from specific rifles
4. Change rifles but keep load data

Example: A shooter with:

- Rifle A: Bolt-action .308 (precision)
- Rifle B: Semi-auto .308 (competition)
- Rifle C: .308 hunting rifle

All three use the same 168gr HPBT load. Requiring three separate ammo profiles would be frustrating and error-prone.

## Decision

We will use **caliber-based matching** instead of foreign key relationships.

### Implementation

**Database Schema:**

```sql
CREATE TABLE rifle_profiles (
  id INTEGER PRIMARY KEY,
  caliber TEXT NOT NULL,
  ...
);

CREATE TABLE ammo_profiles (
  id INTEGER PRIMARY KEY,
  caliber TEXT NOT NULL,  -- No FK, matched by string
  ...
);
```

**Application Layer:**

```typescript
// Get ammo compatible with a rifle
function getAmmoForRifle(rifle: RifleProfile): AmmoProfile[] {
  return ammoProfiles.filter(ammo => ammo.caliber === rifle.caliber);
}

// SQL query
SELECT * FROM ammo_profiles
WHERE caliber = (SELECT caliber FROM rifle_profiles WHERE id = ?);
```

### Migration Path

For apps that initially used rifle_id FK:

1. Add caliber column to ammo_profiles (Migration 002)
2. Populate caliber from linked rifles (Migration 003)
3. Remove rifle_id foreign key (Migration 004)

## Consequences

### Positive

- **Reusability:** Single ammo profile works with all rifles of that caliber
- **User Experience:** Natural mental model matching how shooters think
- **Flexibility:** Easy to add new rifles without ammo duplication
- **Load Development:** Ammo data independent of rifle configuration
- **Future Features:** Enables ammo sharing, marketplace, community loads

### Negative

- **Orphaned Data:** Ammo can exist without matching rifles
- **Validation:** Must validate caliber strings at application layer
- **Integrity:** Database cannot enforce matching via FK constraint
- **Deletion:** More complex to determine if ammo is "in use"

### Risks

- **Typos:** "308 Winchester" vs ".308 Winchester" vs "308 Win"
- **Consistency:** Same caliber represented differently
- **Data Cleanup:** Orphaned ammo profiles accumulate

### Mitigation

**Caliber Standardization:**

```typescript
// Predefined caliber constants
const CALIBERS = {
  '308_WIN': '.308 Winchester',
  '65_CREED': '6.5 Creedmoor',
  '223_REM': '.223 Remington',
  // ... 50+ standard calibers
};

// Caliber picker component enforces consistency
<CaliberPicker options={Object.values(CALIBERS)} />

// Allow custom entry with validation
function validateCaliber(input: string): boolean {
  // Standardize format, suggest corrections
}
```

**Orphaned Data Detection:**

```typescript
// Find ammo with no matching rifles
SELECT DISTINCT caliber FROM ammo_profiles
WHERE caliber NOT IN (
  SELECT DISTINCT caliber FROM rifle_profiles
);

// Offer cleanup during data management
function findOrphanedAmmo(): AmmoProfile[] {
  const rifleCalibers = new Set(rifles.map(r => r.caliber));
  return ammos.filter(a => !rifleCalibers.has(a.caliber));
}
```

**Deletion Warnings:**

```typescript
// Warn when deleting last rifle of a caliber
async function deleteRifle(id: number): Promise<void> {
  const rifle = getRifleById(id);
  const otherRifles = rifles.filter((r) => r.id !== id && r.caliber === rifle.caliber);

  if (otherRifles.length === 0) {
    const ammoCount = ammos.filter((a) => a.caliber === rifle.caliber).length;
    if (ammoCount > 0) {
      Alert.alert(
        'Last Rifle in Caliber',
        `You have ${ammoCount} ammo profiles for ${rifle.caliber}. ` +
          `Delete this rifle and keep ammo profiles?`,
        [
          { text: 'Keep Rifle', style: 'cancel' },
          { text: 'Delete Rifle, Keep Ammo', onPress: () => doDelete(id) },
        ]
      );
      return;
    }
  }

  await doDelete(id);
}
```

## Implementation Details

### Caliber Picker Component

```typescript
interface CaliberPickerProps {
  value: string;
  onChange: (caliber: string) => void;
  allowCustom?: boolean;
}

export const CaliberPicker: React.FC<CaliberPickerProps> = ({
  value,
  onChange,
  allowCustom = true,
}) => {
  const [showCustomInput, setShowCustomInput] = useState(false);

  return (
    <View>
      <Picker
        selectedValue={value}
        onValueChange={(caliber) => {
          if (caliber === 'CUSTOM') {
            setShowCustomInput(true);
          } else {
            onChange(caliber);
          }
        }}
      >
        {STANDARD_CALIBERS.map(cal => (
          <Picker.Item key={cal} label={cal} value={cal} />
        ))}
        {allowCustom && (
          <Picker.Item label="Custom..." value="CUSTOM" />
        )}
      </Picker>

      {showCustomInput && (
        <TextInput
          placeholder="Enter custom caliber"
          value={value}
          onChangeText={onChange}
        />
      )}
    </View>
  );
};
```

### Database Queries

```typescript
// Repository method
export class AmmoProfileRepository {
  // Get all ammo for a specific rifle
  async getByRifle(rifle: RifleProfile): Promise<AmmoProfile[]> {
    const sql = `
      SELECT * FROM ammo_profiles
      WHERE caliber = ?
      ORDER BY name`;
    const rows = await db.getAllAsync(sql, [rifle.caliber]);
    return rows.map((row) => AmmoProfile.fromDB(row));
  }

  // Get all ammo for a caliber
  async getByCaliber(caliber: string): Promise<AmmoProfile[]> {
    const sql = `
      SELECT * FROM ammo_profiles
      WHERE caliber = ?
      ORDER BY name`;
    const rows = await db.getAllAsync(sql, [caliber]);
    return rows.map((row) => AmmoProfile.fromDB(row));
  }

  // Find orphaned ammo
  async findOrphaned(): Promise<AmmoProfile[]> {
    const sql = `
      SELECT * FROM ammo_profiles
      WHERE caliber NOT IN (
        SELECT DISTINCT caliber FROM rifle_profiles
      )`;
    const rows = await db.getAllAsync(sql);
    return rows.map((row) => AmmoProfile.fromDB(row));
  }
}
```

## Testing Considerations

### Unit Tests

```typescript
describe('Caliber-based matching', () => {
  it('should match ammo to rifle by caliber', () => {
    const rifle = new RifleProfile({ caliber: '.308 Winchester', ... });
    const ammo1 = new AmmoProfile({ caliber: '.308 Winchester', ... });
    const ammo2 = new AmmoProfile({ caliber: '6.5 Creedmoor', ... });

    const compatible = getAmmoForRifle(rifle);

    expect(compatible).toContain(ammo1);
    expect(compatible).not.toContain(ammo2);
  });

  it('should allow same ammo for multiple rifles', () => {
    const rifle1 = new RifleProfile({ caliber: '.308 Winchester', ... });
    const rifle2 = new RifleProfile({ caliber: '.308 Winchester', ... });
    const ammo = new AmmoProfile({ caliber: '.308 Winchester', ... });

    expect(getAmmoForRifle(rifle1)).toContain(ammo);
    expect(getAmmoForRifle(rifle2)).toContain(ammo);
  });

  it('should detect orphaned ammo', async () => {
    // Create ammo without matching rifle
    await ammoRepo.create({ caliber: '50 BMG', ... });

    const orphaned = await ammoRepo.findOrphaned();
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0].caliber).toBe('50 BMG');
  });
});
```

## Future Enhancements

### Caliber Aliases

Support common aliases:

```typescript
const CALIBER_ALIASES = {
  '.308 Winchester': ['.308 Win', '7.62x51mm', '7.62 NATO'],
  '6.5 Creedmoor': ['6.5 CM', '6.5 Creed'],
};

function matchesCaliber(ammo: string, rifle: string): boolean {
  if (ammo === rifle) return true;
  return CALIBER_ALIASES[rifle]?.includes(ammo) || false;
}
```

### Community Ammo Database

Caliber-based architecture enables:

- Sharing ammo profiles between users
- Community-validated load data
- Factory ammo database by caliber

### Ammo Recommendations

```typescript
// Suggest popular ammo for user's rifles
function suggestAmmoForRifles(rifles: RifleProfile[]): AmmoSuggestion[] {
  const calibers = new Set(rifles.map((r) => r.caliber));
  return fetchPopularAmmoForCalibers(Array.from(calibers));
}
```

## References

- Database Schema: `docs/DATABASE_SCHEMA.md`
- Migration Files: `src/services/database/migrations/`
- Ammo Repository: `src/services/database/AmmoProfileRepository.ts`
- Caliber Constants: `src/constants/calibers.ts`
