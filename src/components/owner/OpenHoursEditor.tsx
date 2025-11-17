import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface TimeSlot {
  start: string;
  end: string;
}

interface OpenHours {
  mon: string[][];
  tue: string[][];
  wed: string[][];
  thu: string[][];
  fri: string[][];
  sat: string[][];
  sun: string[][];
}

interface OpenHoursEditorProps {
  openHours: OpenHours;
  onChange: (openHours: OpenHours) => void;
}

const dayNames = {
  mon: "Lunedì",
  tue: "Martedì",
  wed: "Mercoledì",
  thu: "Giovedì",
  fri: "Venerdì",
  sat: "Sabato",
  sun: "Domenica",
};

export const OpenHoursEditor = ({ openHours, onChange }: OpenHoursEditorProps) => {
  const handleTimeChange = (
    day: keyof OpenHours,
    slotIndex: number,
    timeIndex: number,
    value: string
  ) => {
    const newHours = { ...openHours };
    newHours[day][slotIndex][timeIndex] = value;
    onChange(newHours);
  };

  const addTimeSlot = (day: keyof OpenHours) => {
    const newHours = { ...openHours };
    newHours[day] = [...newHours[day], ["09:00", "13:00"]];
    onChange(newHours);
  };

  const removeTimeSlot = (day: keyof OpenHours, slotIndex: number) => {
    const newHours = { ...openHours };
    newHours[day] = newHours[day].filter((_, index) => index !== slotIndex);
    onChange(newHours);
  };

  return (
    <div className="border-t pt-4 mt-4">
      <h3 className="font-semibold mb-4">Orari di Apertura</h3>
      <div className="space-y-4">
        {(Object.keys(dayNames) as Array<keyof OpenHours>).map((day) => (
          <div key={day} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-medium">{dayNames[day]}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addTimeSlot(day)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Aggiungi fascia
              </Button>
            </div>
            {openHours[day].length === 0 ? (
              <p className="text-sm text-muted-foreground">Chiuso</p>
            ) : (
              <div className="space-y-2">
                {openHours[day].map((slot, slotIndex) => (
                  <div key={slotIndex} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={slot[0]}
                      onChange={(e) =>
                        handleTimeChange(day, slotIndex, 0, e.target.value)
                      }
                      className="w-32"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="time"
                      value={slot[1]}
                      onChange={(e) =>
                        handleTimeChange(day, slotIndex, 1, e.target.value)
                      }
                      className="w-32"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTimeSlot(day, slotIndex)}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
