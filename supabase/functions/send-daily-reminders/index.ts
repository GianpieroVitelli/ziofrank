import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { format } from "https://esm.sh/v135/date-fns@3.6.0";
import { toZonedTime } from "https://esm.sh/v135/date-fns-tz@3.2.0";
import { it } from "https://esm.sh/v135/date-fns@3.6.0/locale/it";

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

    // Get shop settings first to check timezone and reminder_hour
    const { data: settings } = await supabase
      .from("shop_settings")
      .select("*")
      .single();

    const timezone = settings?.timezone || "Europe/Rome";
    const reminderHour = settings?.reminder_hour || 10;

    // Check current hour in the shop's timezone
    const nowUTC = new Date();
    const nowLocal = toZonedTime(nowUTC, timezone);
    const currentHour = nowLocal.getHours();

    console.log(`Current time: ${nowUTC.toISOString()} (UTC) = ${format(nowLocal, "HH:mm")} (${timezone})`);
    console.log(`Reminder hour configured: ${reminderHour}, current hour: ${currentHour}`);

    // Only proceed if current hour matches reminder_hour
    if (currentHour !== reminderHour) {
      console.log(`Not the right time to send reminders. Waiting for ${reminderHour}:00`);
      return new Response(
        JSON.stringify({ message: `Attesa per l'orario configurato (${reminderHour}:00)` }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`✓ Correct time for sending reminders!`);

    // Parse request body to get days_ahead parameter
    let daysAhead = 0; // default: reminder for today
    try {
      const body = await req.json();
      daysAhead = body.days_ahead || 0;
    } catch {
      // No body or invalid JSON, use default
    }

    console.log(`Processing reminders for days_ahead=${daysAhead}`);

    const shopName = settings?.shop_name || "ZIO FRANK";
    const shopAddress = settings?.address || "Via Roma 1, 00100 Roma";
    const shopPhone = settings?.phone || "+39 06 1234567";
    const emailFrom = settings?.email_from || "info@ziofrank.it";
    const websiteUrl = settings?.website_url || "https://tuosito.it";

    // Calculate target date based on days_ahead parameter
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`Fetching appointments for ${targetDate.toDateString()}`);

    // Get all confirmed appointments for target date
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("status", "CONFIRMED")
      .gte("start_time", startOfDay.toISOString())
      .lte("start_time", endOfDay.toISOString());

    if (error) throw error;

    // Get all user profiles for the appointments
    const userIds = appointments
      ?.filter(a => a.user_id)
      .map(a => a.user_id) || [];
    
    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);
      
      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
      }
    }

    if (!appointments || appointments.length === 0) {
      const whenText = daysAhead === 0 ? "oggi" : `tra ${daysAhead} giorni`;
      console.log(`No appointments found for ${whenText}`);
      return new Response(
        JSON.stringify({ message: `Nessun appuntamento per ${whenText}` }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let emailsSent = 0;
    let emailsFailed = 0;
    let emailsSkipped = 0;

    // Send reminder to each client
    for (const appointment of appointments) {
      const profile = appointment.user_id ? profilesMap[appointment.user_id] : null;
      const clientEmail = appointment.client_email || profile?.email;
      const clientName = appointment.client_name || profile?.name || "Cliente";

      if (!clientEmail) {
        console.log(`Skipping appointment ${appointment.id}: no email available`);
        continue;
      }

      // Check if a reminder was already sent today for this appointment
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: existingLogs } = await supabase
        .from("email_logs")
        .select("id")
        .eq("appointment_id", appointment.id)
        .eq("type", "REMINDER")
        .eq("status", "sent")
        .gte("sent_at", todayStart.toISOString())
        .lte("sent_at", todayEnd.toISOString())
        .limit(1);

      if (existingLogs && existingLogs.length > 0) {
        console.log(`Skipping appointment ${appointment.id}: reminder already sent today to ${clientEmail}`);
        emailsSkipped++;
        continue;
      }

      const startTime = new Date(appointment.start_time);
      const startTimeZoned = toZonedTime(startTime, timezone);
      const timeStr = format(startTimeZoned, "HH:mm");

      const isToday = daysAhead === 0;
      const whenText = isToday ? "oggi" : "domani";
      const emojiTitle = isToday ? "⏰ Promemoria Appuntamento" : "📅 Promemoria - Appuntamento Domani";
      const backgroundColor = isToday ? "#fff3cd" : "#d1ecf1";
      const borderColor = isToday ? "#ffc107" : "#17a2b8";
      const textColor = isToday ? "#856404" : "#0c5460";

      try {
        const emailResponse = await resend.emails.send({
          from: `${shopName} <${emailFrom}>`,
          to: [clientEmail],
          subject: isToday 
            ? `Promemoria - Appuntamento da ${shopName} oggi alle ${timeStr}`
            : `Promemoria - Appuntamento da ${shopName} domani alle ${timeStr}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333;">${emojiTitle}</h1>
              <p>Ciao ${clientName},</p>
              <p>Ti ricordiamo che hai un appuntamento <strong>${whenText}</strong> presso <strong>${shopName}</strong>!</p>
              
              <div style="background-color: ${backgroundColor}; border-left: 4px solid ${borderColor}; padding: 20px; margin: 20px 0;">
                <h2 style="margin-top: 0; color: ${textColor};">Dettagli Appuntamento</h2>
                <p><strong>📅 Data:</strong> ${format(startTimeZoned, "EEEE d MMMM", { locale: it })}</p>
                <p><strong>🕐 Orario:</strong> ${timeStr} (durata 30 minuti)</p>
                <p><strong>📍 Indirizzo:</strong> ${shopAddress}</p>
              </div>
              
              ${!isToday ? `
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #856404; font-weight: bold;">
                  💡 Riceverai un ulteriore promemoria domani mattina alle 8:00!
                </p>
              </div>
              ` : ''}

              <p><strong>Ti aspettiamo!</strong></p>
              <p>Se hai bisogno di annullare, fallo dalla pagina "I Miei Appuntamenti" sul nostro sito.</p>
              
              <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #333;">Per effettuare una prenotazione o modificarne una già esistente accedi alla piattaforma dal seguente link:</p>
                <p style="margin: 10px 0 0 0;"><a href="${websiteUrl}" style="color: #2563eb; font-weight: bold;">${websiteUrl}</a></p>
              </div>

              <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 15px;">
                  ⚠️ IMPORTANTE: Non è possibile annullare o modificare l'appuntamento se mancano meno di 24 ore dall'appuntamento.<br>
                  Per urgenze contatta direttamente il negozio.
                </p>
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

        console.log(`Reminder sent to ${clientEmail} for appointment ${appointment.id} (${whenText}):`, emailResponse);

        // Check if Resend returned an error
        if (emailResponse.error) {
          // Resend API returned an error
          await supabase.from("email_logs").insert({
            appointment_id: appointment.id,
            type: "REMINDER",
            recipient: clientEmail,
            status: "failed",
            error_message: emailResponse.error.message || JSON.stringify(emailResponse.error),
          });
          emailsFailed++;
        } else {
          // Email sent successfully
          await supabase.from("email_logs").insert({
            appointment_id: appointment.id,
            type: "REMINDER",
            recipient: clientEmail,
            status: "sent",
          });
          emailsSent++;
        }
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

      // Add delay to respect Resend rate limit (2 emails per second)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reminder inviati: ${emailsSent}, Falliti: ${emailsFailed}, Saltati (già inviati): ${emailsSkipped}`,
        sent: emailsSent,
        failed: emailsFailed,
        skipped: emailsSkipped,
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
