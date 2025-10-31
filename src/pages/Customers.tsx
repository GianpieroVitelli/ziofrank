import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Search, Mail, Phone, Edit, Trash2, Save, X, Users, Camera, UserCircle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface Customer {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  last_appointment_at: string | null;
  customer_photo: string | null;
}

interface CustomerNote {
  id: string;
  user_id: string;
  note: string;
  updated_at: string;
  updated_by: string;
}

const Customers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [notes, setNotes] = useState<Record<string, CustomerNote>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"alpha" | "last">("alpha");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const pageSize = 25;

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (!roles || !roles.some(r => r.role === "PROPRIETARIO")) {
        navigate("/prenota");
        return;
      }
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    loadCustomers();
  }, [searchQuery, sortBy, page]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      // Build query for customers from profiles
      let query = supabase
        .from("profiles")
        .select("id, name, email, phone, customer_photo", { count: "exact" });

      // Apply search filter
      if (searchQuery && searchQuery.trim()) {
        const searchTerm = `%${searchQuery.trim()}%`;
        query = query.or(`name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`);
      }

      // Get data with count
      const { data: profilesData, error: profilesError, count } = await query;

      if (profilesError) throw profilesError;

      setTotalCount(count || 0);

      // Get appointments to find last appointment date
      const profileIds = (profilesData || []).map(p => p.id);
      
      let appointmentsData: Array<{ user_id: string; start_time: string }> = [];
      
      if (profileIds.length > 0) {
        const { data: apptData } = await supabase
          .from("appointments")
          .select("user_id, start_time")
          .in("user_id", profileIds)
          .eq("status", "CONFIRMED")
          .order("start_time", { ascending: false });
        
        appointmentsData = apptData || [];
      }

      // Map last appointment per user
      const lastAppointmentMap: Record<string, string> = {};
      appointmentsData.forEach(apt => {
        if (!lastAppointmentMap[apt.user_id]) {
          lastAppointmentMap[apt.user_id] = apt.start_time;
        }
      });

      // Combine data
      let customersWithAppointments: Customer[] = (profilesData || []).map(p => ({
        id: p.id,
        display_name: p.name,
        email: p.email,
        phone: p.phone,
        last_appointment_at: lastAppointmentMap[p.id] || null,
        customer_photo: p.customer_photo
      }));

      // Sort
      if (sortBy === "alpha") {
        customersWithAppointments.sort((a, b) =>
          a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase())
        );
      } else {
        customersWithAppointments.sort((a, b) => {
          if (!a.last_appointment_at && !b.last_appointment_at) {
            return a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase());
          }
          if (!a.last_appointment_at) return 1;
          if (!b.last_appointment_at) return -1;
          return new Date(b.last_appointment_at).getTime() - new Date(a.last_appointment_at).getTime();
        });
      }

      // Paginate
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginatedCustomers = customersWithAppointments.slice(start, end);

      setCustomers(paginatedCustomers);

      // Load notes for these customers
      const customerIds = paginatedCustomers.map(c => c.id);
      if (customerIds.length > 0) {
        const { data: notesData } = await supabase
          .from("customer_notes")
          .select("*")
          .in("user_id", customerIds);

        const notesMap: Record<string, CustomerNote> = {};
        (notesData || []).forEach(note => {
          notesMap[note.user_id] = note;
        });
        setNotes(notesMap);
      } else {
        setNotes({});
      }

      // Load photo URLs
      const urlsMap: Record<string, string> = {};
      for (const customer of paginatedCustomers) {
        if (customer.customer_photo) {
          const { data } = await supabase.storage
            .from("customer-photos")
            .createSignedUrl(customer.customer_photo, 3600);
          
          if (data?.signedUrl) {
            urlsMap[customer.id] = data.signedUrl;
          }
        }
      }
      setPhotoUrls(urlsMap);
    } catch (error) {
      console.error("Error loading customers:", error);
      toast.error("Errore nel caricamento dei clienti");
    } finally {
      setLoading(false);
    }
  };

  const startEditNote = (customerId: string, existingNote?: string) => {
    setEditingNoteId(customerId);
    setNoteText(existingNote || "");
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setNoteText("");
  };

  const saveNote = async (customerId: string) => {
    if (!noteText.trim()) {
      toast.error("La nota non può essere vuota");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("customer_notes")
        .upsert({
          user_id: customerId,
          note: noteText.trim(),
          updated_by: user.id,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success("Nota salvata");
      setEditingNoteId(null);
      setNoteText("");
      loadCustomers();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Errore nel salvataggio della nota");
    }
  };

  const deleteNote = async (customerId: string) => {
    try {
      const { error } = await supabase
        .from("customer_notes")
        .delete()
        .eq("user_id", customerId);

      if (error) throw error;

      toast.success("Nota eliminata");
      loadCustomers();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Errore nell'eliminazione della nota");
    }
  };

  const uploadPhoto = async (customerId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Seleziona un'immagine valida");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'immagine deve essere inferiore a 5MB");
      return;
    }

    setUploadingPhoto(customerId);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${customerId}-${Date.now()}.${fileExt}`;

      // Delete old photo if exists
      const customer = customers.find(c => c.id === customerId);
      if (customer?.customer_photo) {
        await supabase.storage
          .from("customer-photos")
          .remove([customer.customer_photo]);
      }

      // Upload new photo
      const { error: uploadError } = await supabase.storage
        .from("customer-photos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Update profile with photo path
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ customer_photo: fileName })
        .eq("id", customerId);

      if (updateError) throw updateError;

      toast.success("Foto caricata");
      loadCustomers();
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Errore nel caricamento della foto");
    } finally {
      setUploadingPhoto(null);
    }
  };

  const deletePhoto = async (customerId: string) => {
    try {
      const customer = customers.find(c => c.id === customerId);
      if (!customer?.customer_photo) return;

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from("customer-photos")
        .remove([customer.customer_photo]);

      if (deleteError) throw deleteError;

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ customer_photo: null })
        .eq("id", customerId);

      if (updateError) throw updateError;

      toast.success("Foto eliminata");
      loadCustomers();
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error("Errore nell'eliminazione della foto");
    }
  };

  const triggerFileInput = (customerId: string) => {
    const input = document.getElementById(`photo-input-${customerId}`) as HTMLInputElement;
    if (input) {
      input.click();
    }
  };

  const handleFileSelect = (customerId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadPhoto(customerId, file);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <div>
              <h1 className="text-2xl font-bold">Clienti</h1>
              <p className="text-sm text-primary-foreground/80">Gestisci contatti e note</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca nome, email o telefono..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={sortBy === "alpha" ? "default" : "outline"}
                onClick={() => setSortBy("alpha")}
                size="sm"
              >
                Alfabetico (A→Z)
              </Button>
              <Button
                variant={sortBy === "last" ? "default" : "outline"}
                onClick={() => setSortBy("last")}
                size="sm"
              >
                Ultimo Appuntamento
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              {totalCount} {totalCount === 1 ? "cliente" : "clienti"} trovati
            </p>
          </div>

          {loading ? (
            <div className="text-center py-8">Caricamento...</div>
          ) : customers.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nessun cliente trovato
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {customers.map((customer) => {
                const note = notes[customer.id];
                const isEditing = editingNoteId === customer.id;

                return (
                  <Card key={customer.id}>
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <Avatar className="w-20 h-20">
                            <AvatarImage src={photoUrls[customer.id]} alt={customer.display_name} />
                            <AvatarFallback>
                              <UserCircle className="w-12 h-12 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                          <input
                            id={`photo-input-${customer.id}`}
                            type="file"
                            onChange={(e) => handleFileSelect(customer.id, e)}
                            accept="image/*"
                            className="hidden"
                          />
                          <Button
                            size="icon"
                            variant="secondary"
                            className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full shadow-lg"
                            onClick={() => triggerFileInput(customer.id)}
                            disabled={uploadingPhoto === customer.id}
                          >
                            <Camera className="w-4 h-4" />
                          </Button>
                          {customer.customer_photo && (
                            <Button
                              size="icon"
                              variant="destructive"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg"
                              onClick={() => deletePhoto(customer.id)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2">{customer.display_name}</CardTitle>
                          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                            <a
                              href={`mailto:${customer.email}`}
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              <Mail className="w-4 h-4" />
                              {customer.email}
                            </a>
                            {customer.phone ? (
                              <a
                                href={`tel:${customer.phone}`}
                                className="flex items-center gap-1 hover:text-primary"
                              >
                                <Phone className="w-4 h-4" />
                                {customer.phone}
                              </a>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground/50">
                                <Phone className="w-4 h-4" />—
                              </span>
                            )}
                            <p className="text-sm">
                              Ultimo appuntamento:{" "}
                              {customer.last_appointment_at
                                ? new Date(customer.last_appointment_at).toLocaleDateString("it-IT", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Nota privata:</span>
                          {!isEditing && note && (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditNote(customer.id, note.note)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteNote(customer.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder="Aggiungi nota privata..."
                              className="min-h-[80px]"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveNote(customer.id)}>
                                <Save className="w-4 h-4 mr-2" />
                                Salva
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditNote}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Annulla
                              </Button>
                            </div>
                          </div>
                        ) : note ? (
                          <div className="text-sm">
                            <p className="text-muted-foreground whitespace-pre-wrap">
                              {note.note}
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                              Modificata{" "}
                              {formatDistanceToNow(new Date(note.updated_at), {
                                addSuffix: true,
                                locale: it,
                              })}
                            </p>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditNote(customer.id)}
                          >
                            Aggiungi nota
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Precedente
              </Button>
              <span className="flex items-center px-4">
                Pagina {page} di {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Successiva
              </Button>
            </div>
          )}
        </div>
      </main>

      <BottomNav isAuthenticated={true} isOwner={true} />
    </div>
  );
};

export default Customers;