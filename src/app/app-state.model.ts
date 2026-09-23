export interface AppState {
  _ts: number;
  _rev?: number;
  unit: 'kg' | 'lb';
  lang: string;
  theme: string;
  accent: string;
  workouts: any[];
  routines: any[];
  week: { [key: string]: string };
  dayPlan: { [key: string]: string };
  bodyweight: { d: string; w: number; t: number }[];
  customEx: any[];
  exWeights: { [key: string]: { w: number; d: string } };
  restSec: number;
  effort: 'none' | 'rir' | 'rpe' | null;
  settings: any;
}