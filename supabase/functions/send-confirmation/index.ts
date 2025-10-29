import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  appointment_id: z.string().uuid("Invalid appointment ID format"),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
    const body = await req.json();
    const validationResult = requestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const { appointment_id } = validationResult.data;
    
    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get appointment details
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointment_id)
      .single();

    if (aptError || !appointment) {
      console.error("Appointment not found:", aptError);
      return new Response(
        JSON.stringify({ error: "Appuntamento non trovato" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Verify authorization: user owns the appointment OR user is owner (PROPRIETARIO role)
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    const isOwner = userRoles?.some(r => r.role === "PROPRIETARIO");
    const ownsAppointment = appointment.user_id === user.id;
    
    if (!isOwner && !ownsAppointment) {
      return new Response(
        JSON.stringify({ error: "Non autorizzato ad accedere a questo appuntamento" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
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
    const websiteUrl = settings?.website_url || "https://tuosito.it";

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

    const clientEmail = appointment.client_email;
    const clientName = appointment.client_name || "Cliente";

    if (!clientEmail) {
      throw new Error("Email del cliente non disponibile");
    }

    // Send email to client (and BCC to shop)
    const emailResponse = await resend.emails.send({
      from: `${shopName} <${emailFrom}>`,
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
