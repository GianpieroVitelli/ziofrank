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

interface CancellationRequest {
  appointment_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { appointment_id }: CancellationRequest = await req.json();

    console.log("Processing cancellation for appointment:", appointment_id);

    // Get appointment details
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select("*, profiles(name, email)")
      .eq("id", appointment_id)
      .single();

    if (aptError || !appointment) {
      console.error("Appointment not found:", aptError);
      throw new Error("Appuntamento non trovato");
    }

    // Get shop settings
    const { data: settings } = await supabase
      .from("shop_settings")
      .select("*")
      .single();

    const shopName = settings?.shop_name || "ZIO FRANK";
    const shopAddress = settings?.address || "Via Roma 1, 00100 Roma";
    const shopPhone = settings?.phone || "+39 06 1234567";
    const emailFrom = settings?.email_from || "info@ziofrank.it";
    const emailBcc = settings?.email_bcc;

    // Format date and time
    const startTime = new Date(appointment.start_time);
    const dateStr = startTime.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeStr = startTime.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const clientEmail = appointment.client_email || appointment.profiles?.email;
    const clientName = appointment.client_name || appointment.profiles?.name || "Cliente";

    if (!clientEmail) {
      console.error("Client email not available");
      throw new Error("Email del cliente non disponibile");
    }

    // Send cancellation email
    const emailResponse = await resend.emails.send({
      from: `${shopName} <onboarding@resend.dev>`,
      to: [clientEmail],
      bcc: emailBcc ? [emailBcc] : undefined,
      subject: `${shopName} - Prenotazione cancellata`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626;">Prenotazione Cancellata</h1>
          <p>Ciao ${clientName},</p>
          <p>La tua prenotazione presso <strong>${shopName}</strong> è stata cancellata.</p>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h2 style="margin-top: 0; color: #991b1b;">Dettagli Appuntamento Cancellato</h2>
            <p><strong>📅 Data:</strong> ${dateStr}</p>
            <p><strong>🕐 Orario:</strong> ${timeStr}</p>
            <p><strong>📍 Indirizzo:</strong> ${shopAddress}</p>
          </div>

          <p><strong>Vuoi prenotare un nuovo appuntamento?</strong></p>
          <p>Puoi farlo in qualsiasi momento visitando il nostro sito web.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">
              Per qualsiasi domanda o per riprenotare, contattaci:<br>
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

    console.log("Cancellation email sent successfully:", emailResponse);

    // Log email send
    await supabase.from("email_logs").insert({
      appointment_id,
      type: "CANCELLATION",
      recipient: clientEmail,
      status: "sent",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Email di cancellazione inviata" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-cancellation function:", error);
    
    // Log failed email
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { appointment_id } = await req.json();
      await supabase.from("email_logs").insert({
        appointment_id,
        type: "CANCELLATION",
        recipient: "unknown",
        status: "failed",
        error_message: error.message,
      });
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }
    
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
