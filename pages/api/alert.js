// /api/alert - Send email alerts via EmailJS (free tier: 200 emails/month)
// Setup: Create free account at emailjs.com, get service_id, template_id, public_key

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { email, signal, ticker, price, change, strategy, message, emailjs_service, emailjs_template, emailjs_key } = req.body;

  if (!email || !ticker) return res.status(400).json({ error: "email and ticker required" });

  // Option 1: EmailJS (free, 200/month)
  if (emailjs_service && emailjs_template && emailjs_key) {
    try {
      const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: emailjs_service,
          template_id: emailjs_template,
          user_id: emailjs_key,
          template_params: {
            to_email: email,
            subject: `⚡ ${signal} Signal: ${ticker} @ $${price} (${change}%)`,
            ticker, price, change, strategy,
            message: message || `${signal}-Signal für ${ticker}. Kurs: $${price} (${change}%). Strategie: ${strategy}. Prüfe die Consorsbank für passende Produkte.`,
          },
        }),
      });
      if (r.ok) return res.status(200).json({ sent: true, method: "emailjs" });
      return res.status(500).json({ error: "EmailJS failed", status: r.status });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Option 2: Just log the alert (no email config)
  console.log(`ALERT: ${signal} ${ticker} @ $${price} (${change}%) -> ${email}`);
  return res.status(200).json({
    sent: false,
    logged: true,
    message: "Alert geloggt. Für Email-Versand: EmailJS konfigurieren (kostenlos, 200 Emails/Monat). Siehe Einstellungen.",
  });
}
