import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Mail, Phone, Edit, Trash2, Save, X, Users } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface Customer {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  last_appointment_at: string | null;
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
      // Build query for customers
      let query = supabase.rpc("get_customers", {
        search_query: searchQuery || null,
        sort_order: sortBy
      });

      const { data: customersData, error: customersError } = await query;

      if (customersError) throw customersError;

      // Get total count for pagination
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .ilike("name", `%${searchQuery}%`);

      setTotalCount(count || 0);

      // Paginate manually
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginatedCustomers = (customersData || []).slice(start, end);

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
      }
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
          {/* Search and filters */}
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

          {/* Customers list */}
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
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span>{customer.display_name}</span>
                      </CardTitle>
                      <div className="flex gap-4 text-sm text-muted-foreground">
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
                      </div>
                      <p className="text-sm text-muted-foreground">
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

          {/* Pagination */}
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
