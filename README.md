# Checkpoint Kiosk

![status](https://img.shields.io/badge/status-live-brightgreen)
![node](https://img.shields.io/badge/node.js-Express-339933)
![postgres](https://img.shields.io/badge/database-PostgreSQL-336791)
![architecture](https://img.shields.io/badge/architecture-async%20%2B%20webhooks-blueviolet)

> **Project Motto:** *Scan once. Trust the confirmation.*

**Context:** Individual assignment submission for [Power Learn Project Africa's](https://powerlearnprojectafrica.org)
"Meridian Pivot" sprint — a 1-week simulation of a real client
engagement, including a genuine, non-negotiable mid-sprint
requirement change delivered without warning. The original kiosk
frontend (Phase A) was contributed by [Koketso Matobako](https://github.com/tweety-KM);
the backend, database, mock vendor, webhook system, and the full
Day 4 async pivot were built individually by Bernard Abuto.

An event check-in kiosk built for a fictional client (Solstice Events
Co.), rebuilt mid-sprint from a blocking, synchronous vendor call to
a fully asynchronous, webhook-confirmed architecture, with zero
functional regression.

## The Story

This started as a straightforward kiosk: scan a QR code, call the
badge printer, wait, show "Checked In." Then the (simulated) vendor
announced — with 48 hours' notice, no deadline extension — that the
synchronous API was being killed. The whole check-in flow had to be
rebuilt around a message-queue + webhook model, with confirmations
that can arrive **out of order**, without breaking duplicate-scan
protection.

This repo is the result: the original sync build, fully replaced by
a working async system, with the entire before/after story documented
in [`SCOPE_DELTA.md`](./SCOPE_DELTA.md).

## What It Does

1. Staff scan an attendee's ID
2. Backend publishes a print job and responds **instantly** with a
   "pending" status — no blocking
3. A mock vendor processes the job on a randomized delay and calls
   back via a signed webhook
4. The webhook is verified, matched to the correct attendee by a
   unique request ID (even if confirmations arrive out of order),
   and the UI updates automatically

## Architecture

Full system design, contracts, and data flow:
[`ARCHITECTURE.md`](./ARCHITECTURE.md)

    Scan -> POST /checkin -> instant "pending" response
                                    |
                          Vendor queue (simulated)
                                    |
                    Webhook callback (signature-verified)
                                    |
                     Attendee updated by request ID
                                    |
                      Frontend polls, shows "Checked In"

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Frontend | Vanilla HTML/CSS/JS |
| Async model | In-process queue + webhook (real broker not required for this scope) |

## Project Structure

    backend/
      src/
        server.js       - all live endpoints
        db.js            - PostgreSQL connection
        init-db.sql       - schema + seed data
    frontend/
      index.html, script.js, style.css - kiosk UI
    ARCHITECTURE.md    - full system design
    SCOPE_DELTA.md      - what changed during the pivot, and why

## Running It Locally

    cd backend
    npm install
    # create .env from .env.example
    psql -U postgres -c "CREATE DATABASE checkpoint_kiosk;"
    psql -U postgres -d checkpoint_kiosk -f src/init-db.sql
    node src/server.js

Then open `frontend/index.html` in a browser.

## Assignment Context

Built as part of PLP Group 90's Meridian Pivot sprint: a working
simulation grading independent problem-solving (Days 1-2, solo
prototype with an unfamiliar tool), real adaptation to a
non-negotiable requirement change (Days 3-5), and honest
documentation of trade-offs made under deadline pressure. Frontend
groundwork by Koketso Matobako; the pivot itself — async backend
rebuild, mock vendor, webhook verification — was completed
individually by Bernard Abuto for this individual submission.



