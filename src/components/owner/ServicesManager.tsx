import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical, Clock, Euro } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

interface ShopSettings {
  show_prices_to_customers: boolean;
}

export const ServicesManager = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showPrices, setShowPrices] = useState(true);
  const [savingPrices, setSavingPrices] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    duration_minutes: 45,
    price: "",
    description: "",
    is_active: true,
  });

  useEffect(() => {
    loadServices();
    loadSettings();
  }, []);

  const loadServices = async () => {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error("Errore nel caricamento dei servizi");
      console.error(error);
    } else {
      setServices(data || []);
    }
    setLoading(false);
  };

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("shop_settings")
      .select("show_prices_to_customers")
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setShowPrices(data.show_prices_to_customers);
    }
  };

  const handleShowPricesChange = async (checked: boolean) => {
    setSavingPrices(true);
    const { error } = await supabase
      .from("shop_settings")
      .update({ show_prices_to_customers: checked })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Update all rows

    if (error) {
      toast.error("Errore nel salvare l'impostazione");
      console.error(error);
    } else {
      setShowPrices(checked);
      toast.success(checked ? "Prezzi visibili ai clienti" : "Prezzi nascosti ai clienti");
    }
    setSavingPrices(false);
  };

  const openNewDialog = () => {
    setEditingService(null);
    setFormData({
      name: "",
      duration_minutes: 45,
      price: "",
      description: "",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      duration_minutes: service.duration_minutes,
      price: service.price ? service.price.toString() : "",
      description: service.description || "",
      is_active: service.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Il nome del servizio è obbligatorio");
      return;
    }

    if (formData.duration_minutes < 15 || formData.duration_minutes > 240) {
      toast.error("La durata deve essere tra 15 e 240 minuti");
      return;
    }

    const serviceData = {
      name: formData.name.trim(),
      duration_minutes: formData.duration_minutes,
      price: formData.price ? parseFloat(formData.price) : null,
      description: formData.description.trim() || null,
      is_active: formData.is_active,
    };

    if (editingService) {
      // Update existing service
      const { error } = await supabase
        .from("services")
        .update(serviceData)
        .eq("id", editingService.id);

      if (error) {
        toast.error("Errore nell'aggiornamento del servizio");
        console.error(error);
      } else {
        toast.success("Servizio aggiornato");
        setDialogOpen(false);
        loadServices();
      }
    } else {
      // Create new service
      const maxSortOrder = services.length > 0 
        ? Math.max(...services.map(s => s.sort_order)) + 1 
        : 0;

      const { error } = await supabase
        .from("services")
        .insert({ ...serviceData, sort_order: maxSortOrder });

      if (error) {
        toast.error("Errore nella creazione del servizio");
        console.error(error);
      } else {
        toast.success("Servizio creato");
        setDialogOpen(false);
        loadServices();
      }
    }
  };

  const confirmDelete = (service: Service) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!serviceToDelete) return;

    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", serviceToDelete.id);

    if (error) {
      if (error.code === "23503") {
        toast.error("Impossibile eliminare: il servizio è associato a degli appuntamenti");
      } else {
        toast.error("Errore nell'eliminazione del servizio");
        console.error(error);
      }
    } else {
      toast.success("Servizio eliminato");
      loadServices();
    }
    setDeleteDialogOpen(false);
    setServiceToDelete(null);
  };

  const toggleActive = async (service: Service) => {
    const { error } = await supabase
      .from("services")
      .update({ is_active: !service.is_active })
      .eq("id", service.id);

    if (error) {
      toast.error("Errore nell'aggiornamento");
      console.error(error);
    } else {
      toast.success(service.is_active ? "Servizio disattivato" : "Servizio attivato");
      loadServices();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con toggle prezzi */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Switch
                id="show-prices"
                checked={showPrices}
                onCheckedChange={handleShowPricesChange}
                disabled={savingPrices}
              />
              <Label htmlFor="show-prices" className="cursor-pointer">
                Mostra prezzi ai clienti durante la prenotazione
              </Label>
            </div>
            <Button onClick={openNewDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Servizio
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista servizi */}
      {services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nessun servizio configurato. Crea il tuo primo servizio!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <Card
              key={service.id}
              className={`transition-opacity ${!service.is_active ? "opacity-60" : ""}`}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab hidden sm:block" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{service.name}</h3>
                      {!service.is_active && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                          Disattivato
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {service.duration_minutes} min
                      </span>
                      {service.price !== null && (
                        <span className="flex items-center gap-1">
                          <Euro className="w-4 h-4" />
                          {service.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                    
                    {service.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {service.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(service)}
                      title={service.is_active ? "Disattiva" : "Attiva"}
                    >
                      <Switch checked={service.is_active} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(service)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => confirmDelete(service)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog creazione/modifica */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Modifica Servizio" : "Nuovo Servizio"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome servizio *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="es. Taglio Classico"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Durata (minuti) *</Label>
              <Input
                id="duration"
                type="number"
                min={15}
                max={240}
                step={5}
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 45 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Prezzo indicativo (€)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.5}
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="es. 20.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrizione opzionale del servizio"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Servizio attivo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave}>
              {editingService ? "Salva Modifiche" : "Crea Servizio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog conferma eliminazione */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il servizio?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare "{serviceToDelete?.name}". 
              Questa azione non può essere annullata.
              {"\n\n"}
              Se il servizio è associato a degli appuntamenti, non potrà essere eliminato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
