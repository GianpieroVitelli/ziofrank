import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationRequest {
  appointment_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { appointment_id }: ConfirmationRequest = await req.json();

    // Get appointment details
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select("*, profiles(name, email)")
      .eq("id", appointment_id)
      .single();

    if (aptError || !appointment) {
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
      throw new Error("Email del cliente non disponibile");
    }

    // Send email to client (and BCC to shop)
    const emailResponse = await resend.emails.send({
      from: `${shopName} <onboarding@resend.dev>`,
      to: [clientEmail],
      bcc: emailBcc ? [emailBcc] : undefined,
      subject: `${shopName} - Prenotazione confermata`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Prenotazione Confermata</h1>
          <p>Ciao ${clientName},</p>
          <p>La tua prenotazione presso <strong>${shopName}</strong> è stata confermata!</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #333;">Dettagli Appuntamento</h2>
            <p><strong>📅 Data:</strong> ${dateStr}</p>
            <p><strong>🕐 Orario:</strong> ${timeStr} (durata 30 minuti)</p>
            <p><strong>📍 Indirizzo:</strong> ${shopAddress}</p>
          </div>

          <p><strong>Hai bisogno di modificare l'appuntamento?</strong></p>
          <p>Puoi annullare la tua prenotazione dalla pagina "I Miei Appuntamenti" sul nostro sito.</p>
          
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

    console.log("Confirmation email sent successfully:", emailResponse);

    // Log email send
    await supabase.from("email_logs").insert({
      appointment_id,
      type: "CONFIRMATION",
      recipient: clientEmail,
      status: "sent",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Email di conferma inviata" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-confirmation function:", error);
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
