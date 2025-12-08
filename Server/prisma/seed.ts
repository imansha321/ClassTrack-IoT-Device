import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create school tenant
  const school = await prisma.school.upsert({
    where: { code: 'demo-school-01' },
    update: {},
    create: {
      name: 'Demo School',
      code: 'demo-school-01',
      contactEmail: 'contact@demo.school',
      contactPhone: '+971-500-0000',
      address: '123 Demo Street, Dubai',
      timezone: 'Asia/Dubai',
    },
  });
  console.log('✓ Ensured school tenant:', school.name);

  // Create users (platform admin, school admin, teacher)
  const [platformAdminPassword, schoolAdminPassword, teacherPassword] = await Promise.all([
    bcrypt.hash('platform123', 10),
    bcrypt.hash('admin123', 10),
    bcrypt.hash('teacher123', 10),
  ]);

  const platformAdmin = await prisma.user.upsert({
    where: { email: 'platform@classtrack.com' },
    update: {},
    create: {
      email: 'platform@classtrack.com',
      password: platformAdminPassword,
      fullName: 'Platform Owner',
      role: UserRole.PLATFORM_ADMIN,
    },
  });
  console.log('✓ Platform admin:', platformAdmin.email);

  const schoolAdmin = await prisma.user.upsert({
    where: { email: 'admin@demo.school' },
    update: {},
    create: {
      email: 'admin@demo.school',
      password: schoolAdminPassword,
      fullName: 'Demo School Admin',
      schoolId: school.id,
      role: UserRole.SCHOOL_ADMIN,
    },
  });
  console.log('✓ School admin:', schoolAdmin.email);

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@demo.school' },
    update: {},
    create: {
      email: 'teacher@demo.school',
      password: teacherPassword,
      fullName: 'Class Teacher',
      schoolId: school.id,
      role: UserRole.TEACHER,
    },
  });
  console.log('✓ Teacher user:', teacher.email);

  // Create classrooms
  const classroomDefs = [
    { name: 'Room 101', grade: '10', section: 'A', capacity: 40 },
    { name: 'Room 102', grade: '10', section: 'B', capacity: 42 },
    { name: 'Room 103', grade: '11', section: 'A', capacity: 38 },
  ];

  const classrooms = [] as Awaited<ReturnType<typeof prisma.classroom.create>>[];
  for (const def of classroomDefs) {
    const classroom = await prisma.classroom.create({
      data: { ...def, schoolId: school.id },
    });
    classrooms.push(classroom);
  }
  console.log(`✓ Created ${classrooms.length} classrooms`);

  await prisma.teacherClassAssignment.createMany({
    data: classrooms.slice(0, 2).map((classroom) => ({
      teacherId: teacher.id,
      classroomId: classroom.id,
      schoolId: school.id,
    })),
    skipDuplicates: true,
  });
  console.log('✓ Linked teacher to classrooms');

  // Create students
  const students = [];
  const classes = ['10-A', '10-B', '10-C'];
  const names = [
    'Ahmed Hassan', 'Fatima Ali', 'Mohammad Khan', 'Sara Hussein',
    'Omar Abdullah', 'Layla Ahmed', 'Zara Ali', 'Hassan Ahmed',
    'Aisha Khan', 'Yusuf Ibrahim', 'Mariam Said', 'Ali Rashid'
  ];

  for (let i = 0; i < names.length; i++) {
    const classroom = classrooms[i % classrooms.length];
    const student = await prisma.student.create({
      data: {
        studentId: `STU${String(i + 1).padStart(4, '0')}`,
        name: names[i],
        class: classes[i % classes.length],
        fingerprintData: `FP_${i + 1}_DATA`,
        schoolId: school.id,
        classroomId: classroom.id,
      },
    });
    students.push(student);
  }
  console.log(`✓ Created ${students.length} students`);

  // Create devices
  const devices = [
    { deviceId: 'ESP32-101', name: 'Room 101 Sensor', type: 'FINGERPRINT_SCANNER', location: 'Room 101', battery: 92, signal: 85 },
    { deviceId: 'ESP32-102', name: 'Room 102 Sensor', type: 'MULTI_SENSOR', location: 'Room 102', battery: 87, signal: 78 },
    { deviceId: 'ESP32-103', name: 'Room 103 Sensor', type: 'FINGERPRINT_SCANNER', location: 'Room 103', battery: 76, signal: 91 },
    { deviceId: 'ESP32-104', name: 'Room 104 Sensor', type: 'MULTI_SENSOR', location: 'Room 104', battery: 68, signal: 72 },
    { deviceId: 'ESP32-LAB', name: 'Lab Sensor', type: 'MULTI_SENSOR', location: 'Lab', battery: 0, signal: 0, status: 'OFFLINE' },
  ];

  const createdDevices = [];
  for (const deviceData of devices) {
    const device = await prisma.device.create({
      data: {
        ...deviceData,
        uptime: deviceData.status === 'OFFLINE' ? null : '45 days',
        lastSeen: deviceData.status === 'OFFLINE' ? new Date(Date.now() - 2 * 60 * 60 * 1000) : new Date(),
        schoolId: school.id,
        classroomId: classrooms[createdDevices.length % classrooms.length].id,
      },
    });
    createdDevices.push(device);
  }
  console.log(`✓ Created ${createdDevices.length} devices`);

  // Create attendance records for today
  const today = new Date();
  today.setHours(8, 0, 0, 0);

  for (let i = 0; i < students.length; i++) {
    const randomMinutes = Math.floor(Math.random() * 60);
    const checkInTime = new Date(today.getTime() + randomMinutes * 60000);
    const status = randomMinutes < 30 ? 'PRESENT' : randomMinutes < 45 ? 'LATE' : 'ABSENT';
    
    if (status !== 'ABSENT') {
      await prisma.attendance.create({
        data: {
          studentId: students[i].id,
          schoolId: school.id,
          classroomId: students[i].classroomId,
          checkInTime,
          status,
          fingerprintMatch: true,
          reliability: 95 + Math.floor(Math.random() * 5),
          deviceId: createdDevices[i % 4].id,
        },
      });
    }
  }
  console.log('✓ Created attendance records');

  // Create air quality readings
  const rooms = ['Room 101', 'Room 102', 'Room 103', 'Room 104', 'Lab'];
  for (let i = 0; i < 5; i++) {
    for (let hour = 8; hour <= 15; hour++) {
      const timestamp = new Date();
      timestamp.setHours(hour, 0, 0, 0);
      
      await prisma.airQuality.create({
        data: {
          deviceId: createdDevices[i % createdDevices.length].id,
          schoolId: school.id,
          classroomId: classrooms[i % classrooms.length].id,
          room: rooms[i],
          pm25: 20 + Math.random() * 45,
          co2: 400 + Math.floor(Math.random() * 450),
          temperature: 22 + Math.random() * 3,
          humidity: 40 + Math.random() * 15,
          timestamp,
        },
      });
    }
  }
  console.log('✓ Created air quality readings');

  // Create alerts
  const alerts = [
    {
      type: 'AIR_QUALITY',
      severity: 'WARNING',
      message: 'Room 102 CO₂ level exceeded threshold (780 ppm)',
      room: 'Room 102',
      metric: 'CO₂',
      value: '780 ppm',
      threshold: '750 ppm',
    },
    {
      type: 'DEVICE',
      severity: 'INFO',
      message: 'Device ESP32-LAB updated successfully',
    },
    {
      type: 'AIR_QUALITY',
      severity: 'CRITICAL',
      message: 'Lab CO₂ level critical (850 ppm)',
      room: 'Lab',
      metric: 'CO₂',
      value: '850 ppm',
      threshold: '800 ppm',
    },
  ];

  for (const alertData of alerts) {
    await prisma.alert.create({ data: { ...alertData, schoolId: school.id } });
  }
  console.log('✓ Created alerts');

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
