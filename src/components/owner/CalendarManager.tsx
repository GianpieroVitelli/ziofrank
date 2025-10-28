import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { Plus, Edit, Trash2, Star, Mail, CalendarIcon } from "lucide-react";

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  notes: string | null;
  is_bonus: boolean;
  status: "CONFIRMED" | "CANCELED";
  user_id: string | null;
}

export const CalendarManager = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    client_name: "",
    client_email: "",
    client_phone: "",
    notes: "",
    is_bonus: false,
  });
  const timezone = "Europe/Rome";

  useEffect(() => {
    if (selectedDate) {
      loadAppointments(selectedDate);
    }
  }, [selectedDate]);

  const loadAppointments = async (date: Date) => {
    try {
      setLoading(true);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error: any) {
      console.error("Error loading appointments:", error);
      toast.error("Errore nel caricamento degli appuntamenti");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.date || !formData.time) {
        toast.error("Data e ora sono obbligatori");
        return;
      }

      const startTime = new Date(`${formData.date}T${formData.time}:00`);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);

      const appointmentData = {
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        client_name: formData.client_name || null,
        client_email: formData.client_email || null,
        client_phone: formData.client_phone || null,
        notes: formData.notes || null,
        is_bonus: formData.is_bonus,
        status: "CONFIRMED" as const,
        created_by: "owner",
      };

      if (editingAppointment) {
        const { error } = await supabase
          .from("appointments")
          .update(appointmentData)
          .eq("id", editingAppointment.id);

        if (error) throw error;
        toast.success("Appuntamento aggiornato");
      } else {
        const { error } = await supabase.from("appointments").insert(appointmentData);

        if (error) throw error;
        toast.success("Appuntamento creato");
      }

      setDialogOpen(false);
      setEditingAppointment(null);
      resetForm();
      if (selectedDate) loadAppointments(selectedDate);
    } catch (error: any) {
      console.error("Error saving appointment:", error);
      toast.error("Errore nel salvataggio");
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Annullare questo appuntamento?")) return;

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "CANCELED" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Appuntamento annullato");
      if (selectedDate) loadAppointments(selectedDate);
    } catch (error: any) {
      console.error("Error canceling appointment:", error);
      toast.error("Errore nell'annullamento");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare definitivamente questo appuntamento?")) return;

    try {
      const { error } = await supabase.from("appointments").delete().eq("id", id);

      if (error) throw error;
      toast.success("Appuntamento eliminato");
      if (selectedDate) loadAppointments(selectedDate);
    } catch (error: any) {
      console.error("Error deleting appointment:", error);
      toast.error("Errore nell'eliminazione");
    }
  };

  const openEditDialog = (appointment: Appointment) => {
    const startTime = toZonedTime(new Date(appointment.start_time), timezone);
    setEditingAppointment(appointment);
    setFormData({
      date: format(startTime, "yyyy-MM-dd"),
      time: format(startTime, "HH:mm"),
      client_name: appointment.client_name || "",
      client_email: appointment.client_email || "",
      client_phone: appointment.client_phone || "",
      notes: appointment.notes || "",
      is_bonus: appointment.is_bonus,
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingAppointment(null);
    const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
    setFormData({
      date: dateStr,
      time: "09:00",
      client_name: "",
      client_email: "",
      client_phone: "",
      notes: "",
      is_bonus: false,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      date: "",
      time: "",
      client_name: "",
      client_email: "",
      client_phone: "",
      notes: "",
      is_bonus: false,
    });
  };

  return (
    <>
      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Calendario</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={it}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                {selectedDate ? format(selectedDate, "EEEE, d MMMM yyyy", { locale: it }) : "Seleziona una data"}
              </CardTitle>
              <Button onClick={openNewDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Appuntamento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-12">
                <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nessun appuntamento per questa data</p>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((apt) => {
                  const startTime = toZonedTime(new Date(apt.start_time), timezone);
                  return (
                    <div
                      key={apt.id}
                      className={`p-4 rounded-lg border ${
                        apt.is_bonus
                          ? "bg-accent/10 border-accent"
                          : apt.status === "CANCELED"
                          ? "bg-destructive/10 border-destructive"
                          : "bg-card"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">
                              {format(startTime, "HH:mm")} - {apt.client_name || "Cliente walk-in"}
                            </p>
                            {apt.is_bonus && <Star className="w-4 h-4 text-accent" fill="currentColor" />}
                          </div>
                          {apt.client_email && (
                            <p className="text-sm text-muted-foreground">{apt.client_email}</p>
                          )}
                          {apt.client_phone && (
                            <p className="text-sm text-muted-foreground">{apt.client_phone}</p>
                          )}
                          {apt.notes && (
                            <p className="text-sm text-muted-foreground mt-1 italic">{apt.notes}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(apt)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          {apt.status !== "CANCELED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancel(apt.id)}
                            >
                              Annulla
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(apt.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAppointment ? "Modifica Appuntamento" : "Nuovo Appuntamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="time">Ora</Label>
                <Input
                  id="time"
                  type="time"
                  step="1800"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="client_name">Nome Cliente</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="Opzionale per walk-in"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="client_email">Email</Label>
                <Input
                  id="client_email"
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="client_phone">Telefono</Label>
                <Input
                  id="client_phone"
                  value={formData.client_phone}
                  onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Note</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_bonus"
                checked={formData.is_bonus}
                onCheckedChange={(checked) => setFormData({ ...formData, is_bonus: checked })}
              />
              <Label htmlFor="is_bonus">Appuntamento BONUS (sovrapponibile)</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleSave}>Salva</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
