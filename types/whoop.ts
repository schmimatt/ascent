export interface RecoveryData {
  score: number;
  hrv: number;
  rhr: number;
  spo2: number | null;
  skinTempCelsius: number | null;
  skinTempFahrenheit: number | null;
  userCalibrating: boolean;
}

export interface SleepData {
  totalInBedHours: number;
  totalAwakeHours: number;
  totalLightHours: number;
  totalRemHours: number;
  totalDeepHours: number;
  sleepCycleCount: number;
  disturbanceCount: number;
  efficiency: number;
  respiratoryRate: number | null;
  sleepPerformance: number | null;
  sleepConsistency: number | null;
  sleepNeededBaseline: number;
  sleepNeededDebt: number;
  sleepNeededStrain: number;
  nap: boolean;
  start: string;
  end: string;
}

export interface CycleData {
  strain: number;
  calories: number;
  avgHr: number;
  maxHr: number;
  start: string;
  end: string | null;
}

export interface Workout {
  sport: string;
  strain: number;
  avgHr: number;
  maxHr: number;
  calories: number;
  durationMinutes: number;
  distanceMeters: number | null;
  altitudeGainMeters: number | null;
  start: string;
  end: string;
  zones: {
    zone0: number;
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
  } | null;
}

export interface BodyMeasurement {
  heightMeters: number;
  weightKg: number;
  maxHeartRate: number;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
}

export interface WhoopData {
  profile: UserProfile | null;
  body: BodyMeasurement | null;
  recovery: RecoveryData;
  recoveryHistory: { date: string; score: number; hrv: number }[];
  sleep: SleepData;
  sleepHistory: { date: string; totalHours: number; efficiency: number }[];
  cycle: CycleData;
  workouts: Workout[];
  lastUpdated: string;
}
