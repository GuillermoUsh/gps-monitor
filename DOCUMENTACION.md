# GPS Monitor — Documentación del Proyecto

> Sistema de seguimiento GPS para flotas de transporte con gestión de vehículos, conductores, documentos y viajes programados.

---

## Índice

1. [Stack tecnológico](#1-stack-tecnológico)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [Variables de entorno](#3-variables-de-entorno)
4. [Base de datos](#4-base-de-datos)
5. [Backend — Endpoints](#5-backend--endpoints)
6. [Backend — Servicios](#6-backend--servicios)
7. [Frontend — Secciones](#7-frontend--secciones)
8. [Frontend — Servicios API](#8-frontend--servicios-api)
9. [Autenticación y seguridad](#9-autenticación-y-seguridad)
10. [Paquetes](#10-paquetes)

---

## 1. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 20 + Express + TypeScript |
| Base de datos | PostgreSQL |
| Caché | Redis |
| Tiempo real | Socket.IO (WebSocket) |
| Frontend | Angular 21 (standalone + signals) |
| UI components | PrimeNG 21 |
| Mapas | Leaflet |
| CSS | Tailwind CSS + SCSS por componente |
| Email | Resend API |
| Autenticación | JWT + Refresh Token Rotation |
| Deploy | Railway (monorepo, Docker multistage) |

---

## 2. Estructura del proyecto

```
gps-monitor/
├── backend/
│   └── src/
│       ├── config/           ← env.ts, database.ts, redis.ts
│       ├── controllers/      ← Handlers HTTP (sin lógica de negocio)
│       ├── routes/           ← Definición de endpoints y validación Zod
│       ├── services/         ← Lógica de negocio
│       ├── repositories/     ← Acceso a PostgreSQL (SQL puro, pg)
│       ├── middleware/       ← auth, role, validation, error-handler
│       ├── shared/
│       │   ├── types/        ← Interfaces TypeScript (TripRow, VehicleDto, etc.)
│       │   └── errors/       ← AppError, NotFoundError, ConflictError, etc.
│       ├── socket/           ← SocketServer (Socket.IO)
│       ├── db/
│       │   └── migrate.ts    ← Corre todas las migraciones al iniciar
│       ├── app.ts            ← Express app factory
│       └── main.ts           ← Bootstrap: migrate → listen
│
├── frontend/
│   └── src/
│       ├── app/
│       │   └── app.routes.ts ← Rutas raíz con lazy loading
│       ├── core/
│       │   ├── api/          ← Servicios HTTP (fleet, trip, route, position, user)
│       │   └── auth/         ← AuthService, AuthGuard, interceptor
│       └── features/
│           ├── auth/         ← Login, Register, ChangePassword, VerifyEmail
│           ├── dashboard/    ← Panel principal del admin
│           ├── users/        ← Gestión de usuarios
│           ├── fleet/        ← Dashboard, Vehículos, Conductores
│           ├── trips/        ← Lista de viajes, historial
│           ├── routes/       ← Gestión de rutas
│           ├── map/          ← Mapa en vivo
│           ├── simulator/    ← Simulador GPS
│           └── driver/       ← Vista del conductor (app móvil)
│
└── db/
    └── migrations/           ← 021 archivos SQL (IF NOT EXISTS, idempotentes)
```

---

## 3. Variables de entorno

El backend valida todas las variables al arrancar con Zod. Si alguna falta o es inválida, el proceso termina con error.

```env
# Entorno
NODE_ENV=production
PORT=3000

# PostgreSQL
DB_HOST=
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=

# Redis
REDIS_URL=

# JWT
JWT_SECRET=                    # mínimo 32 caracteres
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=          # mínimo 32 caracteres
REFRESH_TOKEN_EXPIRES_IN=7d

# Email (Resend)
RESEND_API_KEY=
RESEND_FROM=

# URLs
APP_URL=https://tudominio.up.railway.app
CORS_ORIGIN=
SOCKET_CORS_ORIGIN=https://tudominio.up.railway.app

# GPS
DEVIATION_THRESHOLD_METERS=50
```

---

## 4. Base de datos

**Motor:** PostgreSQL
**Patrón de migraciones:** Archivos SQL numerados (`001_...sql` → `021_...sql`), ejecutados automáticamente al iniciar el servidor. Todos usan `IF NOT EXISTS` para ser idempotentes.

### Diagrama de relaciones

```
users ──────────────────────────────────────────────────┐
  │                                                      │
  ├── refresh_tokens (user_id → users.id)               │
  │                                                      │
  ├── driver_profiles (user_id → users.id) [1:1]        │
  │       └── driver_documents (driver_id → driver_profiles.id)
  │                                                      │
  └── trips (driver_id → users.id)                      │
        └── trip_positions (trip_id → trips.id)         │
                                                         │
routes ──────────────────────────────────────────────────│
  ├── route_waypoints (route_id → routes.id)            │
  └── trips (route_id → routes.id)                      │
                                                         │
vehicles ───────────────────────────────────────────────┘
  ├── trips (vehicle_id → vehicles.id)
  ├── vehicle_assignments (vehicle_id → vehicles.id)
  │       └── (driver_id → users.id)
  ├── vehicle_documents (vehicle_id → vehicles.id)
  └── maintenances (vehicle_id → vehicles.id)
```

### Tablas

#### `users`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| email | VARCHAR 255 UNIQUE | |
| password_hash | TEXT | bcrypt |
| role | VARCHAR 30 | `admin`, `driver`, `mechanic`, `administration`, `sales` |
| verified | BOOLEAN | Verificación por email |
| must_change_password | BOOLEAN | Fuerza cambio en primer login |
| verification_token | TEXT | Token temporal (24hs) |
| created_at / updated_at | TIMESTAMPTZ | |

#### `refresh_tokens`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| token_hash | TEXT UNIQUE | Hash del refresh token |
| user_id | UUID FK → users | |
| family | UUID | Detecta reuso de tokens robados |
| used | BOOLEAN | Token ya utilizado |
| expires_at | TIMESTAMPTZ | |

#### `routes`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| name | VARCHAR 150 UNIQUE | |
| origin | VARCHAR 150 | |
| destination | VARCHAR 150 | |
| status | VARCHAR 20 | `active`, `inactive` |
| duracion_minutos | INTEGER | Duración estimada del recorrido |

#### `route_waypoints`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| route_id | UUID FK → routes | |
| lat | DOUBLE PRECISION | |
| lng | DOUBLE PRECISION | |
| order | INTEGER | Orden del punto |

#### `trips`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| route_id | UUID FK → routes | |
| driver_id | UUID FK → users | |
| vehicle_id | UUID FK → vehicles (nullable) | |
| status | VARCHAR 20 | `active`, `completed`, `cancelled`, `scheduled` |
| distance_km | NUMERIC 10,3 | Acumulado en tiempo real |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ (nullable) | |
| tipo_viaje | VARCHAR 20 (nullable) | `ida_vuelta`, `espera` |
| scheduled_departure | TIMESTAMPTZ (nullable) | Salida programada |
| scheduled_return | TIMESTAMPTZ (nullable) | Regreso a buscar (ida_vuelta) |
| duracion_actividad_minutos | INTEGER (nullable) | Tiempo en destino (espera) |
| cantidad_pasajeros | INTEGER (nullable) | |

#### `trip_positions`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| trip_id | UUID FK → trips | |
| lat / lng | DOUBLE PRECISION | |
| speed_kmh | NUMERIC 6,2 (nullable) | |
| is_deviation | BOOLEAN | Fuera de ruta |
| deviation_meters | NUMERIC (nullable) | Distancia a la ruta |
| recorded_at | TIMESTAMPTZ | |

#### `driver_profiles`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| user_id | UUID UNIQUE FK → users | Relación 1:1 |
| nombre / apellido | VARCHAR 100 (nullable) | |
| licencia | TEXT | Número de licencia |
| vencimiento_licencia | DATE (nullable) | |
| telefono | TEXT (nullable) | |
| curso_puerto | BOOLEAN | Habilitación puerto |
| notas | TEXT (nullable) | |

#### `vehicles`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| marca / modelo | TEXT | |
| anio | INTEGER (nullable) | |
| patente | TEXT UNIQUE | |
| alias | VARCHAR 50 (nullable) | Nombre interno |
| vin | TEXT (nullable) | Número de chasis |
| numero_motor | TEXT (nullable) | |
| tipo | TEXT (nullable) | |
| color | TEXT (nullable) | |
| capacidad_pasajeros | INTEGER (nullable) | Para validar viajes |
| estado | TEXT | `disponible`, `en_uso`, `en_mantenimiento`, `fuera_de_servicio` |
| kilometraje | INTEGER | |
| notas | TEXT (nullable) | |

#### `vehicle_assignments`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| vehicle_id | UUID FK → vehicles | |
| driver_id | UUID FK → users | |
| assigned_at | TIMESTAMPTZ | |
| unassigned_at | TIMESTAMPTZ (nullable) | |
| notes | TEXT (nullable) | |

#### `vehicle_documents`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| vehicle_id | UUID FK → vehicles | |
| tipo | TEXT | `seguro`, `vtv`, `habilitacion_turistica`, `matafuego`, `otro` |
| descripcion | TEXT (nullable) | |
| codigo | VARCHAR 100 (nullable) | Ej: N° de serie del matafuego |
| fecha_vencimiento | DATE | |

#### `maintenances`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| vehicle_id | UUID FK → vehicles | |
| tipo | TEXT | Ej: "cambio de aceite" |
| descripcion | TEXT (nullable) | |
| fecha | DATE | Fecha del mantenimiento |
| kilometraje | INTEGER (nullable) | Km al momento |
| proximo_service_km | INTEGER (nullable) | |
| proximo_service_fecha | DATE (nullable) | |
| turno_fecha / turno_descripcion | nullable | Turno programado |

#### `driver_documents`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID PK | |
| driver_id | UUID FK → driver_profiles | |
| tipo | VARCHAR 50 | |
| descripcion | TEXT (nullable) | |
| fecha_vencimiento | DATE | |

---

## 5. Backend — Endpoints

Todos los endpoints devuelven `{ status: 'success', data: ... }` o `{ status: 'error', message: ... }`.

### Autenticación (`/auth`)

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Registro de usuario (envía email de verificación) |
| POST | `/auth/login` | No | Login → devuelve `accessToken` + `refreshToken` + `user` |
| POST | `/auth/refresh` | No | Renueva access token usando refresh token |
| POST | `/auth/logout` | Sí | Invalida el refresh token |
| POST | `/auth/change-password` | Sí | Cambia contraseña del usuario autenticado |

### Usuarios (`/users`) — Solo admin

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/users` | Lista todos los usuarios |
| POST | `/users` | Crea usuario con cualquier rol (requiere email, password, role) |

### Rutas (`/routes`)

| Método | Path | Rol requerido | Descripción |
|--------|------|--------------|-------------|
| GET | `/routes` | Cualquiera | Lista todas las rutas |
| GET | `/routes/:id` | Cualquiera | Detalle de una ruta |
| POST | `/routes` | Admin | Crea ruta con waypoints |
| PUT | `/routes/:id` | Admin | Actualiza ruta |
| DELETE | `/routes/:id` | Admin | Elimina ruta |

### Viajes (`/trips`)

| Método | Path | Rol requerido | Descripción |
|--------|------|--------------|-------------|
| GET | `/trips` | Cualquiera | Lista todos los viajes |
| GET | `/trips/mine` | Cualquiera | Viajes del conductor autenticado |
| POST | `/trips` | Driver / Admin | Inicia viaje GPS en tiempo real |
| POST | `/trips/schedule` | Admin | Programa un viaje futuro |
| PATCH | `/trips/:id` | Driver / Admin | Completa o cancela un viaje |
| PATCH | `/trips/:id/schedule` | Admin | Reprograma un viaje programado |
| GET | `/trips/:tripId/positions` | Cualquiera | Historial de posiciones GPS |
| POST | `/trips/:tripId/positions` | Driver / Admin | Ingesta posición GPS en tiempo real |
| GET | `/trips/positions/latest` | Cualquiera | Últimas posiciones de viajes activos (para mapa) |

### Flota (`/fleet`) — Todos requieren autenticación

#### Vehículos

| Método | Path | Rol requerido | Descripción |
|--------|------|--------------|-------------|
| GET | `/fleet/vehicles/dashboard` | Cualquiera | Stats: total, disponibles, en uso, vencimientos |
| GET | `/fleet/vehicles` | Cualquiera | Lista vehículos (filtros: estado, search) |
| GET | `/fleet/vehicles/:id` | Cualquiera | Detalle de vehículo |
| POST | `/fleet/vehicles` | Admin | Crea vehículo |
| PATCH | `/fleet/vehicles/:id` | Admin | Actualiza vehículo |
| DELETE | `/fleet/vehicles/:id` | Admin | Elimina vehículo |
| POST | `/fleet/vehicles/:id/assign` | Admin | Asigna conductor al vehículo |
| POST | `/fleet/vehicles/:id/unassign` | Admin | Desasigna conductor |

#### Documentos de vehículo

| Método | Path | Rol requerido | Descripción |
|--------|------|--------------|-------------|
| GET | `/fleet/vehicles/:vehicleId/documents` | Cualquiera | Documentos del vehículo |
| POST | `/fleet/vehicles/:vehicleId/documents` | Admin | Agrega documento |
| PATCH | `/fleet/documents/:id` | Admin | Edita documento |
| DELETE | `/fleet/documents/:id` | Admin | Elimina documento |

#### Mantenimientos

| Método | Path | Rol requerido | Descripción |
|--------|------|--------------|-------------|
| GET | `/fleet/vehicles/:vehicleId/maintenances` | Cualquiera | Historial de mantenimientos |
| POST | `/fleet/vehicles/:vehicleId/maintenances` | Admin | Registra mantenimiento |
| PATCH | `/fleet/maintenances/:id` | Admin | Edita mantenimiento |

#### Conductores

| Método | Path | Rol requerido | Descripción |
|--------|------|--------------|-------------|
| GET | `/fleet/drivers` | Cualquiera | Lista perfiles de conductores |
| POST | `/fleet/drivers` | Admin | Crea conductor (crea user + profile en transacción) |
| PUT | `/fleet/drivers/:userId` | Admin | Crea o actualiza perfil de conductor |

#### Documentos de conductor

| Método | Path | Rol requerido | Descripción |
|--------|------|--------------|-------------|
| GET | `/fleet/drivers/:driverProfileId/documents` | Cualquiera | Documentos del conductor |
| POST | `/fleet/drivers/:driverProfileId/documents` | Admin | Agrega documento |
| DELETE | `/fleet/drivers/documents/:docId` | Admin | Elimina documento |

#### Alertas

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/fleet/alerts?days=30` | Vencimientos próximos (vehículos + conductores) |

---

## 6. Backend — Servicios

### `AuthService`
Maneja el ciclo completo de autenticación. Genera tokens JWT con expiración corta (15m) y refresh tokens de larga duración (7d) con rotación de familia para detectar tokens robados. Los usuarios creados por admin se marcan con `must_change_password = true`.

### `TripService`
Gestiona dos tipos de viajes:
- **GPS en tiempo real:** El conductor inicia el viaje y el sistema rastrea posiciones.
- **Programados:** El admin agenda viajes con tipo `ida_vuelta` (el conductor va y regresa a buscar pasajeros, hay ventana libre entre viajes) o `espera` (el conductor espera en destino, el sistema calcula cuándo regresa).

Incluye detección de conflictos de horarios usando ventanas de ocupación y validación de capacidad de vehículo contra cantidad de pasajeros.

### `PositionService`
Procesa cada posición GPS recibida: calcula la distancia acumulada usando la fórmula de Haversine, determina si el vehículo se desvió de la ruta (distancia al segmento de línea más cercano), y emite el evento por WebSocket para actualizar el mapa en tiempo real.

### `VehicleService`
CRUD de vehículos más asignación de conductores (registra en `vehicle_assignments`). El dashboard calcula estadísticas de estado de la flota y documentos/mantenimientos próximos a vencer.

### `AlertService`
Consulta vencimientos de `vehicle_documents` y `driver_documents` en los próximos N días (default: 30) y los devuelve ordenados por urgencia.

### `DriverProfileService`
Permite crear un conductor creando simultáneamente el usuario y su perfil en una transacción. También permite hacer upsert del perfil para usuarios ya existentes.

---

## 7. Frontend — Secciones

### `/login` — Login
Formulario de acceso. Si el usuario tiene `mustChangePassword = true`, redirige a `/change-password` después del login.

### `/dashboard` — Dashboard principal
Panel de resumen para el admin. Muestra accesos directos a las secciones principales.

### `/users` — Gestión de usuarios
**Solo admin.** Lista todos los usuarios del sistema con su rol y fecha de creación.
- **Nuevo usuario:** Crea un usuario con email, contraseña auto-generada y rol. Muestra las credenciales para compartir.
- **Perfil conductor:** Para usuarios con rol `driver`, permite completar el perfil (nombre, apellido, licencia, vencimiento, teléfono, curso de puerto).

### `/fleet` — Dashboard de flota
Muestra:
- Estadísticas: total de vehículos, disponibles, en uso, en mantenimiento.
- Panel de alertas: documentos y licencias próximos a vencer (organizados por nivel de urgencia: rojo < 7 días, amarillo < 30 días).

### `/fleet/vehicles` — Vehículos
Lista de vehículos con patente, marca, modelo, estado, capacidad y conductor asignado.
- **Nuevo vehículo:** Formulario completo (marca, modelo, patente, año, VIN, tipo, color, capacidad, estado, kilometraje, notas).
- **Ir a documentos:** Acceso directo al detalle del vehículo.

### `/fleet/vehicles/:id` — Detalle de vehículo
Muestra toda la información del vehículo y permite:
- **Asignar/desasignar conductor:** Selector de conductores con perfil activo.
- **Tab Documentación:** CRUD de documentos (seguro, VTV, habilitación turística, matafuego con N° de serie, otro). Muestra días restantes con semáforo de colores.
- **Tab Mantenimiento:** CRUD de historial de mantenimientos con próximo service por km o fecha.

### `/fleet/drivers` — Conductores
Lista de conductores con nombre, email, licencia, vencimiento y teléfono. Permite editar el perfil de cualquier conductor. Los conductores se crean desde la sección **Usuarios**.

### `/trips` — Viajes
Lista de todos los viajes con ruta, tipo, horario, pasajeros, disponibilidad del conductor y estado.
- **Nuevo viaje:**
  - **Modo GPS:** El conductor inicia el viaje ahora con seguimiento en tiempo real.
  - **Modo Programado:** Se agenda un viaje futuro con tipo `ida_vuelta` o `espera`, horarios, cantidad de pasajeros y vehículo (filtrado por capacidad).
- **Editar viaje programado:** Modifica horarios y datos de un viaje en estado `scheduled`.
- **Completar / Cancelar:** Acciones sobre viajes activos.
- **Simulador:** Acceso al simulador GPS para viajes activos.

### `/trips/:id/history` — Historial de viaje
Mapa con el recorrido completo del viaje, distancia total, posiciones con detección de desvíos.

### `/map` — Mapa en vivo
Mapa Leaflet con las posiciones en tiempo real de todos los viajes activos. Se actualiza automáticamente vía WebSocket.

### `/routes` — Rutas
CRUD de rutas con editor de waypoints en mapa. Cada ruta tiene origen, destino, duración estimada y puntos intermedios.

### `/simulator/:tripId` — Simulador GPS
Herramienta de testing que simula el movimiento de un vehículo a lo largo de la ruta, enviando posiciones GPS automáticamente al backend.

### `/driver` — Vista del conductor
Panel simplificado para conductores. Muestra sus viajes activos y permite iniciar/completar viajes desde el móvil.

---

## 8. Frontend — Servicios API

Todos los servicios usan `HttpClient` con `map(res => res.data)` para extraer el payload de la respuesta.

### `UserService` (`core/api/user.service.ts`)
```typescript
getUsers(): Observable<UserDto[]>
createUser(input: CreateUserInput): Observable<UserDto>
```

### `FleetService` (`core/api/fleet.service.ts`)
```typescript
// Vehículos
getVehicles(filters?: { estado?, search? }): Observable<VehicleDto[]>
createVehicle(data): Observable<VehicleDto>
updateVehicle(id, data): Observable<VehicleDto>
deleteVehicle(id): Observable<void>
getDashboard(): Observable<FleetDashboardDto>
assignDriver(vehicleId, driverId): Observable<void>
unassignDriver(vehicleId): Observable<void>

// Documentos de vehículo
getDocuments(vehicleId): Observable<VehicleDocumentDto[]>
createDocument(vehicleId, data): Observable<VehicleDocumentDto>
updateDocument(id, data): Observable<VehicleDocumentDto>
deleteDocument(id): Observable<void>

// Mantenimientos
getMaintenances(vehicleId): Observable<MaintenanceDto[]>
createMaintenance(vehicleId, data): Observable<MaintenanceDto>
updateMaintenance(id, data): Observable<MaintenanceDto>

// Conductores
getDriverProfiles(): Observable<DriverProfileDto[]>
createDriver(data): Observable<{ driver: DriverProfileDto; password: string }>
upsertDriverProfile(userId, data): Observable<DriverProfileDto>

// Documentos de conductor
getDriverDocuments(driverProfileId): Observable<DriverDocumentDto[]>
createDriverDocument(driverProfileId, data): Observable<DriverDocumentDto>
deleteDriverDocument(docId): Observable<void>

// Alertas
getAlerts(days?: number): Observable<AlertItemDto[]>
```

### `TripService` (`core/api/trip.service.ts`)
```typescript
getTrips(): Observable<TripDto[]>
startTrip(routeId, driverId?, vehicleId?, cantidadPasajeros?): Observable<TripDto>
completeTrip(id): Observable<TripDto>
cancelTrip(id): Observable<TripDto>
scheduleTrip(input: ScheduleTripInput): Observable<TripDto>
rescheduleTrip(id, input: UpdateScheduleTripInput): Observable<TripDto>
getMyTrips(): Observable<TripDto[]>
getTripPositions(tripId): Observable<{ positions, stats }>
```

### `RouteService` (`core/api/route.service.ts`)
```typescript
getRoutes(): Observable<RouteDto[]>
getRoute(id): Observable<RouteDto>
createRoute(input): Observable<RouteDto>
updateRoute(id, input): Observable<RouteDto>
deleteRoute(id): Observable<void>
```

### `PositionService` (`core/api/position.service.ts`)
```typescript
sendPosition(tripId, body): Observable<void>
getLatestPerActiveTrip(): Observable<PositionDto[]>
```

---

## 9. Autenticación y seguridad

### Flujo de autenticación

```
1. POST /auth/login
   → Valida email + password (bcrypt)
   → Genera accessToken (JWT, 15m) + refreshToken (opaco, 7d)
   → Guarda hash del refreshToken en DB con family UUID

2. Requests autenticados
   → Header: Authorization: Bearer <accessToken>
   → Middleware authenticate() verifica JWT y adjunta req.user

3. POST /auth/refresh
   → Busca refreshToken en DB por hash
   → Valida que no esté usado ni expirado
   → Marca el token como usado
   → Genera nuevo accessToken + nuevo refreshToken (misma family)
   → Si detecta reuso (token ya usado), invalida toda la family

4. POST /auth/logout
   → Marca el refreshToken como usado e inválido
```

### Roles

| Rol | Acceso |
|-----|--------|
| `admin` | Acceso total a todos los endpoints |
| `driver` | Puede iniciar/completar sus propios viajes, enviar posiciones GPS |
| `mechanic` | Acceso de lectura a flota |
| `administration` | Acceso de lectura general |
| `sales` | Acceso de lectura general |

### Seguridad adicional
- **Helmet:** Headers HTTP de seguridad (CSP, HSTS, etc.)
- **CORS:** Whitelist de orígenes permitidos (localhost, Railway, túneles)
- **Zod:** Validación estricta de todos los bodies antes de llegar al controller
- **bcryptjs:** Hashing de contraseñas con salt rounds 10-12
- **must_change_password:** Usuarios creados por admin deben cambiar contraseña en el primer acceso

---

## 10. Paquetes

### Backend

| Paquete | Versión | Uso |
|---------|---------|-----|
| express | ^4.18.2 | Framework HTTP |
| pg | ^8.11.3 | Driver PostgreSQL |
| jsonwebtoken | ^9.0.2 | Generación y verificación de JWT |
| bcryptjs | ^2.4.3 | Hashing de contraseñas |
| socket.io | ^4.8.3 | WebSocket para GPS en tiempo real |
| ioredis | ^5.3.2 | Cliente Redis (caché) |
| zod | ^3.22.4 | Validación de schemas en rutas |
| helmet | ^7.1.0 | Headers de seguridad HTTP |
| cors | ^2.8.5 | Control de CORS |
| cookie-parser | ^1.4.6 | Parseo de cookies |
| nodemailer | ^6.9.8 | Envío de emails |
| resend | ^6.9.4 | API de email transaccional |
| dotenv | ^17.3.1 | Variables de entorno |
| typescript | ^5.3.3 | Lenguaje |
| ts-node-dev | ^2.0.0 | Dev server con hot reload |
| jest + ts-jest | ^29.7.0 | Testing unitario |
| supertest | ^6.3.4 | Testing de endpoints HTTP |

### Frontend

| Paquete | Versión | Uso |
|---------|---------|-----|
| @angular/core | ^21.2.0 | Framework |
| @angular/router | ^21.2.0 | Routing con lazy loading |
| @angular/forms | ^21.2.0 | Formularios reactivos |
| @angular/service-worker | ^21.2.0 | PWA (caché offline) |
| primeng | ^21.1.3 | Componentes UI (tablas, dialogs, inputs, etc.) |
| @primeuix/themes | ^2.0.3 | Sistema de temas PrimeNG |
| primeicons | ^7.0.0 | Iconos |
| leaflet | ^1.9.4 | Mapas interactivos |
| socket.io-client | ^4.7.5 | Conexión WebSocket al backend |
| tailwindcss | ^4.2.2 | Utilidades CSS |
| rxjs | ~7.8.0 | Programación reactiva (Observables) |
| zone.js | ~0.15.0 | Change detection Angular |
| @angular/cli | ^21.2.1 | Toolchain de build |
| vitest | ^4.0.8 | Testing unitario frontend |

---

*Última actualización: Marzo 2026*
