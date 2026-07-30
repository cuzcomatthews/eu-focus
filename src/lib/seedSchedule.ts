import { prisma } from './prisma';

const WEEKLY_SCHEDULE = [
  // Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0
  // Normal work day (Mon, Thu, Fri, Sat, Sun) — 8:00-23:00 with breaks
  ...[1, 4, 5, 6, 0].flatMap(day => [
    { dayOfWeek: day, startTime: '08:00', endTime: '11:00', category: 'work', label: 'Trabajo' },
    { dayOfWeek: day, startTime: '11:00', endTime: '11:30', category: 'ocio', label: 'Descanso' },
    { dayOfWeek: day, startTime: '11:30', endTime: '13:00', category: 'work', label: 'Trabajo' },
    { dayOfWeek: day, startTime: '13:00', endTime: '14:00', category: 'comida', label: 'Almuerzo' },
    { dayOfWeek: day, startTime: '14:00', endTime: '16:00', category: 'work', label: 'Trabajo' },
    { dayOfWeek: day, startTime: '16:00', endTime: '16:30', category: 'ocio', label: 'Descanso' },
    { dayOfWeek: day, startTime: '16:30', endTime: '18:00', category: 'work', label: 'Trabajo' },
    { dayOfWeek: day, startTime: '18:00', endTime: '20:00', category: 'ocio', label: 'Cena + Ocio' },
    { dayOfWeek: day, startTime: '20:00', endTime: '23:00', category: 'work', label: 'Trabajo' },
  ]),
  // Tuesday — class 14:00-17:00 replaces work block
  ...[2].flatMap(day => [
    { dayOfWeek: day, startTime: '08:00', endTime: '11:00', category: 'work', label: 'Trabajo' },
    { dayOfWeek: day, startTime: '11:00', endTime: '11:30', category: 'ocio', label: 'Descanso' },
    { dayOfWeek: day, startTime: '11:30', endTime: '13:00', category: 'work', label: 'Trabajo' },
    { dayOfWeek: day, startTime: '13:00', endTime: '14:00', category: 'comida', label: 'Almuerzo' },
    { dayOfWeek: day, startTime: '14:00', endTime: '17:00', category: 'class', label: 'Clase' },
    { dayOfWeek: day, startTime: '17:00', endTime: '18:00', category: 'work', label: 'Trabajo' },
    { dayOfWeek: day, startTime: '18:00', endTime: '20:00', category: 'ocio', label: 'Cena + Ocio' },
    { dayOfWeek: day, startTime: '20:00', endTime: '23:00', category: 'work', label: 'Trabajo' },
  ]),
  // Wednesday — class 16:00-18:00 replaces evening work
  ...[3].flatMap(day => [
    { dayOfWeek: day, startTime: '08:00', endTime: '11:00', category: 'work', label: 'Trabajo' },
    { dayOfWeek: day, startTime: '11:00', endTime: '11:30', category: 'ocio', label: 'Descanso' },
    { dayOfWeek: day, startTime: '11:30', endTime: '13:00', category: 'work', label: 'Trabajo' },
    { dayOfWeek: day, startTime: '13:00', endTime: '14:00', category: 'comida', label: 'Almuerzo' },
    { dayOfWeek: day, startTime: '14:00', endTime: '16:00', category: 'work', label: 'Trabajo' },
    { dayOfWeek: day, startTime: '16:00', endTime: '18:00', category: 'class', label: 'Clase' },
    { dayOfWeek: day, startTime: '18:00', endTime: '20:00', category: 'ocio', label: 'Cena + Ocio' },
    { dayOfWeek: day, startTime: '20:00', endTime: '23:00', category: 'work', label: 'Trabajo' },
  ]),
];

export async function seedScheduleForUser(userId: string) {
  await prisma.scheduleBlock.deleteMany({ where: { userId } });
  await prisma.scheduleBlock.createMany({
    data: WEEKLY_SCHEDULE.map((block) => ({
      userId,
      dayOfWeek: block.dayOfWeek,
      startTime: block.startTime,
      endTime: block.endTime,
      category: block.category,
      label: block.label,
    })),
  });
}