export type TripPlanVisibility = "public" | "private";
export type TripLengthType = "day_trip" | "overnight";

export type TripPlanInput = {
  departureFrom?: string;
  peopleCount?: number;
  relationship?: string;
  tripLengthType: TripLengthType;
  nights?: number;
  destination1?: string;
  destination2?: string;
  mustDo?: string;
  breakfastNote?: string;
  lunchNote?: string;
  dinnerNote?: string;
  budgetLevel?: string;
  visibility: TripPlanVisibility;
};

export type CandidateOption = {
  name: string;
  address?: string;
  costMin?: number;
  costMax?: number;
  feature?: string;
};

export type TripPlanDraftItem = {
  startTime?: string;
  endTime?: string;
  category?: string;
  title: string;
  memo?: string;
  address?: string;
  estimatedCostMin?: number;
  estimatedCostMax?: number;
  candidateOptions?: CandidateOption[];
};

export type TripPlanDraftDay = {
  dayNumber: number;
  items: TripPlanDraftItem[];
};

export type TripPlanDraft = {
  title: string;
  concept: string;
  recommendedFor?: string;
  estimatedCostMin?: number;
  estimatedCostMax?: number;
  days: TripPlanDraftDay[];
};

export type TripPlanAIResult = {
  plans: TripPlanDraft[];
};
