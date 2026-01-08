import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { format } from "https://esm.sh/v135/date-fns@3.6.0";
import { toZonedTime } from "https://esm.sh/v135/date-fns-tz@3.2.0";
import { it } from "https://esm.sh/v135/date-fns@3.6.0/locale/it";
import nodemailer from "https://esm.sh/nodemailer@6.9.9";


// Helper function to format date for ICS in local timezone (YYYYMMDDTHHMMSS)
const formatICSDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
};

// Helper function to format UTC timestamp for DTSTAMP
const formatUTCTimestamp = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

// Generate ICS file content - iOS compatible with METHOD:REQUEST
const generateICS = (
  startTime: Date,
  endTime: Date,
  summary: string,
  description: string,
  location: string,
  appointmentId: string,
  organizerEmail: string,
  organizerName: string,
  attendeeEmail: string,
  attendeeName: string
): string => {
  const dtstamp = formatUTCTimestamp();
  
  // Escape special characters in text fields
  const escapedDescription = description.replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const escapedSummary = summary.replace(/,/g, '\\,').replace(/;/g, '\\;');
  const escapedLocation = location.replace(/,/g, '\\,').replace(/;/g, '\\;');
  const escapedOrganizerName = organizerName.replace(/,/g, '\\,').replace(/;/g, '\\;');
  const escapedAttendeeName = attendeeName.replace(/,/g, '\\,').replace(/;/g, '\\;');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JesterWear//Booking System//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Rome',
    'BEGIN:STANDARD',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${appointmentId}@jesterwear.it`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=Europe/Rome:${formatICSDate(startTime)}`,
    `DTEND;TZID=Europe/Rome:${formatICSDate(endTime)}`,
    `SUMMARY:${escapedSummary}`,
    `DESCRIPTION:${escapedDescription}`,
    `LOCATION:${escapedLocation}`,
    `ORGANIZER;CN=${escapedOrganizerName}:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${escapedAttendeeName};RSVP=TRUE;PARTSTAT=NEEDS-ACTION;ROLE=REQ-PARTICIPANT:mailto:${attendeeEmail}`,
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  return icsContent;
};

// Generate calendar links
const generateCalendarLinks = (
  startTime: Date,
  endTime: Date,
  title: string,
  description: string,
  location: string
) => {
  const formatGoogleDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const startStr = formatGoogleDate(startTime);
  const endStr = formatGoogleDate(endTime);
  
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);
  const encodedLocation = encodeURIComponent(location);
  
  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&dates=${startStr}/${endStr}&details=${encodedDescription}&location=${encodedLocation}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodedTitle}&startdt=${startTime.toISOString()}&enddt=${endTime.toISOString()}&body=${encodedDescription}&location=${encodedLocation}`,
    office365: `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodedTitle}&startdt=${startTime.toISOString()}&enddt=${endTime.toISOString()}&body=${encodedDescription}&location=${encodedLocation}`
  };
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Configure Nodemailer with Resend SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  port: 465,
  secure: true,
  auth: {
    user: "resend",
    pass: Deno.env.get("RESEND_API_KEY"),
  },
});

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

    // Format date and time in shop timezone
    const timezone = settings?.timezone || "Europe/Rome";
    const startTime = new Date(appointment.start_time);
    const endTime = new Date(appointment.end_time);
    
    // Convert UTC dates to shop timezone
    const startTimeZoned = toZonedTime(startTime, timezone);
    const endTimeZoned = toZonedTime(endTime, timezone);
    
    const dateStr = format(startTimeZoned, "EEEE d MMMM yyyy", { locale: it });
    const timeStr = format(startTimeZoned, "HH:mm");

    const clientEmail = appointment.client_email;
    const clientName = appointment.client_name || "Cliente";

    if (!clientEmail) {
      throw new Error("Email del cliente non disponibile");
    }

    // Generate ICS file with iOS-compatible format
    const icsContent = generateICS(
      startTimeZoned,
      endTimeZoned,
      `Appuntamento - ${shopName}`,
      `Appuntamento presso ${shopName}.\nData: ${dateStr}\nOrario: ${timeStr}\nIndirizzo: ${shopAddress}`,
      shopAddress,
      appointment_id,
      emailFrom,
      shopName,
      clientEmail,
      clientName
    );

    // Generate calendar links
    const calendarLinks = generateCalendarLinks(
      startTime,
      endTime,
      `Appuntamento - ${shopName}`,
      `Appuntamento presso ${shopName}. Data: ${dateStr}, Orario: ${timeStr}`,
      shopAddress
    );

    // Plain text version
    const textContent = `Prenotazione Confermata

Ciao ${clientName},

La tua prenotazione presso ${shopName} è stata confermata!

Dettagli Appuntamento:
- Data: ${dateStr}
- Orario: ${timeStr}
- Indirizzo: ${shopAddress}

Per effettuare una prenotazione o modificarne una già esistente accedi alla piattaforma: ${websiteUrl}

IMPORTANTE: Non è possibile annullare o modificare l'appuntamento se mancano meno di 24 ore.

Per qualsiasi domanda, contattaci:
Tel: ${shopPhone}
Email: ${emailFrom}
`;

    // HTML content
    const htmlContent = `
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

          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="margin-top: 0; color: #333;">📅 Aggiungi al Calendario</h3>
            <p style="margin: 10px 0; color: #666; font-size: 14px;">Salva questo appuntamento nel tuo calendario preferito</p>
            <div style="margin: 15px 0;">
              <p style="margin: 10px 0;"><a href="${calendarLinks.google}" target="_blank" style="display: inline-block; background-color: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">📅 Google Calendar</a></p>
              <p style="margin: 10px 0;"><a href="${calendarLinks.outlook}" target="_blank" style="display: inline-block; background-color: #0078d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">📧 Outlook</a></p>
              <p style="margin: 10px 0;"><a href="${calendarLinks.office365}" target="_blank" style="display: inline-block; background-color: #d83b01; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">💼 Office 365</a></p>
            </div>
            <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin-top: 20px;">
              <p style="margin: 0; color: #333; font-size: 14px;"><strong>📎 Per Apple Calendar, Thunderbird e altri:</strong></p>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 13px;">Scarica il file <strong>invite.ics</strong> allegato a questa email e aprilo con il tuo calendario</p>
            </div>
          </div>

          <p><strong>Hai bisogno di modificare l'appuntamento?</strong></p>
          <p>Puoi annullare la tua prenotazione dalla pagina "I Miei Appuntamenti" sul nostro sito.</p>
          
          <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #333;">Per effettuare una prenotazione o modificarne una già esistente accedi alla piattaforma dal seguente link:</p>
            <p style="margin: 10px 0 0 0;"><a href="${websiteUrl}" style="color: #2563eb; font-weight: bold;">${websiteUrl}</a></p>
          </div>

          <!-- BOX ROSSO AVVISO 24 ORE -->
          <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 15px;">
              ⚠️ IMPORTANTE: Non è possibile annullare o modificare l'appuntamento se mancano meno di 24 ore dall'appuntamento.
            </p>
            <p style="margin: 10px 0 0 0; color: #991b1b; font-size: 14px;">
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
      `;

    // Send email via SMTP with inline iCalendar (iTIP)
    const emailResponse = await transporter.sendMail({
      from: `"${shopName}" <${emailFrom}>`,
      to: clientEmail,
      bcc: emailBcc || undefined,
      subject: `${shopName} - Prenotazione confermata`,
      text: textContent,
      html: htmlContent,
      // Extra headers for better Gmail/Outlook compatibility
      headers: {
        'Content-Class': 'urn:content-classes:calendarmessage',
        'X-Google-Calendar-Event': 'true',
        'X-Microsoft-CDO-Alldayevent': 'FALSE',
        'X-Microsoft-CDO-Busystatus': 'BUSY',
        'X-Microsoft-CDO-Importance': '1',
      },
      // Inline iCalendar - this triggers Accept/Decline in Apple Mail & Outlook
      icalEvent: {
        method: 'REQUEST',
        content: icsContent,
        filename: 'invite.ics',
      },
      // Also attach as fallback for clients that don't support inline calendar
      attachments: [
        {
          filename: 'invite.ics',
          content: icsContent,
          contentType: 'text/calendar; charset=utf-8; method=REQUEST',
        },
      ],
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
