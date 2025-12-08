# 🎓 ClassTrack

> **Complete IoT-Enabled Attendance and Air Quality Monitoring System with Unified Configuration**

ClassTrack is a modern, full-stack solution that combines fingerprint-based attendance tracking with real-time environmental monitoring using ESP32 IoT devices. Now featuring **unified deployment** where both frontend and backend run on a single port.

## ✨ Features

### 📊 Dashboard

- Real-time attendance statistics and trends
- Live air quality monitoring across all classrooms
- Device health and status overview
- Interactive charts and visualizations
- Alert notifications for threshold violations

### 👥 Student Management

- Complete student database with fingerprint enrollment
- Class organization and management
- Individual attendance history tracking
- Bulk import/export capabilities
- Search and filter functionality

### ✅ Attendance Tracking

- Fingerprint-based authentication via ESP32 devices
- Automatic status determination (Present/Late/Absent)
- Real-time synchronization
- Historical attendance records
- Detailed reliability metrics
- Weekly and monthly attendance reports

### 🌡️ Air Quality Monitoring

- PM2.5 particulate matter tracking
- CO₂ concentration monitoring
- Temperature and humidity sensing
- Room-by-room environmental comparison
- Automatic threshold alerts
## 🔌 API Endpoints

> ℹ️ Platform admins can pass `?schoolId=...` to scope any tenant-aware endpoint. School admins and teachers are automatically restricted to their school/class assignments.

### Authentication

- `POST /api/auth/signup` - Onboard a new school admin + tenant
- `POST /api/auth/login` - Login and receive scoped JWT

### Dashboard

- `GET /api/dashboard/stats` - Overview statistics (global or per-school)
- `GET /api/dashboard/attendance/weekly` - Weekly attendance trends
- `GET /api/dashboard/airquality/hourly` - Hourly AQ snapshots
- `GET /api/dashboard/classrooms` - Classroom occupancy + environment

### Students

- `GET /api/students` - List students (filters: class, classroom, search)
- `POST /api/students` - Create student (honors school & classroom scope)
- `GET /api/students/:id` - Student detail with classroom reference
- `PUT /api/students/:id` - Update student metadata/fingerprint
- `DELETE /api/students/:id` - Remove student

### Classrooms

- `GET /api/classrooms` - List classrooms (teachers see assigned ones)
- `POST /api/classrooms` - Create classroom (school admin)
- `GET /api/classrooms/:id` - Detail view (students, devices, teachers)
- `PATCH /api/classrooms/:id` - Update classroom metadata
- `DELETE /api/classrooms/:id` - Delete classroom
- `POST /api/classrooms/:id/teachers` - Assign teacher to classroom
- `DELETE /api/classrooms/:id/teachers/:teacherId` - Remove assignment

### Attendance

- `GET /api/attendance` - Filterable attendance feed (date/class/classroom)
- `POST /api/attendance` - Record attendance via dashboard or IoT proxy
- `POST /api/attendance/device` - Record via device JWT
- `GET /api/attendance/stats` - Aggregated stats for scoped school/classes
- `GET /api/attendance/student/:studentId` - Student history

### Devices

- `GET /api/devices` - List school devices (teachers limited to assigned rooms)
- `POST /api/devices` - Register device with school/classroom mapping
- `GET /api/devices/:id` - Device detail (attendance + AQ history)
- `PUT /api/devices/:id` - Update metadata / status
- `DELETE /api/devices/:id` - Remove device
- `POST /api/devices/status` - Device heartbeat + health updates
- `POST /api/devices/provision` - Generate device runtime JWT tied to school

### Air Quality

- `GET /api/airquality` - Readings feed (room/classroom filters)
- `POST /api/airquality` - Record reading via authenticated user
- `POST /api/airquality/device` - Record via device JWT
- `GET /api/airquality/rooms` - Latest + 24h averages per room
- `GET /api/airquality/stats` - Aggregate stats for scoped school

│   │   ├── middleware/  # Auth & validation
│   │   └── config/      # Database configuration
│   └── index.ts         # ⭐ Unified server (API + Frontend)
│
└── esp32-example.ino    # IoT device code
```

## 🛠️ Technology Stack

### Frontend

### Platform Admin

- `GET /api/admin/overview` - Global KPIs + latest logs
- `GET /api/admin/users` / `PATCH` / `DELETE` - Manage any user + role
- `GET /api/admin/schools` / `POST` / `PATCH` - Manage tenants
- `GET /api/admin/logs` - Review `SystemLog` timeline

- **Framework:** Next.js 16 (React 19)
- **Styling:** Tailwind CSS 4
- **UI Components:** Radix UI
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod
- **State Management:** React Context
- **Type Safety:** TypeScript

### Backend

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** JWT with bcrypt
- **Real-time:** WebSocket (ws library)
- **Validation:** express-validator
- **Type Safety:** TypeScript

### IoT/Hardware

- **Microcontroller:** ESP32
- **Fingerprint:** R307/AS608 sensors
- **Air Quality:** PMS5003 (PM2.5), MH-Z19 (CO₂)
- **Environment:** BME280 (Temperature/Humidity)
- **Communication:** WiFi + WebSocket

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher
- npm or pnpm package manager
- ESP32 development environment (optional)

### One-Command Setup (Recommended)

```bash
# 1. Clone and navigate
git clone <repository-url>
cd ClassTrack

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your database credentials and JWT secret

# 3. Complete setup (installs dependencies, migrates DB, seeds data)
npm run setup

# 4. Start development (runs both frontend and backend)
npm run dev
```

### Access Points

**Development Mode:**

- 🌐 Frontend: http://localhost:3000 (Next.js dev server with hot reload)
- 🔌 Backend API: http://localhost:5000/api
- 📡 WebSocket: ws://localhost:8080 (ESP32 devices)
- ❤️ Health Check: http://localhost:5000/health

**Production Mode:**

```bash
npm run build    # Build both client and server
npm start        # Unified server on port 5000
```

- 🚀 Application: http://localhost:5000 (everything served from one port)
- 🔌 Backend API: http://localhost:5000/api
- 📡 WebSocket: ws://localhost:8080

### Default Login Credentials

- **Platform Owner:** `platform@classtrack.com` / `platform123`
- **Demo School Admin:** `admin@demo.school` / `admin123`
- **Lead Teacher:** `teacher@demo.school` / `teacher123`

## 🔧 Configuration

### Unified Environment Variables (Root `.env`)

ClassTrack uses a **single `.env` file** in the root directory for all configuration:

```env
# ========================================
# Application Settings
# ========================================
APP_NAME="ClassTrack"
APP_VERSION="1.0.0"

# ========================================
# Server Configuration
# ========================================
PORT=5000                    # Unified port (API + Frontend in production)
NODE_ENV=development         # development | production

# ========================================
# Database (PostgreSQL)
# ========================================
DATABASE_URL="postgresql://user:password@localhost:5432/classtrack?schema=public"

# ========================================
# Authentication
# ========================================
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_EXPIRES_IN="7d"

# ========================================
# WebSocket (ESP32 Devices)
# ========================================
WS_PORT=8080

# ========================================
# CORS
# ========================================
CORS_ORIGIN="*"             # Allows all origins (needed for ESP32)

# ========================================
# API Configuration
# ========================================
API_PREFIX="/api"

# ========================================
# Client Configuration (NEXT_PUBLIC_*)
# ========================================
NEXT_PUBLIC_API_URL="/api"                # Relative path in production
NEXT_PUBLIC_WS_URL="ws://localhost:8080"  # WebSocket endpoint
```

**📖 See [CONFIG.md](./CONFIG.md) for detailed configuration guide**

## 📦 NPM Scripts

All commands run from the root directory:

```bash
# Development
npm run dev              # Run both client and server concurrently
npm run dev:server       # Run server only (port 5000)
npm run dev:client       # Run client only (port 3000)

# Production
npm run build            # Build both client and server
npm start               # Start unified production server

# Setup & Installation
npm run install:all      # Install all dependencies
npm run setup           # Complete setup (install, migrate, seed)

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio GUI
npm run prisma:seed      # Seed database with sample data
```

## 🎯 Key Features of Unified Configuration

✅ **Single Port in Development & Production** - Port 5000 for everything!  
✅ **Hot Reload in Development** - Via proxy to Next.js dev server (port 3000)  
✅ **Shared Environment** - One `.env` file for all configuration  
✅ **No CORS Issues** - Same origin in both modes  
✅ **Easy ESP32 Integration** - Dedicated WebSocket port (8080) for IoT devices  
✅ **Production Ready** - Express serves built Next.js app efficiently  
✅ **Reduced Complexity** - Fewer configuration files to manage  
✅ **Better Security** - Centralized secret management

## 📡 ESP32 Integration

### Hardware Setup

1. Connect fingerprint sensor (R307/AS608) to ESP32
2. Connect environmental sensors:
   - BME280 (Temperature/Humidity)
   - PMS5003 (PM2.5)
   - MH-Z19 (CO₂)
3. Power the ESP32 with appropriate power supply (5V/1A minimum)

### Software Setup

1. Install Arduino IDE with ESP32 board support
2. Install required libraries (see `Server/esp32-example.ino`)
3. Configure WiFi credentials and server IP in code
4. Upload code to ESP32
5. Register device in the web interface

### Communication Protocol

ESP32 devices communicate via WebSocket (port 8080):

- **Attendance Events:** Fingerprint scan results
- **Air Quality Data:** Environmental sensor readings (every 5 minutes)
- **Device Status:** Battery, signal strength, uptime updates

**📖 Complete ESP32 guide:** [Server/esp32-example.ino](./Server/esp32-example.ino)

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login and get JWT token

### Dashboard

- `GET /api/dashboard/stats` - Overview statistics
- `GET /api/dashboard/attendance/weekly` - Weekly attendance trends
- `GET /api/dashboard/airquality/hourly` - Hourly air quality data
- `GET /api/dashboard/classrooms` - Classroom occupancy

### Students

- `GET /api/students` - List all students (paginated)
- `POST /api/students` - Create new student
- `GET /api/students/:id` - Get student details
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Attendance

- `GET /api/attendance` - Get attendance records (filtered)
- `POST /api/attendance` - Record attendance (ESP32)
- `GET /api/attendance/stats` - Attendance statistics
- `GET /api/attendance/student/:id` - Student attendance history

### Devices

- `GET /api/devices` - List all devices
- `POST /api/devices` - Register new device
- `GET /api/devices/:id` - Get device details
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device
- `POST /api/devices/status` - Update device status (ESP32)

### Air Quality

- `GET /api/airquality` - Get readings (paginated)
- `POST /api/airquality` - Record new reading (ESP32)
- `GET /api/airquality/rooms` - Summary by room
- `GET /api/airquality/stats` - Air quality statistics

### Alerts

- `GET /api/alerts` - List alerts (filtered by severity)
- `PATCH /api/alerts/:id/resolve` - Resolve an alert
- `DELETE /api/alerts/:id` - Delete alert

### Reports

- `GET /api/reports/attendance` - Generate attendance report
- `GET /api/reports/airquality` - Generate air quality report
- `GET /api/reports/devices` - Generate device health report

**📖 Complete API documentation:** [Server/README.md](./Server/README.md)  
**🧪 API test collection:** [Server/API-TESTS.http](./Server/API-TESTS.http)

## 📊 Database Schema

### Core Models

**School** – Tenant metadata

- id, name, code, timezone, status, contact info
- Owns classrooms, students, devices, alerts, logs

**User** – Platform admins, school admins, teachers, staff

- id, email, password, role, optional schoolId
- Teachers map to classrooms via `TeacherClassAssignment`

**Classroom** – Grade/section container within a school

- id, name, grade, section, capacity, schoolId
- Connected to students, devices, air quality readings, attendance

**TeacherClassAssignment** – Joins teachers to classrooms

- id, teacherId, classroomId, schoolId
- Powers teacher-level data isolation

**Student** – Learners tied to a school/classroom

- id, studentId, name, class label, fingerprint data, schoolId, classroomId
- Linked to attendance history

**Attendance** – Daily check-ins

- id, studentId, schoolId, classroomId, deviceId, teacherId
- Auto-determines status (Present/Late/Absent) with reliability score

**Device** – ESP32 registry (fingerprint + multi-sensor)

- id, deviceId, schoolId, classroomId, type, status, battery, signal, firmware
- Tracks attendance and air quality contributions

**AirQuality** – Environmental data snapshots

- id, deviceId, schoolId, classroomId, room, pm25, co2, temperature, humidity, timestamp
- Generates alerts on threshold breaches

**Alert** – System notifications

- id, schoolId, type, severity, room, metric, threshold, resolved flag

**SystemLog** – Platform audit/events

- id, schoolId, actorId, actorRole, action, metadata JSON, timestamp

**View complete schema:** [Server/prisma/schema.prisma](./Server/prisma/schema.prisma)

## 🔒 Security Features

- ✅ **JWT Authentication** - Token-based with configurable expiration
- ✅ **Password Hashing** - bcrypt with salt rounds
- ✅ **API Protection** - All protected routes require valid JWT
- ✅ **CORS Configuration** - Configurable origin restrictions
- ✅ **Input Validation** - express-validator on all inputs
- ✅ **SQL Injection Protection** - Prisma ORM with parameterized queries
- ✅ **Type Safety** - Full TypeScript coverage
- ✅ **Environment Isolation** - Separate dev/production configs

## 🚢 Deployment

### Production Build

```bash
# From root directory
npm run build    # Builds both client and server
npm start        # Starts unified server on port 5000
```

### Recommended Platforms

**Full Stack (Backend + Database):**

- **Railway** - Easy PostgreSQL + Node.js deployment (recommended)
- **Render** - Free tier with managed database
- **DigitalOcean App Platform** - Scalable with managed DB
- **Heroku** - Simple deployment with add-ons

**Frontend Only (if separate):**

- **Vercel** - Optimized for Next.js (recommended)
- **Netlify** - Easy deployment with CDN
- **Cloudflare Pages** - Global edge network

### Environment Variables for Production

```env
# Update these for production
NODE_ENV=production
PORT=5000
DATABASE_URL="postgresql://prod-user:password@prod-host:5432/classtrack?ssl=true"
JWT_SECRET="<generate-64-char-random-string>"
CORS_ORIGIN="https://your-domain.com"  # Or "*" for ESP32 access
```

Generate secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 🐛 Troubleshooting

### Backend Issues

**Backend won't start:**

```bash
# Check PostgreSQL is running
pg_isready

# Verify DATABASE_URL
echo $DATABASE_URL

# Regenerate Prisma client
npm run prisma:generate
```

**Database connection failed:**

- Ensure PostgreSQL is running
- Check DATABASE_URL format in .env
- Verify database exists: `psql -l`
- Create database: `createdb classtrack`

**Port already in use:**

```powershell
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Or change PORT in .env
```

### Frontend Issues

**Frontend can't connect to API:**

- Verify backend is running: http://localhost:5000/health
- Check `NEXT_PUBLIC_API_URL` in .env
- Clear browser cache and restart dev server

**Build fails:**

```bash
# Clear Next.js cache
cd Client
rm -rf .next
pnpm build
```

### ESP32 Issues

**Device can't connect:**

- Verify WiFi credentials in code
- Check server IP address is correct
- Monitor serial output for errors
- Ensure WebSocket port 8080 is open

**Fingerprint not detected:**

- Check sensor wiring (TX/RX, VCC, GND)
- Verify baud rate (57600 for R307)
- Test sensor with enrollment example

**Data not appearing in dashboard:**

- Verify device is registered in web interface
- Check WebSocket connection in browser console
- Confirm deviceId matches in code and database

See [Server/SETUP.md](./Server/SETUP.md#troubleshooting) for detailed troubleshooting.

## 📚 Additional Documentation

- **[CONFIG.md](./CONFIG.md)** - ⭐ Unified configuration and deployment guide
- **[Server/SETUP.md](./Server/SETUP.md)** - Detailed installation instructions
- **[Server/IMPLEMENTATION.md](./Server/IMPLEMENTATION.md)** - System architecture and design
- **[Server/README.md](./Server/README.md)** - Backend API documentation
- **[Server/API-TESTS.http](./Server/API-TESTS.http)** - REST Client test collection
- **[Server/esp32-example.ino](./Server/esp32-example.ino)** - Arduino code for ESP32 devices

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

ISC License - See LICENSE file for details

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Prisma team for the excellent ORM
- Radix UI for accessible components
- ESP32 community for hardware support
- Express.js for robust backend framework

---

**Built with ❤️ for modern educational institutions**

**Questions?** Open an issue on GitHub or check the documentation files.
