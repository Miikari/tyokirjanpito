# Työtunnit ⏱

A Progressive Web App (PWA) for tracking work hours and generating invoices. Built with vanilla JavaScript and Firebase.

## Features

- **Time Tracking** — Clock in/out with customer selection, pause support, and automatic rounding (15/30/60 min)
- **Manual Entries** — Add work entries manually with date, hours, minutes, and notes
- **Invoice Builder** — Select entries and build invoices with optional monthly charges
- **PDF Export** — Generate printable invoices with company branding
- **Monthly Charges** — Add recurring charges per customer, included automatically in invoices
- **VAT Support** — Configurable VAT rates (0%, 10%, 14%, 25.5%)
- **Multi-language** — Finnish and English UI
- **Cloud Sync** — Data synced via Firebase Firestore across all devices
- **PWA** — Installable on iOS and Android home screen, works offline

## Tech Stack

- Vanilla JavaScript (no frameworks)
- Firebase Authentication (Google Sign-In)
- Firebase Firestore (cloud storage)
- Progressive Web App (manifest + service worker)
- HTML/CSS (no build tools required)

## Deployment

The app is deployed via GitHub Pages. Any push to `main` branch automatically deploys.

Live at: **https://miikari.github.io/tyokirjanpito**

## Project Structure
