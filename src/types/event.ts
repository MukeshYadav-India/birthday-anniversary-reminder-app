export type EventType = 'birthday' | 'anniversary';

export interface LovedOne {
  id: string;
  name: string;
  date: string; // ISO date string (month-day matters)
  type: EventType;
  notes?: string;
}
