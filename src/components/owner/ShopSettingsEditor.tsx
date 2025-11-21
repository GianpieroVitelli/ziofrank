import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { OpenHoursEditor } from "./OpenHoursEditor";

interface ShopSettings {
  id: string;
  shop_name: string;
  description: string;
  address: string;
  phone: string;
  email_from: string;
  social_links: any;
  open_hours: any;
  reminder_hour: number;
  reminder_hour_next_day: number;
}

export const ShopSettingsEditor = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ShopSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("shop_settings")
        .select("*")
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error: any) {
      console.error("Error loading settings:", error);
      toast.error("Errore nel caricamento delle impostazioni");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from("shop_settings")
        .update({
          shop_name: settings.shop_name,
          description: settings.description,
          address: settings.address,
          phone: settings.phone,
          email_from: settings.email_from,
          social_links: settings.social_links,
          open_hours: settings.open_hours,
          reminder_hour: settings.reminder_hour,
          reminder_hour_next_day: settings.reminder_hour_next_day,
        })
        .eq("id", settings.id);

      if (error) throw error;
      toast.success("Impostazioni salvate con successo");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Caricamento...</div>;
  }

  if (!settings) {
    return <div className="text-center py-8">Nessuna impostazione trovata</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modifica Contenuti Home</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="shop_name">Nome Negozio</Label>
            <Input
              id="shop_name"
              value={settings.shop_name}
              onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={settings.description || ""}
              onChange={(e) => setSettings({ ...settings, description: e.target.value })}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="address">Indirizzo</Label>
            <Input
              id="address"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email_from}
                onChange={(e) => setSettings({ ...settings, email_from: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="font-semibold mb-4">Social Media</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="facebook">Facebook (URL completo)</Label>
                <Input
                  id="facebook"
                  value={settings.social_links?.facebook || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      social_links: { ...settings.social_links, facebook: e.target.value },
                    })
                  }
                  placeholder="https://facebook.com/..."
                />
              </div>

              <div>
                <Label htmlFor="instagram">Instagram (URL completo)</Label>
                <Input
                  id="instagram"
                  value={settings.social_links?.instagram || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      social_links: { ...settings.social_links, instagram: e.target.value },
                    })
                  }
                  placeholder="https://instagram.com/..."
                />
              </div>

              <div>
                <Label htmlFor="whatsapp">WhatsApp (numero con prefisso)</Label>
                <Input
                  id="whatsapp"
                  value={settings.social_links?.whatsapp || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      social_links: { ...settings.social_links, whatsapp: e.target.value },
                    })
                  }
                  placeholder="+39..."
                />
              </div>
            </div>
          </div>

          <OpenHoursEditor
            openHours={settings.open_hours}
            onChange={(openHours) => setSettings({ ...settings, open_hours: openHours })}
          />

          <div className="border-t pt-4 mt-4">
            <h3 className="font-semibold mb-4">Orari Invio Reminder</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reminder_hour">Reminder Appuntamenti di Oggi (ore)</Label>
                <Input
                  id="reminder_hour"
                  type="number"
                  min="0"
                  max="23"
                  value={settings.reminder_hour}
                  onChange={(e) => setSettings({ ...settings, reminder_hour: parseInt(e.target.value) || 8 })}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Orario di invio reminder per appuntamenti del giorno stesso
                </p>
              </div>

              <div>
                <Label htmlFor="reminder_hour_next_day">Reminder Appuntamenti di Domani (ore)</Label>
                <Input
                  id="reminder_hour_next_day"
                  type="number"
                  min="0"
                  max="23"
                  value={settings.reminder_hour_next_day}
                  onChange={(e) => setSettings({ ...settings, reminder_hour_next_day: parseInt(e.target.value) || 10 })}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Orario di invio reminder il giorno prima dell'appuntamento
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Salvataggio..." : "Salva Modifiche"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
