# Hemisphere — Product Overview

## What it is
**Hemisphere** is a web-based **team operations & ticketing app** — a fast, role-based task
board that a small team or agency can adopt in a day. Its standout feature is **native two-way
sync with Notion**, so teams that already run their work in a Notion database get a proper
ticketing/ops layer on top of it without abandoning Notion.

It's a self-hosted, brandable product running on its own domain
(`https://app.westindustriesintl.com`), not a per-seat SaaS.

## What it does

### Task & ticket management
- **Kanban boards** with drag-and-drop across seven workflow statuses (Not Started, On-Track,
  Behind, At Risk, Reprioritized, Accomplished, Failed).
- **My Tasks** — each person's personal board, filtered to tickets assigned to them.
- **Team Tasks** — an org-wide board grouping all active (non-closed) tickets by assignee,
  visible to everyone.
- Each ticket has a **title, markdown description, priority, deadline, assignee, checklist, and
  threaded comments**.

### Dashboard (analytics command-center)
- Animated KPIs (active, overdue, due-this-week, completion rate), a status-breakdown donut,
  weekly throughput, workload-by-assignee, a personal "My Focus" panel, upcoming deadlines, a
  recent-activity feed, and a Notion sync-health tile.
- **Role-aware:** admins see org-wide metrics; team members see a personal view.

### People & access
- **Three roles** — Super User, Admin, Team Member — with scoped permissions (team members
  manage only their own tickets; admins manage everyone and the team).
- **Email invitations** (via Resend): invite anyone → they receive a styled email → accept →
  set a password → instant access. Plus resend, copy-link, cancel, archive/restore, and
  permanent delete, with safety guards.
- **Self-serve password reset** ("forgot password" → secure time-limited email link).

### Two-way Notion sync (the differentiator)
- Changes in Hemisphere **push** to the linked Notion database; changes in Notion **pull** back
  automatically every 5 minutes.
- Preserves human-authored Notion page content (never overwrites your notes).
- A sync-log/admin view surfaces sync health and errors.

### Experience
- **Light & dark mode** (warm "sunset" theme), **mobile-first responsive** design, premium
  glassmorphism UI, custom Hemisphere branding.

## Who it's for
Notion-centric **small teams, agencies, and founders** who find Asana/Monday/Linear heavy or
expensive, and who want a focused, fast, brandable ops board that respects their existing Notion
workflow.

## Under the hood (brief)
Next.js + React, PostgreSQL (Drizzle ORM), NextAuth authentication, Resend for transactional
email, deployed with nginx + Let's Encrypt HTTPS and PM2 on a DigitalOcean droplet, with
automated daily database backups (on-server + off-server to DigitalOcean Spaces).
