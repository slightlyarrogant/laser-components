# LC Connect — roles, ownership and regions

*How access works in LC Connect, in one page. For Laser Components staff.*

LC Connect is one shared database for the whole company. **Everyone can read
everything**: every colleague sees every lead, every product, the full knowledge
base. Nothing is hidden from anyone inside the company. What is controlled is
**who may change what**.

Three things decide that: your **role**, who **owns** a lead, and which
**regions** you are competent for.

---

## 1. The three roles

| | **ADMIN** | **RESEARCHER** | **SALES** |
| --- | :---: | :---: | :---: |
| Read everything | ✅ | ✅ | ✅ |
| Create leads, import leads in bulk | ✅ | ✅ | ✅ |
| Edit leads they own or created | ✅ | ✅ | ✅ |
| Add notes / log calls on **any** lead | ✅ | ✅ | ✅ |
| Hand a lead to a colleague (`assign_lead`) | any lead | own leads | own leads |
| Edit the product catalog and applications | ✅ | ✅ | — |
| Edit the knowledge base (guides, learnings) | ✅ | ✅ | — |
| Bulk-update many leads at once | ✅ | — | — |
| Delete leads and products | ✅ | — | — |
| Add users, set roles and regions, reset passwords | ✅ | — | — |

**SALES** is the everyday sales role: build your book, work it, log activity.

**RESEARCHER** is SALES plus stewardship of the *shared* company data — the
product catalog, the application taxonomy, and the knowledge base. Those are
things everyone else's work depends on, so they are not open to all.

**ADMIN** is the operations role: deletions, bulk edits, and the user list.

---

## 2. Ownership — who may edit a lead

Every lead records two people: the **creator** (who first put it in, never
changes) and the **owner** (who is working it, can be handed over).

You may edit a lead if **any** of these is true:

- you **own** it, or
- you **created** it, or
- you are an **ADMIN**, or
- it has **no owner** and your region competency covers it (see below).

A lead that a colleague owns is theirs. You can still read it, and still add a
note to it — notes are open on purpose, because someone who takes a call about
a company should always be able to record what was said. You just cannot change
the lead's fields behind the owner's back.

To move a lead, use **`assign_lead`** ("assign lead 412 to Anna"). Handing a
lead over gives the new owner the edit right; you keep yours if you were the
one who created it. Assigning a lead to *nobody* puts it back in the unowned
pool, where anyone with matching region competency can pick it up.

---

## 3. Region competency — who may claim an unowned lead

Each user can be given one or more regions. That is their **competency**: the
part of the world they are responsible for.

- **No regions assigned = global competency.** The user may claim any unowned
  lead, anywhere. This is the default, and it is what most users have today.
- **One or more regions assigned = regional competency.** The user may claim
  unowned leads in those regions only.

Competency only ever decides **unowned** leads. It never overrides ownership:
a lead your colleague owns stays theirs even if it sits in your region, and a
lead you own stays yours even if it sits outside it.

### The current region taxonomy

Today the database has three top-level regions:

| Code | Region |
| --- | --- |
| `NA` | North America |
| `EU` | Europe |
| `AS` | Asia |

This is **deliberately extensible**. Regions support sub-regions, so the
taxonomy can be reshaped to how Laser Components actually sells — for example
*France*, *Western Europe*, *Africa & emerging markets*, *Asia* — without any
code change. Tell us the breakdown you want and we add the regions and the
countries under them; everything above keeps working unchanged.

### Important caveat, today

Lead geography is only **partly filled in**: of roughly 400 leads, a country is
recorded on a handful and a region on none. Until that is backfilled, region
competencies have almost nothing to bite on — which is precisely why everyone
currently has global competency and nobody is blocked.

Two things fix this, and both are already in place:

1. New leads stamp their region automatically whenever a country is given
   (`create_lead` / `batch_create_leads` derive the region from the country).
2. Existing leads can be backfilled — from the `location` / `country` text
   already stored on them, or country by country as they are worked.

Once geography is filled in, assigning regions to users starts to mean
something. A lead with **no geography** can be edited by any competent user,
regional or global — the rule only closes when a lead clearly lies in another
region. Until then, assign regions only to people you genuinely want to
scope, and leave everyone else global.

---

## 4. How an admin manages users — in chat

There is no admin web panel. An ADMIN does all of this by asking in the chat;
the connector's **`manage_users`** tool does the work.

| You say | What happens |
| --- | --- |
| *"List the LC Connect users."* | Every active account: name, email, role, regions, how many leads they own and created. Add *"including deactivated"* to see switched-off accounts. |
| *"Add Anna Weber, anna.weber@lasercomponents.de, as SALES for Europe."* | Creates the account with a password you supply, role SALES, region EU. |
| *"Make Anna a RESEARCHER."* | Changes her role. |
| *"Give Anna Europe and North America."* | Replaces her regions. Saying *"give Anna global competency"* clears them. |
| *"Switch off Peter's account."* | Deactivates it: he can no longer sign in, and any session he still has stops working. His leads and notes stay exactly where they are. |
| *"Turn Peter's account back on."* | Reactivates it. |
| *"Reset Anna's password to ‹…›."* | Sets a new password. It is never shown back to you — pass it on yourself, by phone or in person. |

Two deliberate guard rails: an admin **cannot deactivate their own account** and
**cannot remove their own ADMIN role** — otherwise the last admin could lock the
whole company out. Ask a second admin.

Region IDs come from the connector itself — ask *"what regions exist?"* and it
lists them with their IDs.

---

## 5. Audit trail — what is recorded, and who can read it

Every **write** LC Connect performs leaves one row in the audit trail, and so
does every **refused** destructive attempt. Nothing is written to the database
by a tool without a matching entry.

**What is recorded**

| | |
| --- | --- |
| **Leads** | created, updated, deleted, assigned/released, bulk-imported, bulk-updated — plus refused deletes and refused bulk updates |
| **Notes** | added (which lead, which type — *never* the note text) |
| **Catalog** | products created and deleted, applications created, product↔application mappings created, refused product deletes |
| **Knowledge base** | resources created and updated (slug, new version, stated reason), learnings saved |
| **Users** | created, role changed, regions changed, deactivated, reactivated, password reset, account list viewed |
| **Issues** | issue reports sent to the administrator (title + category) |

Each entry carries **who** (the signed-in user), **what** (an action name like
`lead.updated`, `user.role_changed`, `lead.delete_refused`), **which record**,
**when**, and a small `details` blob. For an update that blob holds a
before/after pair of **only the fields that actually changed**; for a bulk
action, the counts and the affected ids; for a deletion, a compact snapshot of
what disappeared (name, status, owner, product).

**What is deliberately NOT recorded**: passwords and password hashes (a reset
records only *whose* password was reset), note bodies, resource bodies, and any
free text longer than 500 characters — long values are truncated with an "…".

**Who can read it**

- **ADMIN and RESEARCHER** — ask *"show the audit log"*. The connector's
  **`get_audit_log`** tool returns the raw trail, filterable by person
  (`userId`), action prefix (`"lead."` catches every lead action), record kind,
  date (`since`) and size (`limit`, default 50, max 500).
- **Everyone** — ask *"what changed recently?"*. **`get_activity_feed`** shows
  the same trail merged with the older lead and note events that predate it,
  newest first. It takes the same filters.

Two things worth knowing. First, a **refused** action is as visible as a
successful one: an attempted delete by someone without the ADMIN role shows up
as `lead.delete_refused` together with the reason. Second, auditing never
blocks a tool — if the trail itself fails to write, the tool still completes and
the failure is logged on the server rather than thrown at the user.

---

## 6. What you see when a write is refused

Refusals explain themselves rather than just failing:

> *You can't edit this lead (owned by user 6). Ask that owner, or an ADMIN, to reassign it with assign_lead.*

> *You can't edit this lead: it is unowned but lies outside your region competency. Ask an ADMIN to assign it to you (assign_lead) or to widen your regions (manage_users).*

> *Requires role ADMIN — you are SALES.*

If you are unsure what you are allowed to do, ask *"who am I?"* — the `whoami`
tool answers with your role, your regions, and your lead counts.
