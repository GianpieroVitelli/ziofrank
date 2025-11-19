import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { Plus, Edit, Trash2, Star, Mail, CalendarIcon, StickyNote, Save, X, Lock } from "lucide-react";

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

interface CustomerNote {
  id: string;
  user_id: string;
  note: string;
  updated_at: string;
}

interface TimeSlot {
  time: string;
  type: "appointment" | "free" | "blocked";
  appointment?: Appointment;
  blockId?: string;
}

export const CalendarManager = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customerNotes, setCustomerNotes] = useState<Record<string, CustomerNote>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [customerNoteText, setCustomerNoteText] = useState("");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [showCanceled, setShowCanceled] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
  } | null>(null);
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [slotBlocks, setSlotBlocks] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    client_name: "",
    client_email: "",
    client_phone: "",
    is_bonus: false,
  });
  const timezone = "Europe/Rome";

  useEffect(() => {
    loadShopSettings();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadAppointments(selectedDate);
    }
  }, [selectedDate]);

  const loadShopSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("shop_settings")
        .select("open_hours, timezone")
        .single();
      
      if (error) throw error;
      setShopSettings(data);
    } catch (error) {
      console.error("Error loading shop settings:", error);
      toast.error("Errore nel caricamento delle impostazioni");
    }
  };

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

      // Load customer notes for appointments with user_id
      const userIds = (data || [])
        .map(apt => apt.user_id)
        .filter((id): id is string => id !== null);
      
      if (userIds.length > 0) {
        const { data: notesData } = await supabase
          .from("customer_notes")
          .select("*")
          .in("user_id", userIds);

        const notesMap: Record<string, CustomerNote> = {};
        (notesData || []).forEach(note => {
          notesMap[note.user_id] = note;
        });
        setCustomerNotes(notesMap);
      }

      // Load slot blocks for the selected day
      const { data: blocksData } = await supabase
        .from("slot_blocks")
        .select("*")
        .eq("day", format(date, "yyyy-MM-dd"));

      setSlotBlocks(blocksData || []);
    } catch (error: any) {
      console.error("Error loading appointments:", error);
      toast.error("Errore nel caricamento degli appuntamenti");
    } finally {
      setLoading(false);
    }
  };

  const searchCustomers = async (query: string) => {
    if (!query || query.length < 2) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }

    try {
      setIsSearching(true);
      const { data, error } = await supabase.rpc("get_customers", {
        search_query: query,
        sort_order: "alpha"
      });

      if (error) throw error;
      setCustomerSearchResults(data || []);
      setShowCustomerDropdown(true);
    } catch (error) {
      console.error("Error searching customers:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCustomer = async (customer: any) => {
    setSelectedCustomer({
      id: customer.id,
      name: customer.display_name,
      email: customer.email,
      phone: customer.phone
    });

    setFormData({
      ...formData,
      client_name: customer.display_name,
      client_email: customer.email,
      client_phone: customer.phone || ""
    });

    const { data: noteData } = await supabase
      .from("customer_notes")
      .select("*")
      .eq("user_id", customer.id)
      .maybeSingle();

    if (noteData) {
      setCustomerNoteText(noteData.note);
      setCustomerNotes({
        ...customerNotes,
        [customer.id]: noteData
      });
    } else {
      setCustomerNoteText("");
    }

    setShowCustomerDropdown(false);
  };

  const handleDeselectCustomer = () => {
    setSelectedCustomer(null);
    setFormData({
      ...formData,
      client_name: "",
      client_email: "",
      client_phone: ""
    });
    setCustomerNoteText("");
    setIsEditingNote(false);
  };

  const handleSave = async () => {
    try {
      if (!formData.date || !formData.time) {
        toast.error("Data e ora sono obbligatori");
        return;
      }

      const startTime = new Date(`${formData.date}T${formData.time}:00`);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 45);

      const appointmentData = {
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        client_name: formData.client_name || null,
        client_email: formData.client_email || null,
        client_phone: formData.client_phone || null,
        notes: null,
        is_bonus: formData.is_bonus,
        status: "CONFIRMED" as const,
        created_by: "owner",
        user_id: selectedCustomer ? selectedCustomer.id : null,
      };

      if (editingAppointment) {
        const { error } = await supabase
          .from("appointments")
          .update(appointmentData)
          .eq("id", editingAppointment.id);

        if (error) throw error;
        toast.success("Appuntamento aggiornato");
      } else {
        const { data: newAppointment, error } = await supabase
          .from("appointments")
          .insert(appointmentData)
          .select()
          .single();

        if (error) throw error;
        toast.success("Appuntamento creato");

        // Send confirmation email if client email is provided
        if (formData.client_email && newAppointment) {
          try {
            const { error: emailError } = await supabase.functions.invoke('send-confirmation', {
              body: { appointment_id: newAppointment.id }
            });
            
            if (emailError) {
              console.error("Failed to send confirmation email:", emailError);
            }
          } catch (emailError) {
            console.error("Error sending confirmation email:", emailError);
          }
        }
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
      // Use RPC function to cancel (owner can always cancel)
      const { data, error } = await supabase.rpc('cancel_appointment', {
        p_appointment_id: id
      });

      if (error) throw error;

      // Send cancellation email
      try {
        const { error: emailError } = await supabase.functions.invoke('send-cancellation', {
          body: { appointment_id: id }
        });
        
        if (emailError) {
          console.error("Failed to send cancellation email:", emailError);
        }
      } catch (emailError) {
        console.error("Error sending cancellation email:", emailError);
      }

      toast.success("Appuntamento annullato");
      if (selectedDate) loadAppointments(selectedDate);
    } catch (error: any) {
      console.error("Error canceling appointment:", error);
      toast.error(error.message || "Errore nell'annullamento");
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
    setSelectedCustomer(null);
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    setFormData({
      date: format(startTime, "yyyy-MM-dd"),
      time: format(startTime, "HH:mm"),
      client_name: appointment.client_name || "",
      client_email: appointment.client_email || "",
      client_phone: appointment.client_phone || "",
      is_bonus: appointment.is_bonus,
    });
    
    // Load customer note if user_id exists
    if (appointment.user_id && customerNotes[appointment.user_id]) {
      setCustomerNoteText(customerNotes[appointment.user_id].note);
    } else {
      setCustomerNoteText("");
    }
    setIsEditingNote(false);
    setDialogOpen(true);
  };

  const saveCustomerNote = async () => {
    if (!editingAppointment?.user_id) {
      toast.error("Impossibile salvare: nessun cliente associato");
      return;
    }

    if (!customerNoteText.trim()) {
      toast.error("La nota non può essere vuota");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("customer_notes")
        .upsert({
          user_id: editingAppointment.user_id,
          note: customerNoteText.trim(),
          updated_by: user.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success("Nota cliente salvata");
      setIsEditingNote(false);
      
      // Reload notes
      if (selectedDate) loadAppointments(selectedDate);
    } catch (error) {
      console.error("Error saving customer note:", error);
      toast.error("Errore nel salvataggio della nota");
    }
  };

  const deleteCustomerNote = async () => {
    if (!editingAppointment?.user_id) return;

    try {
      const { error } = await supabase
        .from("customer_notes")
        .delete()
        .eq("user_id", editingAppointment.user_id);

      if (error) throw error;

      toast.success("Nota cliente eliminata");
      setCustomerNoteText("");
      setIsEditingNote(false);
      
      // Reload notes
      if (selectedDate) loadAppointments(selectedDate);
    } catch (error) {
      console.error("Error deleting customer note:", error);
      toast.error("Errore nell'eliminazione della nota");
    }
  };

  const openNewDialog = () => {
    setEditingAppointment(null);
    setSelectedCustomer(null);
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
    setFormData({
      date: dateStr,
      time: "09:00",
      client_name: "",
      client_email: "",
      client_phone: "",
      is_bonus: false,
    });
    setCustomerNoteText("");
    setIsEditingNote(false);
    setDialogOpen(true);
  };

  const openNewDialogWithTime = (time: string) => {
    if (!selectedDate) return;
    
    setEditingAppointment(null);
    setSelectedCustomer(null);
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    setFormData({
      date: format(selectedDate, "yyyy-MM-dd"),
      time: time,
      client_name: "",
      client_email: "",
      client_phone: "",
      is_bonus: false,
    });
    setCustomerNoteText("");
    setIsEditingNote(false);
    setDialogOpen(true);
  };

  const handleBlockSlot = async (time: string) => {
    if (!selectedDate) return;
    
    try {
      const [hours, minutes] = time.split(":").map(Number);
      const startTime = `${time}:00`;
      
      const endMinute = (minutes + 45) % 60;
      const endHour = hours + Math.floor((minutes + 45) / 60);
      const endTime = `${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}:00`;
      
      const { error } = await supabase
        .from("slot_blocks")
        .insert({
          day: format(selectedDate, "yyyy-MM-dd"),
          start_time: startTime,
          end_time: endTime,
        });
      
      if (error) throw error;
      
      toast.success("Slot bloccato con successo");
      loadAppointments(selectedDate);
    } catch (error) {
      console.error("Error blocking slot:", error);
      toast.error("Errore nel blocco dello slot");
    }
  };

  const handleUnblockSlot = async (blockId: string) => {
    try {
      const { error } = await supabase
        .from("slot_blocks")
        .delete()
        .eq("id", blockId);
      
      if (error) throw error;
      
      toast.success("Slot sbloccato con successo");
      if (selectedDate) {
        loadAppointments(selectedDate);
      }
    } catch (error) {
      console.error("Error unblocking slot:", error);
      toast.error("Errore nello sblocco dello slot");
    }
  };

  const generateTimeSlots = (date: Date): TimeSlot[] => {
    if (!shopSettings) return [];
    
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayName = dayNames[date.getDay()];
    
    const openHours = shopSettings.open_hours[dayName] || [];
    if (openHours.length === 0) {
      return [];
    }

    const slots: TimeSlot[] = [];
    
    openHours.forEach((range: [string, string]) => {
      const [startHour, endHour] = range;
      const [startH, startM] = startHour.split(":").map(Number);
      const [endH, endM] = endHour.split(":").map(Number);
      
      let currentHour = startH;
      let currentMin = startM;
      
      const endTotalMinutes = endH * 60 + endM;
      
      while (currentHour * 60 + currentMin < endTotalMinutes) {
        const timeString = `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`;
        
        const appointment = appointments.find(apt => {
          const aptStart = toZonedTime(new Date(apt.start_time), timezone);
          return format(aptStart, "HH:mm") === timeString;
        });
        
        if (appointment) {
          slots.push({
            time: timeString,
            type: "appointment",
            appointment
          });
        } else {
          const block = slotBlocks.find(block => {
            const blockStart = block.start_time.substring(0, 5);
            const blockEnd = block.end_time.substring(0, 5);
            return timeString >= blockStart && timeString < blockEnd;
          });
          
          if (block) {
            if (!slots.find(s => s.blockId === block.id)) {
              slots.push({
                time: timeString,
                type: "blocked",
                blockId: block.id
              });
            }
          } else {
            slots.push({
              time: timeString,
              type: "free"
            });
          }
        }
        
        currentMin += 45;
        if (currentMin >= 60) {
          currentMin -= 60;
          currentHour += 1;
        }
      }
    });
    
    return slots;
  };

  const resetForm = () => {
    setFormData({
      date: "",
      time: "",
      client_name: "",
      client_email: "",
      client_phone: "",
      is_bonus: false,
    });
  };

  return (
    <>
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-8">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Calendario</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center overflow-x-auto">
            <div className="min-w-[280px]">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={it}
                className="rounded-md border"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="line-clamp-2">
                  {selectedDate ? format(selectedDate, "EEEE, d MMMM yyyy", { locale: it }) : "Seleziona una data"}
                </span>
              </CardTitle>
              <Button onClick={openNewDialog} className="w-full sm:w-auto flex-shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Nuovo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-hidden">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
            ) : !shopSettings ? (
              <div className="text-center py-8 text-muted-foreground">
                Caricamento impostazioni negozio...
              </div>
            ) : (() => {
              const timeSlots = generateTimeSlots(selectedDate!);
              
              if (timeSlots.length === 0) {
                return (
                  <div className="text-center py-12">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Negozio chiuso in questo giorno</p>
                  </div>
                );
              }
              
              return (
                <>
                  {appointments.some(apt => apt.status === "CANCELED") && (
                    <div className="flex items-center gap-2 mb-4">
                      <Checkbox 
                        id="show-canceled-calendar" 
                        checked={showCanceled}
                        onCheckedChange={(checked) => setShowCanceled(checked === true)}
                      />
                      <label 
                        htmlFor="show-canceled-calendar" 
                        className="text-xs text-destructive cursor-pointer select-none"
                      >
                        Mostra appuntamenti cancellati
                      </label>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {timeSlots
                      .filter(slot => {
                        if (slot.type === "appointment" && slot.appointment) {
                          return showCanceled || slot.appointment.status !== "CANCELED";
                        }
                        return true;
                      })
                      .map((slot, index) => {
                        if (slot.type === "appointment" && slot.appointment) {
                          const apt = slot.appointment;
                          const startTime = toZonedTime(new Date(apt.start_time), timezone);
                          
                          return (
                            <div
                              key={`apt-${apt.id}`}
                              className={`p-3 sm:p-4 rounded-lg border ${
                                apt.is_bonus
                                  ? "bg-accent/10 border-accent"
                                  : apt.status === "CANCELED"
                                  ? "bg-destructive/10 border-destructive"
                                  : "bg-card"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-sm sm:text-base break-words">
                                      {format(startTime, "HH:mm")} - {apt.client_name || "Cliente walk-in"}
                                    </p>
                                    {apt.is_bonus && <Star className="w-4 h-4 text-accent flex-shrink-0" fill="currentColor" />}
                                    {apt.status === "CANCELED" && (
                                      <span className="text-xs text-destructive font-semibold">CANCELLATO</span>
                                    )}
                                  </div>
                                  {apt.client_email && (
                                    <p className="text-xs sm:text-sm text-muted-foreground break-all">{apt.client_email}</p>
                                  )}
                                  {apt.client_phone && (
                                    <p className="text-xs sm:text-sm text-muted-foreground">{apt.client_phone}</p>
                                  )}
                                  {apt.user_id && customerNotes[apt.user_id] && (
                                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 italic break-words bg-muted/30 px-2 py-1 rounded">
                                      {customerNotes[apt.user_id].note}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-2 flex-wrap sm:flex-nowrap flex-shrink-0">
                                  <Button size="sm" variant="outline" onClick={() => openEditDialog(apt)} className="flex-1 sm:flex-none">
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  {apt.status !== "CANCELED" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleCancel(apt.id)}
                                      className="flex-1 sm:flex-none text-xs sm:text-sm"
                                    >
                                      Annulla
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDelete(apt.id)}
                                    className="flex-1 sm:flex-none"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        if (slot.type === "free") {
                          return (
                            <div
                              key={`free-${index}`}
                              className="p-3 rounded-lg border bg-muted/20 border-muted"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-muted-foreground">
                                    {slot.time}
                                  </p>
                                  <p className="text-xs text-muted-foreground">Slot libero</p>
                                </div>
                                <div className="flex gap-2 items-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleBlockSlot(slot.time)}
                                    className="h-8 w-8 p-0"
                                    title="Blocca slot"
                                  >
                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => openNewDialogWithTime(slot.time)}
                                    className="gap-1"
                                  >
                                    <Plus className="w-4 h-4" />
                                    Aggiungi appuntamento
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        if (slot.type === "blocked") {
                          return (
                            <div
                              key={`blocked-${slot.blockId}`}
                              className="p-3 rounded-lg border bg-destructive/5 border-destructive/20"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1 flex items-center gap-2">
                                  <Lock className="w-4 h-4 text-destructive" />
                                  <div>
                                    <p className="text-sm font-medium text-destructive">
                                      {slot.time}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Slot bloccato</p>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUnblockSlot(slot.blockId!)}
                                  className="text-xs"
                                >
                                  Sblocca
                                </Button>
                              </div>
                            </div>
                          );
                        }
                        
                        return null;
                      })}
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden w-full">
          <DialogHeader className="text-center">
            <DialogTitle className="text-center">
              {editingAppointment ? "Modifica Appuntamento" : "Nuovo Appuntamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-2 max-w-md mx-auto w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="relative" data-customer-search>
              <Label htmlFor="client_name">Nome Cliente</Label>
              
              {selectedCustomer ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-accent/10">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedCustomer.email}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeselectCustomer}
                    className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) => {
                      setFormData({ ...formData, client_name: e.target.value });
                      searchCustomers(e.target.value);
                    }}
                    onFocus={() => {
                      if (customerSearchResults.length > 0) {
                        setShowCustomerDropdown(true);
                      }
                    }}
                    placeholder="Cerca cliente esistente o inserisci nuovo nome"
                  />
                  
                  {showCustomerDropdown && customerSearchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {isSearching ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Ricerca in corso...
                        </div>
                      ) : (
                        customerSearchResults.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-b-0"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <p className="font-medium text-sm">{customer.display_name}</p>
                            <p className="text-xs text-muted-foreground">{customer.email}</p>
                            {customer.phone && (
                              <p className="text-xs text-muted-foreground">{customer.phone}</p>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="client_email">Email</Label>
                <Input
                  id="client_email"
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                  disabled={!!selectedCustomer}
                  className={selectedCustomer ? "bg-muted" : ""}
                />
              </div>
              <div>
                <Label htmlFor="client_phone">Telefono</Label>
                <Input
                  id="client_phone"
                  value={formData.client_phone}
                  onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                  disabled={!!selectedCustomer}
                  className={selectedCustomer ? "bg-muted" : ""}
                />
              </div>
            </div>

            {/* Customer Note Section - Shown when editing or when customer is selected */}
            {(editingAppointment?.user_id || selectedCustomer) && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Nota Cliente (Privata)</Label>
                    </div>
                    {!isEditingNote && customerNoteText && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingNote(true)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={deleteCustomerNote}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {isEditingNote || !customerNoteText ? (
                    <div className="space-y-2">
                      <Textarea
                        value={customerNoteText}
                        onChange={(e) => setCustomerNoteText(e.target.value)}
                        placeholder="Aggiungi nota privata sul cliente..."
                        className="min-h-[80px]"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={saveCustomerNote}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Salva Nota
                        </Button>
                        {customerNoteText && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsEditingNote(false);
                              if (editingAppointment.user_id && customerNotes[editingAppointment.user_id]) {
                                setCustomerNoteText(customerNotes[editingAppointment.user_id].note);
                              }
                            }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Annulla
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/30 rounded-md">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {customerNoteText}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Questa nota è visibile solo ai proprietari e persiste per tutti gli appuntamenti del cliente.
                  </p>
                </div>
                <Separator className="my-4" />
              </>
            )}

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
