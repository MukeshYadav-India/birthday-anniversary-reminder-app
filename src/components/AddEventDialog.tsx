import { useState } from 'react';
import { LovedOne, EventType } from '@/types/event';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Cake, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (event: LovedOne) => void;
  editEvent?: LovedOne | null;
}

export function AddEventDialog({ open, onOpenChange, onSave, editEvent }: AddEventDialogProps) {
  const [name, setName] = useState(editEvent?.name ?? '');
  const [date, setDate] = useState(editEvent?.date ?? '');
  const [type, setType] = useState<EventType>(editEvent?.type ?? 'birthday');
  const [notes, setNotes] = useState(editEvent?.notes ?? '');

  const handleSave = () => {
    if (!name || !date) return;
    onSave({
      id: editEvent?.id ?? crypto.randomUUID(),
      name,
      date,
      type,
      notes: notes || undefined,
    });
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    if (!editEvent) {
      setName('');
      setDate('');
      setType('birthday');
      setNotes('');
    }
  };

  // Sync form when editEvent changes
  useState(() => {
    if (editEvent) {
      setName(editEvent.name);
      setDate(editEvent.date);
      setType(editEvent.type);
      setNotes(editEvent.notes ?? '');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {editEvent ? 'Edit Event' : 'Add Someone Special'} ✨
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="name" className="text-sm font-semibold">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Who's the lucky person?"
              className="mt-1.5 rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="date" className="text-sm font-semibold">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="mt-1.5 rounded-xl"
            />
          </div>

          <div>
            <Label className="text-sm font-semibold">Type</Label>
            <div className="flex gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => setType('birthday')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all border-2",
                  type === 'birthday'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30"
                )}
              >
                <Cake className="h-4 w-4" /> Birthday
              </button>
              <button
                type="button"
                onClick={() => setType('anniversary')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all border-2",
                  type === 'anniversary'
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-card text-muted-foreground hover:border-accent/30"
                )}
              >
                <Heart className="h-4 w-4" /> Anniversary
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="text-sm font-semibold">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Gift ideas, memories..."
              className="mt-1.5 rounded-xl"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={!name || !date}
            className="w-full rounded-xl h-12 text-base font-bold gradient-warm text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {editEvent ? 'Save Changes' : 'Add to My People'} 🎉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
