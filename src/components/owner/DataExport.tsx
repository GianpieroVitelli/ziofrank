import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Users, Calendar, Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { format, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { it } from "date-fns/locale";

interface CustomerExportData {
  Nome: string;
  Email: string;
  Telefono: string;
  "Appuntamenti Confermati": number;
  "Note Private": string;
  "Stato": string;
  "Ultimo Appuntamento": string;
}

interface AppointmentExportData {
  Data: string;
  Ora: string;
  "Nome Cliente": string;
  Email: string;
  Telefono: string;
  Stato: string;
  "Tipo": string;
  Note: string;
}

type Period = "day" | "week" | "month" | "year";

export const DataExport = () => {
  const [exportingCustomers, setExportingCustomers] = useState(false);
  const [exportingAppointments, setExportingAppointments] = useState(false);
  const [showPeriodSelection, setShowPeriodSelection] = useState(false);

  const exportCustomers = async () => {
    setExportingCustomers(true);
    try {
      toast.info("Generazione file in corso...");

      // Query tutti i profili
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email, phone, is_blocked")
        .order("name");

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        toast.error("Nessun cliente trovato");
        return;
      }

      const exportData: CustomerExportData[] = [];

      // Per ogni profilo, raccogliamo le informazioni
      for (const profile of profiles) {
        // Conta appuntamenti confermati
        const { count } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("status", "CONFIRMED");

        // Prendi ultima data appuntamento
        const { data: lastApt } = await supabase
          .from("appointments")
          .select("start_time")
          .eq("user_id", profile.id)
          .eq("status", "CONFIRMED")
          .order("start_time", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Prendi note cliente
        const { data: note } = await supabase
          .from("customer_notes")
          .select("note")
          .eq("user_id", profile.id)
          .maybeSingle();

        exportData.push({
          Nome: profile.name || "-",
          Email: profile.email || "-",
          Telefono: profile.phone || "-",
          "Appuntamenti Confermati": count || 0,
          "Note Private": note?.note || "-",
          "Stato": profile.is_blocked ? "Bloccato" : "Attivo",
          "Ultimo Appuntamento": lastApt?.start_time
            ? format(new Date(lastApt.start_time), "dd/MM/yyyy", { locale: it })
            : "-",
        });
      }

      // Genera Excel
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clienti");

      // Auto-size columns
      const maxWidth = exportData.reduce((w, r) => Math.max(w, r.Nome.length), 10);
      ws["!cols"] = [
        { wch: maxWidth },
        { wch: 25 },
        { wch: 15 },
        { wch: 20 },
        { wch: 30 },
        { wch: 10 },
        { wch: 18 },
      ];

      // Download
      const timestamp = format(new Date(), "yyyyMMdd_HHmmss");
      XLSX.writeFile(wb, `clienti_${timestamp}.xlsx`);

      toast.success(`File scaricato con successo! (${exportData.length} clienti)`);
    } catch (error: any) {
      console.error("Error exporting customers:", error);
      toast.error("Errore durante l'esportazione dei clienti");
    } finally {
      setExportingCustomers(false);
    }
  };

  const exportAppointments = async (period: Period) => {
    setExportingAppointments(true);
    try {
      toast.info("Generazione file in corso...");

      const now = new Date();
      let endDate: Date;
      let periodLabel: string;

      switch (period) {
        case "day":
          endDate = addDays(now, 1);
          periodLabel = "oggi";
          break;
        case "week":
          endDate = addWeeks(now, 1);
          periodLabel = "settimana";
          break;
        case "month":
          endDate = addMonths(now, 1);
          periodLabel = "mese";
          break;
        case "year":
          endDate = addYears(now, 1);
          periodLabel = "anno";
          break;
      }

      // Query appuntamenti futuri confermati
      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select("start_time, end_time, client_name, client_email, client_phone, status, is_bonus, notes")
        .eq("status", "CONFIRMED")
        .gte("start_time", now.toISOString())
        .lte("start_time", endDate.toISOString())
        .order("start_time");

      if (appointmentsError) throw appointmentsError;

      if (!appointments || appointments.length === 0) {
        toast.error(`Nessun appuntamento trovato per ${periodLabel}`);
        return;
      }

      const exportData: AppointmentExportData[] = appointments.map((apt) => ({
        Data: format(new Date(apt.start_time), "dd/MM/yyyy", { locale: it }),
        Ora: format(new Date(apt.start_time), "HH:mm", { locale: it }),
        "Nome Cliente": apt.client_name || "-",
        Email: apt.client_email || "-",
        Telefono: apt.client_phone || "-",
        Stato: "Confermato",
        "Tipo": apt.is_bonus ? "BONUS" : "Normale",
        Note: apt.notes || "-",
      }));

      // Genera Excel
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Appuntamenti");

      // Auto-size columns
      ws["!cols"] = [
        { wch: 12 },
        { wch: 8 },
        { wch: 20 },
        { wch: 25 },
        { wch: 15 },
        { wch: 12 },
        { wch: 10 },
        { wch: 30 },
      ];

      // Download
      const timestamp = format(new Date(), "yyyyMMdd_HHmmss");
      XLSX.writeFile(wb, `appuntamenti_${periodLabel}_${timestamp}.xlsx`);

      toast.success(`File scaricato con successo! (${exportData.length} appuntamenti)`);
      setShowPeriodSelection(false);
    } catch (error: any) {
      console.error("Error exporting appointments:", error);
      toast.error("Errore durante l'esportazione degli appuntamenti");
    } finally {
      setExportingAppointments(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Card Lista Clienti */}
      <Card className="transition-shadow hover:shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="w-10 h-10 text-primary" />
            <div>
              <CardTitle>Lista Clienti</CardTitle>
              <CardDescription>
                Esporta tutti i clienti con statistiche complete
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={exportCustomers}
            disabled={exportingCustomers}
            className="w-full"
            size="lg"
          >
            {exportingCustomers ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generazione in corso...
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Scarica Lista Clienti
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Card Appuntamenti */}
      <Card className="transition-shadow hover:shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Calendar className="w-10 h-10 text-primary" />
            <div>
              <CardTitle>Appuntamenti Futuri</CardTitle>
              <CardDescription>
                Esporta appuntamenti confermati per periodo
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => setShowPeriodSelection(!showPeriodSelection)}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <Calendar className="mr-2 h-5 w-5" />
            {showPeriodSelection ? "Nascondi Opzioni" : "Seleziona Periodo"}
          </Button>

          {showPeriodSelection && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                onClick={() => exportAppointments("day")}
                disabled={exportingAppointments}
                variant="secondary"
                className="h-20 flex flex-col"
              >
                {exportingAppointments ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Calendar className="h-5 w-5 mb-1" />
                    <span className="font-semibold">Oggi</span>
                    <span className="text-xs text-muted-foreground">
                      Prossime 24h
                    </span>
                  </>
                )}
              </Button>

              <Button
                onClick={() => exportAppointments("week")}
                disabled={exportingAppointments}
                variant="secondary"
                className="h-20 flex flex-col"
              >
                {exportingAppointments ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Calendar className="h-5 w-5 mb-1" />
                    <span className="font-semibold">Settimana</span>
                    <span className="text-xs text-muted-foreground">
                      Prossimi 7 giorni
                    </span>
                  </>
                )}
              </Button>

              <Button
                onClick={() => exportAppointments("month")}
                disabled={exportingAppointments}
                variant="secondary"
                className="h-20 flex flex-col"
              >
                {exportingAppointments ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Calendar className="h-5 w-5 mb-1" />
                    <span className="font-semibold">Mese</span>
                    <span className="text-xs text-muted-foreground">
                      Prossimi 30 giorni
                    </span>
                  </>
                )}
              </Button>

              <Button
                onClick={() => exportAppointments("year")}
                disabled={exportingAppointments}
                variant="secondary"
                className="h-20 flex flex-col"
              >
                {exportingAppointments ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Calendar className="h-5 w-5 mb-1" />
                    <span className="font-semibold">Anno</span>
                    <span className="text-xs text-muted-foreground">
                      Prossimi 365 giorni
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
