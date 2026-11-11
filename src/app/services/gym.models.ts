// Modelos del dominio openGym compartidos por las páginas.

export interface CatalogExercise {
  id: string;
  name: string;
  originalName: string;
  bodyPart: string;
  equipment: string;
  target: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  category: string;
  img: string;
  gif: string;
  femaleVariant?: string;
  description?: string | null;
  instructions?: string[] | null;
}

export interface CatalogMeta {
  count: number;
  bodyParts: string[];
  equipment: string[];
  categories: string[];
  dayNames: Record<string, string>;
  dayShort: Record<string, string>;
}

export interface RoutineExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  restSec: number;
  note?: string;
}

export interface Routine {
  id: string;
  name: string;
  emoji: string;
  exercises: RoutineExercise[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SetRow {
  w: number;
  r: number;
  ts: number;
  phase: 'warmup' | 'work';
  failure?: boolean;
}

export interface WorkoutEntryCfg {
  sets: number;
  reps: number;
  weight: number;
  restSec: number;
  unit: 'kg' | 'lb';
  mode: 'reps' | 'time' | 'cardio';
}

export interface WorkoutEntry {
  exId: string;
  name: string;
  cfg: WorkoutEntryCfg;
  rows: SetRow[];
  note?: string;
  last?: { w: number; r: number } | null;
}

export interface Workout {
  id: string;
  name: string;
  routineId: string | null;
  entries: WorkoutEntry[];
  state: 'active' | 'done';
  startedAt: string;
  finishedAt: string | null;
  durationSec: number | null;
  notes: string;
}

export interface BodyweightEntry {
  id: string;
  weighedOn: string;
  weight: number;
}

export interface PersonalRecord {
  exId: string;
  name: string;
  w: number;
  r: number;
  date: string;
}

export interface StatsSummary {
  totalWorkouts: number;
  thisMonth: number;
  monthVolume: number;
  streakWeeks: number;
  weeklyVolume: { week: string; volume: number }[];
  prs: PersonalRecord[];
  bodyweight: BodyweightEntry | null;
  bodyweightSeries: { weighedOn: string; weight: number }[];
}

export interface HomePayload {
  day: number;
  dayName: string;
  week: Record<string, string[]>;
  todayRoutines: { id: string; name: string; emoji: string; exerciseCount: number }[];
  activeWorkout: Workout | null;
  totals: { total: number; thisMonth: number };
  lastWorkout: Workout | null;
  bodyweight: BodyweightEntry | null;
}

export interface ExerciseStats {
  exId: string;
  sessions: {
    id: string;
    workoutName: string;
    date: string;
    rows: { w: number; r: number }[];
    volume: number;
  }[];
  best: { w: number; r: number; est1rm: number; date: string } | null;
  last: { w: number; r: number } | null;
  totalVolume: number;
}
