# State Management Patterns

## Overview

The Mobile DOPE app uses **Zustand** for state management, following a domain-driven architecture where each major feature has its own isolated store. This provides a lightweight, performant alternative to Redux while maintaining clear separation of concerns.

## Architecture Principles

### 1. Domain-Driven Stores

Each store manages a specific domain of the application:

- **useAppStore** - Application-level state (settings, initialization, errors)
- **useRifleStore** - Rifle profile management
- **useAmmoStore** - Ammunition profile management
- **useDOPEStore** - DOPE log management

### 2. Separation of Concerns

Stores are separated into three layers:

1. **State Layer** - Immutable state stored in memory
2. **Action Layer** - Functions that modify state (synchronous)
3. **Effect Layer** - Functions that interact with external systems (asynchronous)

### 3. Single Source of Truth

- State exists in one place only
- Database is the source of truth for persistent data
- Stores cache database data for performance
- State updates trigger re-renders via React hooks

## Store Structure

### Basic Store Pattern

```typescript
import { create } from 'zustand';

interface MyState {
  // State
  items: Item[];
  selectedId: number | null;
  loading: boolean;

  // Synchronous actions (state updates)
  setItems: (items: Item[]) => void;
  addItem: (item: Item) => void;
  updateItem: (item: Item) => void;
  removeItem: (id: number) => void;
  setSelectedId: (id: number | null) => void;
  setLoading: (value: boolean) => void;

  // Asynchronous effects (database operations)
  loadItems: () => Promise<void>;
  createItem: (data: ItemData) => Promise<Item>;
  updateItemById: (id: number, data: ItemData) => Promise<Item>;
  deleteItem: (id: number) => Promise<void>;
}

export const useMyStore = create<MyState>((set, get) => ({
  // Initial state
  items: [],
  selectedId: null,
  loading: false,

  // Synchronous actions
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  updateItem: (item) => set((state) => ({
    items: state.items.map((i) => (i.id === item.id ? item : i)),
  })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter((i) => i.id !== id),
  })),
  setSelectedId: (id) => set({ selectedId: id }),
  setLoading: (value) => set({ loading: value }),

  // Asynchronous effects
  loadItems: async () => {
    set({ loading: true });
    try {
      const items = await repository.getAll();
      set({ items, loading: false });
    } catch (error) {
      console.error('Failed to load items:', error);
      set({ loading: false });
      throw error;
    }
  },

  createItem: async (data) => {
    const item = await repository.create(data);
    get().addItem(item);
    return item;
  },

  updateItemById: async (id, data) => {
    const item = await repository.update(id, data);
    get().updateItem(item);
    return item;
  },

  deleteItem: async (id) => {
    await repository.delete(id);
    get().removeItem(id);
  },
}));
```

## Store Patterns

### 1. AppStore - Application State

**File:** `src/store/useAppStore.ts`

**Responsibilities:**
- Application settings (theme, default units, last selected profiles)
- Initialization state (database ready, app initialized)
- Loading and error states
- Settings persistence to AsyncStorage

**Key Patterns:**

#### Settings Persistence

```typescript
// Settings are automatically saved to AsyncStorage on update
updateSettings: async (newSettings) => {
  const updatedSettings = { ...get().settings, ...newSettings };
  set({ settings: updatedSettings });
  await saveSettingsToStorage(updatedSettings);
}

// Settings are loaded from AsyncStorage on app startup
loadSettings: async () => {
  const settings = await loadSettingsFromStorage();
  set({ settings });
}
```

#### Initialization Flow

```typescript
// App.tsx initialization sequence
useEffect(() => {
  const initializeApp = async () => {
    // 1. Load settings from AsyncStorage
    await loadSettings();

    // 2. Initialize database
    await databaseService.initialize();

    // 3. Run migrations
    await migrationRunner.runPendingMigrations();

    // 4. Mark as ready
    setDatabaseReady(true);
    setInitialized(true);
  };

  initializeApp();
}, []);
```

### 2. RifleStore - Entity Management

**File:** `src/store/useRifleStore.ts`

**Responsibilities:**
- Rifle profile CRUD operations
- Selected rifle tracking
- In-memory caching of rifle profiles

**Key Patterns:**

#### Optimistic UI Updates

```typescript
createRifle: async (data) => {
  // 1. Create in database
  const rifle = await rifleProfileRepository.create(data);

  // 2. Add to store (optimistic)
  get().addRifle(rifle);

  // 3. Return created entity
  return rifle;
}
```

#### Safe Updates

```typescript
updateRifle: async (id, data) => {
  // 1. Update in database first
  const rifle = await rifleProfileRepository.update(id, data);

  // 2. Update in store only if database succeeds
  get().updateRifleInStore(rifle);

  return rifle;
}
```

#### Cascading Deletes

```typescript
deleteRifle: async (id) => {
  // Database handles cascading deletes via foreign keys
  await rifleProfileRepository.delete(id);

  // Remove from store
  get().removeRifle(id);

  // Clear selection if deleted rifle was selected
  if (get().selectedRifleId === id) {
    get().setSelectedRifleId(null);
  }
}
```

### 3. AmmoStore - Related Entity Management

**File:** `src/store/useAmmoStore.ts`

**Responsibilities:**
- Ammunition profile CRUD operations
- Caliber-based filtering (ammo matched to rifles by caliber, not FK)
- Selected ammo tracking

**Key Patterns:**

#### Caliber-Based Filtering

```typescript
// Get ammo compatible with a specific rifle
getAmmoForRifle: (rifle: RifleProfile) => {
  return get().ammoProfiles.filter((ammo) => ammo.caliber === rifle.caliber);
}

// Usage in components
const { rifles, selectedRifleId } = useRifleStore();
const { getAmmoForRifle } = useAmmoStore();

const selectedRifle = rifles.find((r) => r.id === selectedRifleId);
const compatibleAmmo = selectedRifle ? getAmmoForRifle(selectedRifle) : [];
```

### 4. DOPEStore - Log Management

**File:** `src/store/useDOPEStore.ts`

**Responsibilities:**
- DOPE log CRUD operations
- Filtering by rifle, ammo, date, distance
- Sorting options

**Key Patterns:**

#### Complex Filtering

```typescript
// Filter state
filters: {
  rifleId: null,
  ammoId: null,
  startDate: null,
  endDate: null,
  minDistance: null,
  maxDistance: null,
}

// Filtered logs (computed)
getFilteredLogs: () => {
  const { dopeLogs, filters } = get();

  return dopeLogs.filter((log) => {
    if (filters.rifleId && log.rifleId !== filters.rifleId) return false;
    if (filters.ammoId && log.ammoId !== filters.ammoId) return false;
    if (filters.startDate && log.timestamp < filters.startDate) return false;
    if (filters.endDate && log.timestamp > filters.endDate) return false;
    if (filters.minDistance && log.distance < filters.minDistance) return false;
    if (filters.maxDistance && log.distance > filters.maxDistance) return false;
    return true;
  });
}
```

#### Sorting

```typescript
sortBy: 'date-desc',

getSortedLogs: () => {
  const logs = get().getFilteredLogs();
  const { sortBy } = get();

  switch (sortBy) {
    case 'date-desc':
      return logs.sort((a, b) => b.timestamp - a.timestamp);
    case 'date-asc':
      return logs.sort((a, b) => a.timestamp - b.timestamp);
    case 'distance-asc':
      return logs.sort((a, b) => a.distance - b.distance);
    case 'distance-desc':
      return logs.sort((a, b) => b.distance - a.distance);
    default:
      return logs;
  }
}
```

## Usage Patterns

### 1. Reading State

```typescript
// Destructure only what you need
const { rifles, loading } = useRifleStore();

// Access nested state
const { settings } = useAppStore();
const defaultUnit = settings.defaultCorrectionUnit;
```

### 2. Updating State

```typescript
// Synchronous updates (immediate)
const { setSelectedRifleId } = useRifleStore();
setSelectedRifleId(5);

// Asynchronous updates (with loading states)
const { createRifle, loading } = useRifleStore();

const handleCreate = async (data) => {
  try {
    const rifle = await createRifle(data);
    console.log('Created:', rifle);
  } catch (error) {
    console.error('Failed to create rifle:', error);
  }
};
```

### 3. Derived State

```typescript
// Compute derived values in the component
const { rifles, selectedRifleId } = useRifleStore();
const selectedRifle = rifles.find((r) => r.id === selectedRifleId);

// Or use store selectors
const selectedRifle = useRifleStore((state) =>
  state.rifles.find((r) => r.id === state.selectedRifleId)
);
```

### 4. Cross-Store Communication

```typescript
// Example: Deleting a rifle clears its selection in AppStore
deleteRifle: async (id) => {
  await rifleProfileRepository.delete(id);
  get().removeRifle(id);

  // Clear selection if deleted
  if (get().selectedRifleId === id) {
    get().setSelectedRifleId(null);
  }

  // Update app settings
  const { settings, updateSettings } = useAppStore.getState();
  if (settings.lastSelectedRifleId === id) {
    await updateSettings({ lastSelectedRifleId: undefined });
  }
}
```

## Best Practices

### 1. Keep Stores Focused

- Each store manages one domain
- Avoid cross-domain logic in stores
- Use separate stores for unrelated concerns

### 2. Database as Source of Truth

- Always save to database first
- Update store only after database succeeds
- Reload from database on app startup

### 3. Error Handling

```typescript
createItem: async (data) => {
  try {
    const item = await repository.create(data);
    get().addItem(item);
    return item;
  } catch (error) {
    // Log error
    console.error('Failed to create item:', error);

    // Optionally set error state
    useAppStore.getState().setError(error.message);

    // Re-throw to allow component to handle
    throw error;
  }
}
```

### 4. Loading States

```typescript
// Set loading before async operations
loadItems: async () => {
  set({ loading: true });
  try {
    const items = await repository.getAll();
    set({ items });
  } finally {
    // Always clear loading, even on error
    set({ loading: false });
  }
}
```

### 5. Immutable Updates

```typescript
// ✅ Good: Create new array
addItem: (item) => set((state) => ({
  items: [...state.items, item],
}))

// ❌ Bad: Mutate existing array
addItem: (item) => set((state) => {
  state.items.push(item); // NEVER mutate state directly
  return { items: state.items };
})
```

### 6. Selector Optimization

```typescript
// Use selectors to avoid unnecessary re-renders
const rifleNames = useRifleStore((state) =>
  state.rifles.map((r) => r.name)
);

// Component only re-renders if rifle names change
// (not on every rifle property change)
```

## Performance Considerations

### 1. Avoid Over-Subscribing

```typescript
// ❌ Bad: Re-renders on any store change
const store = useRifleStore();

// ✅ Good: Re-renders only when rifles change
const rifles = useRifleStore((state) => state.rifles);
```

### 2. Memoize Derived Values

```typescript
// In component
const filteredRifles = useMemo(() => {
  return rifles.filter((r) => r.caliber === selectedCaliber);
}, [rifles, selectedCaliber]);
```

### 3. Batch Updates

```typescript
// Update multiple values in single set() call
loadData: async () => {
  const rifles = await rifleRepo.getAll();
  const ammos = await ammoRepo.getAll();

  // Single state update
  set({ rifles, ammos, loading: false });
}
```

## Testing Stores

### Unit Test Example

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useRifleStore } from '../useRifleStore';

describe('useRifleStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useRifleStore.setState({ rifles: [], selectedRifleId: null });
  });

  it('should add rifle to store', () => {
    const { result } = renderHook(() => useRifleStore());

    const rifle = new RifleProfile({ id: 1, name: 'Test Rifle', ... });

    act(() => {
      result.current.addRifle(rifle);
    });

    expect(result.current.rifles).toHaveLength(1);
    expect(result.current.rifles[0].name).toBe('Test Rifle');
  });

  it('should update rifle in store', () => {
    const { result } = renderHook(() => useRifleStore());

    const rifle1 = new RifleProfile({ id: 1, name: 'Original', ... });
    const rifle2 = new RifleProfile({ id: 1, name: 'Updated', ... });

    act(() => {
      result.current.addRifle(rifle1);
      result.current.updateRifleInStore(rifle2);
    });

    expect(result.current.rifles[0].name).toBe('Updated');
  });
});
```

## Migration Considerations

### From Class Components

If migrating from class-based state:

```typescript
// Old: Class component with state
class MyComponent extends React.Component {
  state = { rifles: [] };

  loadRifles = async () => {
    const rifles = await getRifles();
    this.setState({ rifles });
  }
}

// New: Functional component with Zustand
const MyComponent = () => {
  const { rifles, loadRifles } = useRifleStore();

  useEffect(() => {
    loadRifles();
  }, []);

  return <RifleList rifles={rifles} />;
}
```

### From Context API

If migrating from React Context:

```typescript
// Old: Context provider
const RifleContext = createContext();

// New: Zustand store (no provider needed)
export const useRifleStore = create((set) => ({ ... }));

// Use anywhere without wrapping in provider
const rifles = useRifleStore((state) => state.rifles);
```

## Common Patterns

### 1. Form Handling with Stores

```typescript
const RifleForm = () => {
  const { createRifle, loading } = useRifleStore();
  const [formData, setFormData] = useState(initialData);

  const handleSubmit = async () => {
    try {
      await createRifle(formData);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <Form onSubmit={handleSubmit} loading={loading}>
      {/* form fields */}
    </Form>
  );
};
```

### 2. Optimistic Updates

```typescript
// Update UI immediately, rollback on error
updateRifle: async (id, data) => {
  const originalRifles = get().rifles;

  // Optimistic update
  const optimisticRifle = new RifleProfile({ id, ...data });
  get().updateRifleInStore(optimisticRifle);

  try {
    // Persist to database
    const rifle = await rifleProfileRepository.update(id, data);
    get().updateRifleInStore(rifle);
  } catch (error) {
    // Rollback on error
    set({ rifles: originalRifles });
    throw error;
  }
}
```

### 3. Pagination

```typescript
// Add pagination state
interface RifleState {
  // ... existing state
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;

  loadPage: (page: number) => Promise<void>;
  loadMore: () => Promise<void>;
}

// Implementation
loadPage: async (page) => {
  set({ loading: true });
  const { rifles, total } = await repository.getPage(page, get().pageSize);
  set({
    rifles,
    totalCount: total,
    page,
    hasMore: rifles.length === get().pageSize,
    loading: false,
  });
}

loadMore: async () => {
  if (!get().hasMore || get().loading) return;
  const nextPage = get().page + 1;
  await get().loadPage(nextPage);
}
```

## References

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [React Hooks Best Practices](https://react.dev/reference/react)
- Project files:
  - `src/store/useAppStore.ts`
  - `src/store/useRifleStore.ts`
  - `src/store/useAmmoStore.ts`
  - `src/store/useDOPEStore.ts`
