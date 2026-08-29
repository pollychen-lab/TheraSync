export interface Therapist {
  id: string;
  name: string;
  title: string;
  modalities: string[];
  specialties: string[];
  rating: number;
  slots: string[];
}

export interface BookingIntent {
  therapistId: string;
  therapistName: string;
  slot: string;
  intakeSummary: string;
}

export interface WebMCPTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  handler: (args: any) => Promise<unknown>;
}
