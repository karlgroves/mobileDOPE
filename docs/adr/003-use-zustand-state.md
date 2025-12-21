# ADR-003: Use Zustand for State Management

**Status:** Accepted

**Date:** 2024-01-20

## Context

The Mobile DOPE app requires state management for:
- Application settings and preferences
- Rifle and ammunition profiles
- DOPE logs and filtering
- UI state (selected profiles, loading states, errors)
- Navigation state

We evaluated several state management solutions:

1. **React Context + Hooks** - Built-in React state management
2. **Redux / Redux Toolkit** - Traditional global state container
3. **MobX** - Observable-based state management
4. **Zustand** - Lightweight state management with hooks
5. **Jotai / Recoil** - Atomic state management

### Requirements

- TypeScript support with full type inference
- Minimal boilerplate
- Good performance (avoid unnecessary re-renders)
- Async operation support (database calls)
- DevTools for debugging
- Small bundle size
- Easy testing
- React hooks integration

## Decision

We will use **Zustand** for all state management.

### Why Zustand?

**Simplicity:**
- Minimal API surface - one `create` function
- No providers, reducers, or actions
- Direct state mutations in a clean way
- Hooks-first design

**Performance:**
- Selector-based subscriptions prevent unnecessary re-renders
- No context provider overhead
- Minimal runtime footprint (<1KB)

**TypeScript:**
- Excellent TypeScript support with full type inference
- No need for separate action type definitions
- Type-safe state updates

**Developer Experience:**
- Redux DevTools integration out of the box
- Simple testing - just call store methods
- Middleware support for logging, persistence, etc.

**Async Support:**
- Natural async/await in store methods
- No thunks or sagas needed

### Alternatives Considered

**Redux Toolkit:**
- Pros: Industry standard, powerful DevTools, large ecosystem
- Cons: More boilerplate, learning curve, larger bundle size
- Decision: Overkill for this app's complexity

**React Context:**
- Pros: Built-in, no dependencies
- Cons: Performance issues with frequent updates, provider hell
- Decision: Not suitable for frequently-updated state

**MobX:**
- Pros: Simple observable pattern, automatic derivations
- Cons: Magic decorators, less explicit, larger bundle
- Decision: Zustand's explicit approach preferred

## Consequences

### Positive

- **Minimal Boilerplate:** Store creation in ~30 lines vs 100+ with Redux
- **Performance:** Selector-based subscriptions avoid Context re-render issues
- **Type Safety:** Full TypeScript inference without manual types
- **Testing:** Easy to test - no mocking providers or complex setup
- **Bundle Size:** Adds less than 1KB to bundle
- **Learning Curve:** Simple API, easy for new developers
- **Debugging:** Redux DevTools work out of the box

### Negative

- **Ecosystem:** Smaller ecosystem than Redux (fewer middlewares/plugins)
- **Patterns:** Less established patterns for complex scenarios
- **Persistence:** Manual implementation of persistence (vs redux-persist)
- **Time Travel:** Limited compared to Redux DevTools

### Risks

- **Complexity Growth:** May need refactoring if state becomes very complex
- **Team Familiarity:** Team may be more familiar with Redux
- **Middleware Needs:** May need custom middleware for advanced features

### Mitigation

- Document clear patterns for store organization (see STATE_MANAGEMENT.md)
- Implement AsyncStorage persistence pattern for settings
- Create reusable middleware for logging if needed
- Can migrate to Redux if complexity justifies it

## Implementation Patterns

### Store Structure

```typescript
// Domain-driven stores
useAppStore      - App settings, initialization, errors
useRifleStore    - Rifle profile CRUD and selection
useAmmoStore     - Ammo profile CRUD and selection
useDOPEStore     - DOPE log CRUD, filtering, sorting
```

### State Updates

```typescript
// Synchronous (immediate UI updates)
setSelectedRifleId: (id) => set({ selectedRifleId: id })

// Asynchronous (database operations)
createRifle: async (data) => {
  const rifle = await repository.create(data);
  get().addRifle(rifle);
  return rifle;
}
```

### Persistence

```typescript
// AsyncStorage integration for settings
updateSettings: async (newSettings) => {
  const updated = { ...get().settings, ...newSettings };
  set({ settings: updated });
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
}
```

### Selectors

```typescript
// Component optimization
const rifles = useRifleStore((state) => state.rifles);
const loading = useRifleStore((state) => state.loading);
```

## Testing Strategy

### Unit Tests

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useRifleStore } from './useRifleStore';

it('should add rifle', () => {
  const { result } = renderHook(() => useRifleStore());
  act(() => {
    result.current.addRifle(rifle);
  });
  expect(result.current.rifles).toHaveLength(1);
});
```

### Integration Tests

```typescript
// Test database operations
it('should create rifle in database', async () => {
  const { result } = renderHook(() => useRifleStore());
  const rifle = await act(async () => {
    return await result.current.createRifle(data);
  });
  expect(rifle.id).toBeDefined();
});
```

## Performance Considerations

### Selector Optimization

```typescript
// ✅ Good: Specific selector
const rifles = useRifleStore((state) => state.rifles);

// ❌ Bad: Whole store
const store = useRifleStore();
```

### Computed Values

```typescript
// In component, not store
const filteredRifles = useMemo(() => {
  return rifles.filter(r => r.caliber === selected);
}, [rifles, selected]);
```

### Batch Updates

```typescript
// Single set() for multiple changes
set({ rifles, ammos, loading: false });
```

## Future Enhancements

### Persistence Middleware

If needed, create reusable persistence:

```typescript
const persist = (config) => (set, get, api) =>
  config(
    (...args) => {
      set(...args);
      AsyncStorage.setItem(KEY, JSON.stringify(get()));
    },
    get,
    api
  );
```

### DevTools Integration

```typescript
import { devtools } from 'zustand/middleware';

const useStore = create(
  devtools(
    (set) => ({ ... }),
    { name: 'RifleStore' }
  )
);
```

### Immer Integration

For complex nested updates:

```typescript
import { immer } from 'zustand/middleware/immer';

const useStore = create(
  immer((set) => ({ ... }))
);
```

## References

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Zustand Best Practices](https://github.com/pmndrs/zustand/blob/main/docs/guides/practice-with-no-store-actions.md)
- Project documentation: `docs/STATE_MANAGEMENT.md`
- Implementation files:
  - `src/store/useAppStore.ts`
  - `src/store/useRifleStore.ts`
  - `src/store/useAmmoStore.ts`
  - `src/store/useDOPEStore.ts`
