import { LovedOne } from '@/types/event';

const STORAGE_KEY = 'loved-ones-events';

export function getEvents(): LovedOne[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveEvents(events: LovedOne[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export function addEvent(event: LovedOne) {
  const events = getEvents();
  events.push(event);
  saveEvents(events);
}

export function deleteEvent(id: string) {
  const events = getEvents().filter(e => e.id !== id);
  saveEvents(events);
}

export function updateEvent(updated: LovedOne) {
  const events = getEvents().map(e => e.id === updated.id ? updated : e);
  saveEvents(events);
}

export function getDaysUntil(dateStr: string): number {
  const today = new Date();
  const eventDate = new Date(dateStr);
  const thisYear = today.getFullYear();
  
  let next = new Date(thisYear, eventDate.getMonth(), eventDate.getDate());
  if (next < today) {
    next.setDate(next.getDate()); // check if it's today
    if (next.toDateString() !== today.toDateString()) {
      next = new Date(thisYear + 1, eventDate.getMonth(), eventDate.getDate());
    }
  }
  
  const diff = next.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getAge(dateStr: string): number {
  const today = new Date();
  const birth = new Date(dateStr);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
