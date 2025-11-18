import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar, Clock, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  notes: string | null;
  status: string;
  is_bonus: boolean;
}

interface CustomerAppointmentsDialogProps {
  customerId: string;
  customerName: string;
}

export const CustomerAppointmentsDialog = ({ customerId, customerName }: CustomerAppointmentsDialogProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCanceled, setShowCanceled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const loadAppointments = async () => {
    if (!isOpen) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", customerId)
        .order("start_time", { ascending: true });

      if (error) throw error;
      if (data) setAppointments(data);
    } catch (error) {
      console.error("Error loading appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [isOpen, customerId]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      CONFIRMED: { variant: "default", label: "Confermato" },
      CANCELED: { variant: "destructive", label: "Annullato" },
      COMPLETED: { variant: "secondary", label: "Completato" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const now = new Date();
  
  // Filtra e ordina gli appuntamenti
  const filteredAndSortedAppointments = appointments
    .filter(apt => showCanceled || apt.status !== "CANCELED")
    .sort((a, b) => {
      const dateA = new Date(a.start_time);
      const dateB = new Date(b.start_time);
      const isPastA = dateA <= now;
      const isPastB = dateB <= now;

      // Separa futuri da passati
      if (isPastA && !isPastB) return 1; // a è passato, b è futuro → b prima
      if (!isPastA && isPastB) return -1; // a è futuro, b è passato → a prima

      // Entrambi futuri: ordina per data decrescente (più lontano prima)
      if (!isPastA && !isPastB) {
        return dateB.getTime() - dateA.getTime();
      }

      // Entrambi passati: ordina per data decrescente (più recente prima)
      if (isPastA && isPastB) {
        return dateB.getTime() - dateA.getTime();
      }

      return 0;
    });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
          <Calendar className="w-3 h-3 mr-1" />
          Appuntamenti
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Appuntamenti di {customerName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center gap-2 pb-3">
          <Checkbox 
            id="show-canceled-customer" 
            checked={showCanceled}
            onCheckedChange={(checked) => setShowCanceled(checked === true)}
          />
          <label 
            htmlFor="show-canceled-customer" 
            className="text-xs text-muted-foreground cursor-pointer select-none"
          >
            Mostra appuntamenti cancellati
          </label>
        </div>

        <ScrollArea className="h-[60vh] pr-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
          ) : filteredAndSortedAppointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessun appuntamento trovato
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAndSortedAppointments.map((appointment) => {
                const isPast = new Date(appointment.start_time) <= now;
                
                return (
                  <Card 
                    key={appointment.id} 
                    className={`transition-all ${
                      isPast 
                        ? 'bg-muted/30 border-muted-foreground/20 opacity-70' 
                        : 'bg-card border-primary/20 shadow-sm'
                    }`}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="space-y-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Calendar className={`w-4 h-4 ${isPast ? 'text-muted-foreground' : 'text-primary'}`} />
                            <span className={`font-medium text-sm ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {format(new Date(appointment.start_time), "EEEE d MMMM yyyy", { locale: it })}
                            </span>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {getStatusBadge(appointment.status)}
                            {appointment.is_bonus && (
                              <Badge variant="outline" className="bg-accent/20">BONUS</Badge>
                            )}
                            {isPast && appointment.status === "CONFIRMED" && (
                              <Badge variant="secondary" className="text-xs">Passato</Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className={`w-3.5 h-3.5 ${isPast ? 'text-muted-foreground/70' : 'text-muted-foreground'}`} />
                          <span className={`text-sm ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {format(new Date(appointment.start_time), "HH:mm", { locale: it })} - {format(new Date(appointment.end_time), "HH:mm", { locale: it })}
                          </span>
                        </div>

                        {appointment.notes && (
                          <div className="flex gap-2 mt-2">
                            <FileText className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isPast ? 'text-muted-foreground/70' : 'text-muted-foreground'}`} />
                            <p className={`text-xs ${isPast ? 'text-muted-foreground/80' : 'text-muted-foreground'} bg-muted/40 p-2 rounded-md flex-1`}>
                              {appointment.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
