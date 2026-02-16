# ⚡ Consors Disruptor — KI-Disruption Trading Tool

**100% kostenlos · Keine API-Keys · Vercel Hobby-Plan**

## Was ist das?

Ein semi-automatisches Trading-Tool, das KI-Disruption in 5 Sektoren überwacht und dir fertige Trade-Vorschläge mit Consorsbank-kompatiblen Produkten (Knock-Out-Zertifikate, Put-Optionsscheine) liefert.

## Kostenstruktur: 0 EUR

| Komponente | Kosten | Warum |
|---|---|---|
| Hosting (Vercel) | 0 EUR | Hobby-Plan ist gratis |
| Kursdaten (Yahoo Finance) | 0 EUR | Freie API, kein Key nötig |
| News (Google News RSS) | 0 EUR | Öffentlicher RSS-Feed |
| Signal-Logik | 0 EUR | Läuft lokal im Browser/Server |
| **Gesamt** | **0 EUR** | |

## Deploy auf Vercel (3 Minuten)

### Schritt 1: GitHub Repository erstellen

1. Gehe zu [github.com/new](https://github.com/new)
2. Name: `consors-disruptor`
3. Klicke "Create repository"
4. Lade alle Dateien aus diesem Ordner hoch (drag & drop)

### Schritt 2: Vercel verbinden

1. Gehe zu [vercel.com](https://vercel.com) → Sign up mit GitHub
2. Klicke "Add New Project"
3. Wähle dein `consors-disruptor` Repository
4. Framework: **Next.js** (wird automatisch erkannt)
5. Klicke **Deploy**
6. Fertig! Deine App läuft unter `consors-disruptor.vercel.app`

### Schritt 3: Nutzen

1. Öffne deine Vercel-URL
2. Klicke "🚀 VOLLSCAN"
3. Prüfe die Trade-Ideen
4. WKN in Consorsbank-App suchen → Kaufen

## Projekt-Struktur

```
consors-disruptor/
├── pages/
│   ├── index.js          # Frontend (Dashboard, Scanner, Trade-Ideen)
│   └── api/
│       ├── stocks.js     # Yahoo Finance Kursdaten (kostenlos)
│       ├── products.js   # Consorsbank-kompatible Produkte
│       ├── signal.js     # Trading-Signale (lokale Logik)
│       └── news.js       # Google News RSS (kostenlos)
├── package.json
├── next.config.js
└── README.md
```

## Features

- **📊 Echtzeit-Kurse** von Yahoo Finance (5 Sektoren, 20+ Aktien)
- **🤖 Automatische Signale** basierend auf Disruptions-Score
- **🏦 Consorsbank-Produkte** mit WKN (KO-Puts, Optionsscheine)
- **📰 Live News** via Google News RSS
- **🔔 Alerts** bei starken SHORT-Signalen
- **📋 Trade-Ideen** mit Einstieg, Stop-Loss, Kursziel
- **🔄 Auto-Refresh** alle 2 Minuten

## Hinweise

⚠️ **Keine Anlageberatung** — rein informativ
⚠️ Beispiel-WKNs vor Kauf in Consorsbank verifizieren
⚠️ Short-Zertifikate können wertlos verfallen
⚠️ Max. 2% pro Trade, immer Stop-Loss setzen
