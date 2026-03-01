import { useState, useEffect } from 'react';
import { Event } from '@/lib/events';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cake, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

const RELATIONS = ['Family', 'Friend', 'Colleague', 'Brother', 'Sister', 'Wife', 'Husband', 'Parent', 'Other'] as const;

type EventType = 'birthday' | 'anniversary';

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; date: string; type: EventType; relation?: string; notes?: string }) => void;
  editEvent?: Event | null;
}

export function AddEventDialog({ open, onOpenChange, onSave, editEvent }: AddEventDialogProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<EventType>('birthday');
  const [relation, setRelation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editEvent) {
      setName(editEvent.name);
      setDate(editEvent.date);
      setType(editEvent.type as EventType);
      setRelation(editEvent.relation ?? '');
      setNotes(editEvent.notes ?? '');
    } else {
      setName('');
      setDate('');
      setType('birthday');
      setRelation('');
      setNotes('');
    }
  }, [editEvent, open]);

  const handleSave = () => {
    if (!name || !date) return;
    onSave({ name, date, type, relation: relation || undefined, notes: notes || undefined });
    onOpenChange(false);
  };

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
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Who's the lucky person?" className="mt-1.5 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="date" className="text-sm font-semibold">Date</Label>
            <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1.5 rounded-xl" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Type</Label>
            <div className="flex gap-3 mt-1.5">
              <button type="button" onClick={() => setType('birthday')}
                className={cn("flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all border-2",
                  type === 'birthday' ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30"
                )}>
                <Cake className="h-4 w-4" /> Birthday
              </button>
              <button type="button" onClick={() => setType('anniversary')}
                className={cn("flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all border-2",
                  type === 'anniversary' ? "border-accent bg-accent/10 text-accent" : "border-border bg-card text-muted-foreground hover:border-accent/30"
                )}>
                <Heart className="h-4 w-4" /> Anniversary
              </button>
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold">Relation</Label>
            <Select value={relation} onValueChange={setRelation}>
              <SelectTrigger className="mt-1.5 rounded-xl">
                <SelectValue placeholder="Select relation" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes" className="text-sm font-semibold">Notes (optional)</Label>
            <Input id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Gift ideas, memories..." className="mt-1.5 rounded-xl" />
          </div>
          <Button onClick={handleSave} disabled={!name || !date}
            className="w-full rounded-xl h-12 text-base font-bold gradient-warm text-primary-foreground hover:opacity-90 transition-opacity">
            {editEvent ? 'Save Changes' : 'Add to My People'} 🎉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
