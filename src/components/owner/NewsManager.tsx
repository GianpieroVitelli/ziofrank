import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface News {
  id: string;
  title: string;
  body: string;
  status: "DRAFT" | "PUBLISHED";
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
}

export const NewsManager = () => {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    is_featured: false,
  });

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    try {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNews(data || []);
    } catch (error: any) {
      console.error("Error loading news:", error);
      toast.error("Errore nel caricamento delle notizie");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.title.trim() || !formData.body.trim()) {
        toast.error("Titolo e contenuto sono obbligatori");
        return;
      }

      if (editingNews) {
        const { error } = await supabase
          .from("news")
          .update({
            title: formData.title,
            body: formData.body,
            is_featured: formData.is_featured,
          })
          .eq("id", editingNews.id);

        if (error) throw error;
        toast.success("Notizia aggiornata");
      } else {
        const { error } = await supabase.from("news").insert({
          title: formData.title,
          body: formData.body,
          is_featured: formData.is_featured,
          status: "DRAFT",
        });

        if (error) throw error;
        toast.success("Notizia creata");
      }

      setDialogOpen(false);
      setEditingNews(null);
      setFormData({ title: "", body: "", is_featured: false });
      loadNews();
    } catch (error: any) {
      console.error("Error saving news:", error);
      toast.error("Errore nel salvataggio");
    }
  };

  const handlePublishToggle = async (newsItem: News) => {
    try {
      const newStatus = newsItem.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      const { error } = await supabase
        .from("news")
        .update({
          status: newStatus,
          published_at: newStatus === "PUBLISHED" ? new Date().toISOString() : null,
        })
        .eq("id", newsItem.id);

      if (error) throw error;
      toast.success(newStatus === "PUBLISHED" ? "Notizia pubblicata" : "Notizia messa in bozza");
      loadNews();
    } catch (error: any) {
      console.error("Error toggling publish:", error);
      toast.error("Errore nell'aggiornamento dello stato");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa notizia?")) return;

    try {
      const { error } = await supabase.from("news").delete().eq("id", id);

      if (error) throw error;
      toast.success("Notizia eliminata");
      loadNews();
    } catch (error: any) {
      console.error("Error deleting news:", error);
      toast.error("Errore nell'eliminazione");
    }
  };

  const openEditDialog = (newsItem: News) => {
    setEditingNews(newsItem);
    setFormData({
      title: newsItem.title,
      body: newsItem.body,
      is_featured: newsItem.is_featured,
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingNews(null);
    setFormData({ title: "", body: "", is_featured: false });
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="text-center py-8">Caricamento...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Bacheca Notizie</CardTitle>
            <Button onClick={openNewDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Nuova Notizia
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {news.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nessuna notizia presente
            </p>
          ) : (
            <div className="space-y-3">
              {news.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border ${
                    item.is_featured ? "bg-accent/10 border-accent" : "bg-card"
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{item.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {item.body}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            item.status === "PUBLISHED"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {item.status === "PUBLISHED" ? "Pubblicata" : "Bozza"}
                        </span>
                        {item.is_featured && (
                          <span className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground">
                            In evidenza
                          </span>
                        )}
                        {item.published_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.published_at), "d MMM yyyy", { locale: it })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePublishToggle(item)}
                      >
                        {item.status === "PUBLISHED" ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(item)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingNews ? "Modifica Notizia" : "Nuova Notizia"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Titolo</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Inserisci il titolo"
              />
            </div>
            <div>
              <Label htmlFor="body">Contenuto</Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Inserisci il contenuto"
                rows={8}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="featured"
                checked={formData.is_featured}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_featured: checked })
                }
              />
              <Label htmlFor="featured">Mostra in evidenza sulla home</Label>
            </div>
            <div className="flex justify-end gap-2">
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
