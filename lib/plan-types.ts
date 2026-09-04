import type {
  CareerPlanAssumptions,
  CareerProjection,
  YearProjection,
} from "@/lib/engine/career-projection";

export interface PotPoint {
  date: string;
  valueGbp: number;
}

export interface PlanActuals {
  isaGbp: number;
  sippGbp: number;
  isaHistory: PotPoint[];
  sippHistory: PotPoint[];
}

export interface PlanPayload {
  assumptions: CareerPlanAssumptions;
  actuals: PlanActuals;
  projection: CareerProjection;
  planned: YearProjection[];
}
