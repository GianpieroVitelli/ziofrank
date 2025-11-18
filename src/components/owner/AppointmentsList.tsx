import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Clock, User, Phone, Mail, Calendar, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  created_at: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  notes: string | null;
  status: string;
  is_bonus: boolean;
  user_id: string | null;
}

export const AppointmentsList = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCanceled, setShowCanceled] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<'appointment_time' | 'booking_time'>('appointment_time');

  useEffect(() => {
    loadAppointments();
  }, [sortMode]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const orderBy = sortMode === 'booking_time' ? 'created_at' : 'start_time';
      const ascending = sortMode === 'appointment_time';
      
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order(orderBy, { ascending });

      if (error) throw error;
      if (data) setAppointments(data);
    } catch (error) {
      console.error("Error loading appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      CONFIRMED: { variant: "default", label: "Confermato" },
      CANCELED: { variant: "destructive", label: "Annullato" },
      COMPLETED: { variant: "secondary", label: "Completato" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div className="text-center py-8">Caricamento...</div>;
  }

  const now = new Date();
  const hasSearchQuery = searchQuery.trim().length > 0;

  const filteredAppointments = appointments.filter(apt => {
    // 1. Filtro per data: se c'è una ricerca attiva, ignora il filtro temporale
    if (!hasSearchQuery) {
      const isPast = new Date(apt.start_time) <= now;
      if (!showPast && isPast) return false;
    }
    
    // 2. Filtro per status cancellato
    if (!showCanceled && apt.status === "CANCELED") return false;
    
    // 3. Filtro per ricerca multi-campo (se c'è una ricerca attiva)
    if (hasSearchQuery) {
      const query = searchQuery.toLowerCase();
      const startDate = new Date(apt.start_time);
      
      // Formatta la data in vari modi per la ricerca
      const fullDate = format(startDate, "EEEE d MMMM yyyy", { locale: it });
      const shortDate = format(startDate, "dd/MM/yyyy", { locale: it });
      const dayMonth = format(startDate, "d MMMM", { locale: it });
      const monthYear = format(startDate, "MMMM yyyy", { locale: it });
      const year = format(startDate, "yyyy", { locale: it });
      
      const matchesSearch = 
        apt.client_name?.toLowerCase().includes(query) ||
        apt.client_phone?.toLowerCase().includes(query) ||
        apt.client_email?.toLowerCase().includes(query) ||
        fullDate.toLowerCase().includes(query) ||
        shortDate.includes(query) ||
        dayMonth.toLowerCase().includes(query) ||
        monthYear.toLowerCase().includes(query) ||
        year.includes(query);
        
      if (!matchesSearch) return false;
    }
    
    return true;
  });

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nessun appuntamento trovato.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <Button
          variant={sortMode === 'appointment_time' ? 'default' : 'outline'}
          onClick={() => setSortMode('appointment_time')}
          className="flex-1"
        >
          <Calendar className="mr-2 h-4 w-4" />
          Mostra Tutti gli Appuntamenti
        </Button>
        <Button
          variant={sortMode === 'booking_time' ? 'default' : 'outline'}
          onClick={() => setSortMode('booking_time')}
          className="flex-1"
        >
          <Clock className="mr-2 h-4 w-4" />
          Cronologia Prenotazioni
        </Button>
      </div>

      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cerca per nome, email, telefono o data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Checkbox 
              id="show-canceled" 
              checked={showCanceled}
              onCheckedChange={(checked) => setShowCanceled(checked === true)}
            />
            <label 
              htmlFor="show-canceled" 
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Mostra appuntamenti cancellati
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <Checkbox 
              id="show-past" 
              checked={showPast}
              onCheckedChange={(checked) => setShowPast(checked === true)}
            />
            <label 
              htmlFor="show-past" 
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Mostra appuntamenti passati
            </label>
          </div>
        </div>
      </div>
      
      {filteredAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nessun appuntamento trovato.
          </CardContent>
        </Card>
      ) : (
        filteredAppointments.map((appointment) => (
        <Card key={appointment.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                {format(new Date(appointment.start_time), "EEEE d MMMM yyyy", { locale: it })}
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                {getStatusBadge(appointment.status)}
                {appointment.is_bonus && (
                  <Badge variant="outline" className="bg-accent/20">BONUS</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">
                    {format(new Date(appointment.start_time), "HH:mm", { locale: it })} - {format(new Date(appointment.end_time), "HH:mm", { locale: it })}
                  </span>
                </div>
                {appointment.client_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{appointment.client_name}</span>
                  </div>
                )}
                {appointment.client_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${appointment.client_phone}`} className="text-primary hover:underline">
                      {appointment.client_phone}
                    </a>
                  </div>
                )}
                {appointment.client_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${appointment.client_email}`} className="text-primary hover:underline">
                      {appointment.client_email}
                    </a>
                  </div>
                )}
              </div>
              {appointment.notes && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Note:</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{appointment.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        ))
      )}
    </div>
  );
};
