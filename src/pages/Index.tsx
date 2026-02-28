import { useState, useEffect, useCallback } from 'react';
import { LovedOne } from '@/types/event';
import { getEvents, saveEvents, deleteEvent, getDaysUntil } from '@/lib/events';
import { EventCard } from '@/components/EventCard';
import { AddEventDialog } from '@/components/AddEventDialog';
import { Plus, CalendarHeart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const [events, setEvents] = useState<LovedOne[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LovedOne | null>(null);

  useEffect(() => {
    setEvents(getEvents());
  }, []);

  const sortedEvents = [...events].sort((a, b) => getDaysUntil(a.date) - getDaysUntil(b.date));

  const handleSave = useCallback((event: LovedOne) => {
    const existing = events.find(e => e.id === event.id);
    let updated: LovedOne[];
    if (existing) {
      updated = events.map(e => e.id === event.id ? event : e);
    } else {
      updated = [...events, event];
    }
    setEvents(updated);
    saveEvents(updated);
    setEditingEvent(null);
  }, [events]);

  const handleDelete = useCallback((id: string) => {
    deleteEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  const handleEdit = useCallback((event: LovedOne) => {
    setEditingEvent(event);
    setDialogOpen(true);
  }, []);

  const upcomingCount = events.filter(e => getDaysUntil(e.date) <= 30).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-warm px-6 pt-12 pb-8 rounded-b-[2rem]">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <CalendarHeart className="h-6 w-6 text-primary-foreground/90" />
            <h1 className="text-2xl font-extrabold text-primary-foreground">Cherish</h1>
          </div>
          <p className="text-primary-foreground/75 text-sm font-medium">
            Never forget the dates that matter most
          </p>

          <div className="mt-6 flex gap-3">
            <div className="flex-1 bg-primary-foreground/15 backdrop-blur-sm rounded-2xl p-4">
              <p className="text-3xl font-extrabold text-primary-foreground">{events.length}</p>
              <p className="text-xs text-primary-foreground/70 font-semibold mt-0.5">Loved Ones</p>
            </div>
            <div className="flex-1 bg-primary-foreground/15 backdrop-blur-sm rounded-2xl p-4">
              <p className="text-3xl font-extrabold text-primary-foreground">{upcomingCount}</p>
              <p className="text-xs text-primary-foreground/70 font-semibold mt-0.5">This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-5 -mt-4">
        {/* Add Button */}
        <Button
          onClick={() => { setEditingEvent(null); setDialogOpen(true); }}
          className="w-full rounded-2xl h-14 text-base font-bold shadow-warm bg-card text-foreground border border-border hover:shadow-lg hover:border-primary/30 transition-all mb-6"
          variant="outline"
        >
          <Plus className="h-5 w-5 mr-2 text-primary" />
          Add Someone Special
        </Button>

        {/* Events List */}
        {sortedEvents.length === 0 ? (
          <div className="text-center py-16">
            <Sparkles className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-muted-foreground/60">No one added yet</h3>
            <p className="text-sm text-muted-foreground/40 mt-1">
              Start by adding your loved ones' special dates
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
              Upcoming Events
            </h2>
            {sortedEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>

      <AddEventDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingEvent(null); }}
        onSave={handleSave}
        editEvent={editingEvent}
      />
    </div>
  );
};

export default Index;
