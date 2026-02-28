import { LovedOne } from '@/types/event';
import { getDaysUntil, getAge } from '@/lib/events';
import { Cake, Heart, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventCardProps {
  event: LovedOne;
  onDelete: (id: string) => void;
  onEdit: (event: LovedOne) => void;
}

export function EventCard({ event, onDelete, onEdit }: EventCardProps) {
  const daysUntil = getDaysUntil(event.date);
  const age = getAge(event.date);
  const isToday = daysUntil === 0;
  const isSoon = daysUntil <= 7 && daysUntil > 0;
  const eventDate = new Date(event.date);
  const monthDay = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div
      className={cn(
        "relative flex items-center gap-4 rounded-2xl p-4 transition-all duration-200",
        "bg-card shadow-card border border-border",
        isToday && "gradient-celebration border-none shadow-warm",
        isSoon && "border-primary/30 shadow-warm"
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
          event.type === 'birthday' ? "bg-primary/10" : "bg-accent/10",
          isToday && "bg-primary-foreground/20"
        )}
      >
        {event.type === 'birthday' ? (
          <Cake className={cn("h-6 w-6", isToday ? "text-primary-foreground" : "text-primary")} />
        ) : (
          <Heart className={cn("h-6 w-6", isToday ? "text-primary-foreground" : "text-accent")} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className={cn("font-bold text-base truncate", isToday && "text-celebration-foreground")}>
          {event.name}
        </h3>
        <p className={cn("text-sm", isToday ? "text-celebration-foreground/80" : "text-muted-foreground")}>
          {monthDay} · {event.type === 'birthday' ? `Turns ${age + 1}` : `Year ${age + 1}`}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span
          className={cn(
            "text-xs font-bold px-2.5 py-1 rounded-full",
            isToday && "bg-primary-foreground/20 text-celebration-foreground",
            isSoon && "bg-primary/10 text-primary",
            !isToday && !isSoon && "bg-secondary text-secondary-foreground"
          )}
        >
          {isToday ? '🎉 Today!' : isSoon ? `${daysUntil}d` : `${daysUntil}d`}
        </span>
        <div className="flex gap-1">
          <button onClick={() => onEdit(event)} className="p-1 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(event.id)} className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
