import { useState, useEffect, useCallback } from 'react';
import { Event, fetchEvents, createEvent, updateEventById, deleteEventById, getDaysUntil } from '@/lib/events';
import { subscribeToPush, isPushSubscribed, registerServiceWorker } from '@/lib/push';
import { EventCard } from '@/components/EventCard';
import { AddEventDialog } from '@/components/AddEventDialog';
import { Plus, CalendarHeart, Sparkles, Bell, BellOff, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const Index = () => {
  const { user, signOut } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    registerServiceWorker();
    isPushSubscribed().then(setPushEnabled);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchEvents(user.id).then((data) => {
      setEvents(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const sortedEvents = [...events].sort((a, b) => getDaysUntil(a.date) - getDaysUntil(b.date));

  const handleSave = useCallback(async (data: {name: string;date: string;type: string;relation?: string;notes?: string;}) => {
    if (!user) return;
    try {
      if (editingEvent) {
        const updated = await updateEventById(editingEvent.id, data);
        setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e));
        toast.success('Event updated! ✨');
      } else {
        const created = await createEvent({ ...data, user_id: user.id });
        setEvents((prev) => [...prev, created]);
        toast.success('Added to your people! 🎉');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
    setEditingEvent(null);
  }, [user, editingEvent]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteEventById(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success('Removed');
    } catch (err: any) {
      toast.error(err.message);
    }
  }, []);

  const handleEdit = useCallback((event: Event) => {
    setEditingEvent(event);
    setDialogOpen(true);
  }, []);

  const handleTogglePush = async () => {
    if (!user) return;
    setPushLoading(true);
    try {
      if (!pushEnabled) {
        const granted = await Notification.requestPermission();
        if (granted !== 'granted') {
          toast.error('Please allow notifications in your browser settings');
          setPushLoading(false);
          return;
        }
        const success = await subscribeToPush(user.id);
        if (success) {
          setPushEnabled(true);
          toast.success('Push notifications enabled! 🔔');
        } else {
          toast.error('Failed to enable push notifications');
        }
      } else {
        setPushEnabled(false);
        toast.success('Push notifications disabled');
      }
    } catch {
      toast.error('Failed to toggle notifications');
    }
    setPushLoading(false);
  };

  const upcomingCount = events.filter((e) => getDaysUntil(e.date) <= 30).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-warm px-6 pt-10 pb-8 rounded-b-[2rem]">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <CalendarHeart className="h-6 w-6 text-primary-foreground/90" />
              <h1 className="text-2xl font-extrabold text-primary-foreground">Wish Your Loved Ones</h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleTogglePush}
                disabled={pushLoading}
                className="p-2 rounded-xl text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                title={pushEnabled ? 'Disable notifications' : 'Enable notifications'}>

                {pushLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : pushEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              </button>
              <button
                onClick={signOut}
                className="p-2 rounded-xl text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                title="Sign out">

                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
          <p className="text-primary-foreground/75 text-sm font-medium">
            Never forget the dates that matter most
          </p>

          <div className="mt-5 flex gap-3">
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
        <Button
          onClick={() => {setEditingEvent(null);setDialogOpen(true);}}
          className="w-full rounded-2xl h-14 text-base font-bold shadow-warm bg-card text-foreground border border-border hover:shadow-lg hover:border-primary/30 transition-all mb-6"
          variant="outline">

          <Plus className="h-5 w-5 mr-2 text-primary" />
          Add Someone Special
        </Button>

        {loading ?
        <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div> :
        sortedEvents.length === 0 ?
        <div className="text-center py-16">
            <Sparkles className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-muted-foreground/60">No one added yet</h3>
            <p className="text-sm text-muted-foreground/40 mt-1">Start by adding your loved ones' special dates</p>
          </div> :

        <div className="space-y-3 pb-8">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">Upcoming Events</h2>
            {sortedEvents.map((event) =>
          <EventCard key={event.id} event={event} onDelete={handleDelete} onEdit={handleEdit} />
          )}
          </div>
        }
      </div>

      <AddEventDialog
        open={dialogOpen}
        onOpenChange={(open) => {setDialogOpen(open);if (!open) setEditingEvent(null);}}
        onSave={handleSave}
        editEvent={editingEvent} />

    </div>);

};

export default Index;