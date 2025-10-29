import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get shop settings
    const { data: settings } = await supabase
      .from("shop_settings")
      .select("*")
      .single();

    const shopName = settings?.shop_name || "ZIO FRANK";
    const shopAddress = settings?.address || "Via Roma 1, 00100 Roma";
    const shopPhone = settings?.phone || "+39 06 1234567";
    const emailFrom = settings?.email_from || "info@ziofrank.it";
    const timezone = settings?.timezone || "Europe/Rome";
    const websiteUrl = settings?.website_url || "https://tuosito.it";

    // Get today's date in shop timezone
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all confirmed appointments for today
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("*, profiles(name, email)")
      .eq("status", "CONFIRMED")
      .gte("start_time", startOfDay.toISOString())
      .lte("start_time", endOfDay.toISOString());

    if (error) throw error;

    if (!appointments || appointments.length === 0) {
      console.log("No appointments found for today");
      return new Response(
        JSON.stringify({ message: "Nessun appuntamento per oggi" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let emailsSent = 0;
    let emailsFailed = 0;

    // Send reminder to each client
    for (const appointment of appointments) {
      const clientEmail = appointment.client_email || appointment.profiles?.email;
      const clientName = appointment.client_name || appointment.profiles?.name || "Cliente";

      if (!clientEmail) {
        console.log(`Skipping appointment ${appointment.id}: no email available`);
        continue;
      }

      const startTime = new Date(appointment.start_time);
      const timeStr = startTime.toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      });

      try {
        const emailResponse = await resend.emails.send({
          from: `${shopName} <${emailFrom}>`,
          to: [clientEmail],
          subject: `Promemoria - Appuntamento da ${shopName} oggi alle ${timeStr}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333;">⏰ Promemoria Appuntamento</h1>
              <p>Ciao ${clientName},</p>
              <p>Ti ricordiamo che hai un appuntamento <strong>oggi</strong> presso <strong>${shopName}</strong>!</p>
              
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0;">
                <h2 style="margin-top: 0; color: #856404;">Dettagli Appuntamento</h2>
                <p><strong>🕐 Orario:</strong> ${timeStr} (durata 30 minuti)</p>
                <p><strong>📍 Indirizzo:</strong> ${shopAddress}</p>
              </div>

              <p><strong>Ti aspettiamo!</strong></p>
              <p>Se hai bisogno di annullare, fallo dalla pagina "I Miei Appuntamenti" sul nostro sito.</p>
              
              <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #333;">Per effettuare una prenotazione o modificarne una già esistente accedi alla piattaforma dal seguente link:</p>
                <p style="margin: 10px 0 0 0;"><a href="${websiteUrl}" style="color: #2563eb; font-weight: bold;">${websiteUrl}</a></p>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                <p style="color: #666; font-size: 14px;">
                  Per qualsiasi domanda, contattaci:<br>
                  📞 ${shopPhone}<br>
                  📧 ${emailFrom}
                </p>
              </div>
              
              <p style="margin-top: 30px; color: #999; font-size: 12px;">
                Questa è una email automatica. Ti preghiamo di non rispondere direttamente.
              </p>
            </div>
          `,
        });

        console.log(`Reminder sent to ${clientEmail}:`, emailResponse);

        // Log email send
        await supabase.from("email_logs").insert({
          appointment_id: appointment.id,
          type: "REMINDER",
          recipient: clientEmail,
          status: "sent",
        });

        emailsSent++;
      } catch (emailError: any) {
        console.error(`Failed to send reminder to ${clientEmail}:`, emailError);
        
        // Log email failure
        await supabase.from("email_logs").insert({
          appointment_id: appointment.id,
          type: "REMINDER",
          recipient: clientEmail,
          status: "failed",
          error_message: emailError.message,
        });

        emailsFailed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reminder inviati: ${emailsSent}, Falliti: ${emailsFailed}`,
        sent: emailsSent,
        failed: emailsFailed,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-daily-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
