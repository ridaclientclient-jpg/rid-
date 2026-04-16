# RIDA SUPREME SYSTEM — Google Maps Integration Worklog

## Date: 2025-06-09

## Summary
Integrated Google Maps Platform into the RIDA SUPREME SYSTEM with reusable map and autocomplete components. Replaced simulated map placeholders on both the Client Ride page and Driver Rides page with real, interactive Google Maps.

## Files Created

### 1. `src/lib/googleMaps.ts`
- Singleton `loadGoogleMaps()` that dynamically loads the Google Maps JS API with `places`, `marker`, and `geometry` libraries
- `geocodeAddress(address)` — converts an address string to `{ lat, lng }` coordinates
- `reverseGeocode(lat, lng)` — converts coordinates to a formatted address string
- `calculateDistance(origin, destination)` — Haversine formula distance calculation in km
- `estimateFare(distance, rideType)` — fare estimation helper based on distance and ride type
- `getNavigationUrl(destination, origin?)` — builds a Google Maps navigation URL for external nav

### 2. `src/components/GoogleMap.tsx`
- Reusable Google Map component with dark theme styling matching RIDA's glassmorphism design
- Features:
  - Custom dark map styles (midnight blue palette)
  - User geolocation with a pulsing cyan dot marker
  - AdvancedMarkerElement with PinElement for labeled/colored markers (with fallback to legacy Marker)
  - Directions/routing support via `showRoute` + `showDirections` props
  - Map click handler via `onMapClick` callback
  - `onMapLoaded` callback for external map reference access
  - **Graceful error fallback**: renders the original simulated map placeholder if Google Maps fails to load
  - Configurable `height`, `zoom`, `center`, `className`, and `style` props

### 3. `src/components/PlacesAutocomplete.tsx`
- Google Places Autocomplete input with debounced search (300ms)
- Restricted to Costa Rica by default (`country='CR'`)
- Returns full address, placeId, lat, and lng on selection
- Keyboard navigation (ArrowUp/Down/Enter/Escape)
- Loading spinner while fetching predictions
- Configurable dot color indicator (green for origin, red for destination)
- Disabled state support

## Files Modified

### 4. `src/app/client/ride/page.tsx`
- Replaced simulated map placeholder with `<GoogleMap>` component
- Replaced manual text inputs + local location list with `<PlacesAutocomplete>` components
- Added `originCoords` and `destCoords` state to track selected place coordinates
- Map shows origin (green "A") and destination (red "B") markers when places are selected
- Route line drawn on map when both origin and destination coordinates are available
- All existing ride simulation logic (searching → assigned → arriving → started → completed) preserved intact
- Third-party popup, SOS button, driver info, and ride type selection all unchanged

### 5. `src/app/driver/rides/page.tsx`
- Added `<GoogleMap>` component in a collapsible top panel (45% of viewport height)
- Map toggle button to show/hide (smooth height transition)
- When a ride is accepted, geocodes the origin and destination addresses to get coordinates
- Shows route on map when an active ride has valid coordinates
- Driver's user location marker displayed via geolocation
- All existing ride simulation logic (pending rides, accept/reject, status progression) preserved intact
- Online toggle, pending ride cards, active ride panel, SOS button all unchanged

## Architecture Decisions
- **Singleton map loading**: `loadGoogleMaps()` uses a cached promise to prevent duplicate script injection
- **Graceful degradation**: If Google Maps API fails to load, the client ride page falls back to the original simulated map placeholder
- **Coordinate storage**: Coordinates are tracked in component state and passed to the map — the ride store continues using string addresses for origin/destination (no breaking changes to store interface)
- **Dark theme**: Map uses custom `MapTypeStyle` array with dark blues matching the RIDA color system

## Environment
- API Key: `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (already in `.env.local`)
- Libraries loaded: `places`, `marker`, `geometry`
- Map ID: `RIDA_SUPREME_MAP`

---

# RIDA SUPREME SYSTEM — Supabase Auth & Database Integration Worklog

## Date: 2025-06-09

## Summary
Replaced all demo/mock authentication and ride management with real Supabase Auth and Database integration. Added AuthGuard component for route protection, updated all layouts to use AuthGuard, and migrated all login/register pages to handle the new async Supabase-based auth flow.

## Files Created

### 1. `src/components/AuthGuard.tsx`
- Client-side auth protection component that wraps application content
- Calls `initAuth()` on mount to check Supabase session + fetch profile from `profiles` table
- Shows loading spinner while checking auth state
- Redirects to `authPage` route if user is not authenticated
- Supports `requiredRole` prop for role-based access control (admin, vendor, etc.)
- Shows "Access Denied" UI if user role doesn't match required role

### 2. `src/lib/googleMaps.ts` (Rewritten)
- Singleton `Loader` instance via `getGoogleMapsLoader()`
- `loadGoogleMaps()` — returns the `google` namespace after dynamic script loading
- `geocodeAddress(address)` — converts address string to `{ lat, lng, formattedAddress }` using Geocoder API (restricted to Costa Rica)
- `reverseGeocode(lat, lng)` — converts coordinates to formatted address string
- `calculateDistance(lat1, lng1, lat2, lng2)` — Haversine formula for distance in km

## Files Modified

### 3. `src/store/authStore.ts` (Complete Rewrite)
- **Removed**: All demo/mock user data, `localStorage` session management, `resetLoginAttempts`
- **Added**: Real Supabase Auth integration
  - `initAuth()` — checks existing session via `supabase.auth.getSession()`, fetches profile from `profiles` table, sets up `onAuthStateChange` listener
  - `login(email, password)` — uses `supabase.auth.signInWithPassword()`, returns `{ success, error? }` with Spanish error messages and login attempt locking (5 attempts → 15 min lockout)
  - `register(name, email, phone, password, role)` — uses `supabase.auth.signUp()` with user metadata, returns `{ success, error? }`
  - `logout()` — calls `supabase.auth.signOut()` and clears all state
  - `updateProfile(updates)` — updates `profiles` table and merges state
- **New state fields**: `supaUser`, `session` (raw Supabase objects)
- **Helper**: `profileToUser()` converts Supabase `Profile` to `AuthUser` interface

### 4. `src/store/rideStore.ts` (Complete Rewrite)
- **Removed**: All in-memory-only ride logic, `simulateRideProgress()`, no-argument `cancelRide()`/`completeRide()`
- **Added**: Real Supabase Database integration
  - `createRide(origin, destination, originLat?, originLng?, destLat?, destLng?)` — inserts ride into `rides` table, fetches pricing from `settings` table, subscribes to real-time updates via `postgres_changes`, simulates driver assignment/arriving/started flow (3s/8s/13s timeouts) with Supabase updates
  - `cancelRide(rideId)` — updates ride status to `cancelled` in Supabase
  - `completeRide(rideId)` — updates ride status to `completed` with 15% commission calculation
  - `fetchRideHistory(userId)` — fetches ride history from `rides` table (limited to 20, ordered by `created_at` desc)
  - `subscribeToRideUpdates(rideId)` — real-time subscription via Supabase channel for live ride status updates
  - `searchNearbyDrivers(lat, lng)` — fetches online verified drivers from `drivers` table with joined profile/vehicle data
- **Field names**: Changed from camelCase (`driverName`, `driverVehicle`, `driverRating`) to snake_case (`driver_name`, `driver_vehicle`, `driver_rating`) matching Supabase column names

### 5. `src/app/client/layout.tsx`
- Added `AuthGuard` import
- Auth pages (login/register/recovery) render children directly without AuthGuard
- Non-auth pages wrapped with `<AuthGuard authPage="/client/login">`
- Removed `isAuthenticated` conditional rendering (AuthGuard handles it)

### 6. `src/app/driver/layout.tsx`
- Added `AuthGuard` import
- Removed manual `useEffect` auth check and early `return null` for unauthenticated users
- Removed `useEffect` and `isAuthenticated` import (no longer needed)
- Auth pages render children directly; non-auth pages wrapped with `<AuthGuard authPage="/driver/login">`

### 7. `src/app/admin/layout.tsx`
- Added `AuthGuard` import
- Removed manual loading spinner and `useHydrated` auth check (AuthGuard handles it)
- Login page bypass preserved (`if (pathname === '/admin/login')`)
- Entire admin dashboard wrapped with `<AuthGuard requiredRole="admin" authPage="/admin/login">`

### 8. `src/app/marketplace/layout.tsx`
- Added `AuthGuard` import
- Removed `useCallback`, `useEffect`, `localStorage` session restore logic
- Removed `isAuthenticated` conditional content rendering
- Login page bypass preserved; protected pages wrapped with `<AuthGuard requiredRole="vendor" authPage="/marketplace/login">`

### 9. `src/app/client/login/page.tsx`
- Updated `handleLogin()` to destructure `{ success, error }` from login result
- Error handling now uses `result.error` instead of manual Spanish message construction

### 10. `src/app/driver/login/page.tsx`
- Same pattern as client login: `{ success, error }` destructuring

### 11. `src/app/admin/login/page.tsx`
- Updated `handleSubmit()` to use `{ success, error }` return format

### 12. `src/app/marketplace/login/page.tsx`
- Updated both `handleLogin()` and `handleRegister()` to handle `{ success, error }` return format

### 13. `src/app/client/register/page.tsx`
- Updated `handleRegister()` to handle `{ success, error }` with error toast

### 14. `src/app/driver/register/page.tsx`
- Updated `handleRegister()` to handle `{ success, error }` with error toast

### 15. `src/app/client/ride/page.tsx`
- Updated `cancelRide()` calls to pass `currentRide.id` argument
- Updated `completeRide()` calls to pass `currentRide.id` argument
- Updated field references: `driverName` → `driver_name`, `driverVehicle` → `driver_vehicle`, `driverRating` → `driver_rating`
- Added null-safe check for third-party popup cancel: `if (currentRide) cancelRide(currentRide.id)`

## Breaking Changes
- `login()` now returns `Promise<{ success: boolean; error?: string }>` instead of `Promise<boolean>`
- `register()` now returns `Promise<{ success: boolean; error?: string }>` instead of `Promise<boolean>`
- `logout()` now returns `Promise<void>` instead of `void`
- `cancelRide()` now requires `rideId: string` argument
- `completeRide()` now requires `rideId: string` argument
- `createRide()` now accepts optional lat/lng parameters and returns `Promise<string | null>` (ride ID)
- `simulateRideProgress()` removed from ride store
- Auth store no longer uses `localStorage` for session persistence (Supabase handles this via cookies)
- Auth store exposes `supaUser` and `session` for raw Supabase access

## Architecture Decisions
- **AuthGuard over manual checks**: Centralized auth logic in AuthGuard component eliminates repetitive `useEffect` + redirect patterns across layouts
- **Supabase session persistence**: Leveraging Supabase's built-in cookie-based session management instead of manual `localStorage`
- **Real-time subscriptions**: Ride updates use Supabase Realtime `postgres_changes` for live status updates
- **Pricing from settings table**: Ride creation fetches `base_price` and `price_per_km` from `settings` table for dynamic pricing

---

Task ID: admin-auth-pages
Agent: Main Agent
Task: Add register and forgot-password pages to admin panel

Work Log:
- Investigated admin login page and found missing register and recovery links
- Read client recovery and register pages as reference for design consistency
- Updated `/admin/login/page.tsx` to add "Olvidaste tu contraseña?" and "Registrarse" links
- Created `/admin/register/page.tsx` with 2-step form (personal data → security), admin role, same glassmorphism theme
- Created `/admin/recovery/page.tsx` with email input, sends reset link via API, returns to admin login
- Updated `/admin/layout.tsx` to allow `/admin/register` and `/admin/recovery` as public paths (no auth required)
- Updated `/api/auth/reset-password/route.ts` to accept optional `redirectTo` parameter (defaults to `/client/login`)

Stage Summary:
- Admin panel now has 3 public pages: login, register, recovery
- All pages share the same dark glassmorphism + cyan neon theme
- Admin register uses role='admin' in the shared authStore.register()
- Recovery page sends `redirectTo: '/admin/login'` so password reset returns to admin login
- Layout bypass updated with `publicPaths` array for clean extensibility
