import { all, batch, newId, one, revalidatePath, run } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { brandIcon } from "@/lib/cta";
import { deleteMediaEverywhere } from "@/lib/media";

/* Every save and delete in the admin. On the real site these are server
   actions writing to D1; in the demo they run in the browser against its
   in-memory copy (lib/db.ts), so they are the same code, only nothing is
   kept after a refresh. */

function refresh() {
  revalidatePath("/", "layout");
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const numOrNull = (f: FormData, k: string) => {
  const v = str(f, k);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (f: FormData, k: string) => (f.get(k) ? 1 : 0);

/** "Montra - Finance dashboard" -> "montra-finance-dashboard" */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** A slug the user did not have to think about. */
async function uniqueSlug(
  table: "works" | "categories",
  desired: string,
  ignoreId?: string,
): Promise<string> {
  const base = slugify(desired) || "item";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const clash = await one<{ id: string }>(
      `SELECT id FROM ${table} WHERE slug = ?`,
      candidate,
    );
    if (!clash || clash.id === ignoreId) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/* Ordering is done with up/down buttons rather than typing a number. */
const ORDERABLE = {
  works: "works",
  categories: "categories",
  plans: "plans",
  testimonials: "testimonials",
  faqs: "faqs",
  photos: "photos",
  clients: "clients",
  experience: "experience",
  awards: "awards",
} as const;

export async function moveItem(formData: FormData) {
  await requireAdmin();
  const table = ORDERABLE[str(formData, "table") as keyof typeof ORDERABLE];
  if (!table) return;

  const id = str(formData, "id");
  const dir = str(formData, "dir") === "up" ? -1 : 1;

  // clients are ordered within their row, everything else across the table
  const scopeCol = table === "clients" ? "row_index" : null;
  const me = await one<{ position: number; scope: number | null }>(
    `SELECT position, ${scopeCol ?? "NULL"} AS scope FROM ${table} WHERE id = ?`,
    id,
  );
  if (!me) return;

  const neighbour = await one<{ id: string; position: number }>(
    `SELECT id, position FROM ${table}
      WHERE ${scopeCol ? `${scopeCol} = ? AND` : ""} position ${dir < 0 ? "<" : ">"} ?
      ORDER BY position ${dir < 0 ? "DESC" : "ASC"} LIMIT 1`,
    ...(scopeCol ? [me.scope, me.position] : [me.position]),
  );
  if (!neighbour) return;

  await batch([
    {
      sql: `UPDATE ${table} SET position = ? WHERE id = ?`,
      params: [neighbour.position, id],
    },
    {
      sql: `UPDATE ${table} SET position = ? WHERE id = ?`,
      params: [me.position, neighbour.id],
    },
  ]);
  refresh();
}

/** Next free position, so new rows land at the end. */
async function nextPosition(table: string, scope?: number): Promise<number> {
  const row = await one<{ n: number | null }>(
    `SELECT max(position) AS n FROM ${table}` +
      (scope === undefined ? "" : " WHERE row_index = ?"),
    ...(scope === undefined ? [] : [scope]),
  );
  return (row?.n ?? -1) + 1;
}

/**
 * Where an existing row sits now. Saves use this rather than the position the
 * form was rendered with, so a form left open while rows were dragged cannot
 * put its row back where it was.
 */
async function keepPosition(table: string, id: string): Promise<number> {
  const row = await one<{ position: number }>(`SELECT position FROM ${table} WHERE id = ?`, id);
  return row?.position ?? (await nextPosition(table));
}

/**
 * A whole list's order after a drag in the admin: every id, top to bottom.
 * Client logos are ordered within their row (`scope`). Only a complete list
 * of the rows is accepted, so a stale page cannot scramble it.
 */
export async function reorderRows(table: string, ids: string[], scope?: number) {
  await requireAdmin();
  const t = ORDERABLE[table as keyof typeof ORDERABLE];
  if (!t) throw new Error("That list can't be reordered.");
  const scoped = t === "clients" && typeof scope === "number";
  const rows = await all<{ id: string }>(
    `SELECT id FROM ${t}${scoped ? " WHERE row_index = ?" : ""}`,
    ...(scoped ? [scope] : []),
  );
  const known = new Set(rows.map((r) => r.id));
  const list = Array.isArray(ids) ? ids.filter((v): v is string => typeof v === "string") : [];
  if (list.length !== known.size || new Set(list).size !== list.length || !list.every((v) => known.has(v))) {
    throw new Error("The list changed since this page loaded. Reload and try again.");
  }
  await batch(list.map((id, i) => ({ sql: `UPDATE ${t} SET position = ? WHERE id = ?`, params: [i, id] })));
  refresh();
}

/* ---------------------------------------------------------------- settings */

export async function saveSettings(formData: FormData) {
  await requireAdmin();
  const writes: { sql: string; params: unknown[] }[] = [];

  for (const [key, value] of formData.entries()) {
    // skip files and the framework's own hidden fields ($ACTION_…)
    if (typeof value !== "string" || key.startsWith("$")) continue;
    writes.push({
      sql: `INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                           updated_at = excluded.updated_at`,
      params: [key, value],
    });
  }

  if (writes.length) await batch(writes);
  refresh();
}

/* ---------------------------------------------------------------- works */

export async function saveWork(formData: FormData) {
  await requireAdmin();
  const existingId = str(formData, "id");
  const id = existingId || newId("work");
  const isNew = !existingId;
  const title = str(formData, "title");
  const slug =
    str(formData, "slug") || (await uniqueSlug("works", title, existingId));
  // a new project goes where the form says (the top by default); an existing
  // one keeps its place, which only the reorder actions change, so a form
  // opened before a drag cannot put it back
  const atTop = isNew && str(formData, "place") !== "end";
  const position = atTop ? 0 : isNew ? await nextPosition("works") : null;

  const params = [
    title,
    slug,
    str(formData, "category_id") || null,
    str(formData, "cover") || null,
    str(formData, "preview_video") || null,
    str(formData, "client") || null,
    str(formData, "year") || null,
    str(formData, "summary") || null,
    str(formData, "live_link") || null,
    bool(formData, "show_on_homepage"),
  ];

  if (isNew) {
    if (atTop) await run("UPDATE works SET position = position + 1");
    await run(
      `INSERT INTO works (title, slug, category_id, cover, preview_video,
                          client, year, summary, live_link, show_on_homepage,
                          position, id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      ...params,
      position,
      id,
    );
  } else {
    await run(
      `UPDATE works SET title=?, slug=?, category_id=?, cover=?, preview_video=?,
                        client=?, year=?, summary=?, live_link=?,
                        show_on_homepage=?
       WHERE id=?`,
      ...params,
      id,
    );
  }
  refresh();
}

/**
 * The whole projects order after a drag in /admin/works: every id, top to
 * bottom. Only a complete list of the current projects is accepted, so a tab
 * left open while someone else added or deleted one cannot scramble it.
 */
export async function reorderWorks(ids: string[]) {
  await requireAdmin();
  const rows = await all<{ id: string }>("SELECT id FROM works");
  const known = new Set(rows.map((r) => r.id));
  const list = Array.isArray(ids) ? ids.filter((v): v is string => typeof v === "string") : [];
  if (list.length !== known.size || new Set(list).size !== list.length || !list.every((v) => known.has(v))) {
    throw new Error("The list changed since this page loaded. Reload and try again.");
  }
  await batch(list.map((id, i) => ({ sql: "UPDATE works SET position = ? WHERE id = ?", params: [i, id] })));
  refresh();
}

/** The homepage switch on a project card, without opening its form. */
export async function setWorkOnHomepage(id: string, on: boolean) {
  await requireAdmin();
  await run("UPDATE works SET show_on_homepage = ? WHERE id = ?", on ? 1 : 0, String(id));
  refresh();
}

export async function deleteWork(formData: FormData) {
  await requireAdmin();
  await run("DELETE FROM works WHERE id = ?", str(formData, "id"));
  refresh();
}

/* ---------------------------------------------------------------- categories */

export async function saveCategory(formData: FormData) {
  await requireAdmin();
  const existing = str(formData, "id");
  const id = existing || newId("cat");
  const title = str(formData, "title");
  const params = [
    title,
    str(formData, "slug") || (await uniqueSlug("categories", title, existing)),
    str(formData, "icon") || null,
    str(formData, "icon_animated") || null,
    str(formData, "icon_active") || null,
    existing
      ? await keepPosition("categories", existing)
      : await nextPosition("categories"),
    id,
  ];

  if (existing) {
    await run(
      `UPDATE categories SET title=?, slug=?, icon=?, icon_animated=?,
                             icon_active=?, position=? WHERE id=?`,
      ...params,
    );
  } else {
    await run(
      `INSERT INTO categories (title, slug, icon, icon_animated, icon_active,
                               position, id) VALUES (?,?,?,?,?,?,?)`,
      ...params,
    );
  }
  refresh();
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  await run("DELETE FROM categories WHERE id = ?", str(formData, "id"));
  refresh();
}

/* ---------------------------------------------------------------- plans */

export async function savePlan(formData: FormData) {
  await requireAdmin();
  const existing = str(formData, "id");
  const id = existing || newId("plan");

  const params = [
    str(formData, "name"),
    str(formData, "blurb"),
    str(formData, "badge") || null,
    numOrNull(formData, "monthly_price"),
    str(formData, "trial_label") || null,
    numOrNull(formData, "trial_price"),
    numOrNull(formData, "trial_discount") ?? 50,
    str(formData, "cta_label") || "Intro Call",
    str(formData, "cta_href") || null,
    brandIcon(str(formData, "cta_icon")),
    str(formData, "icon") || null,
    existing
      ? await keepPosition("plans", existing)
      : await nextPosition("plans"),
    id,
  ];

  if (existing) {
    await run(
      `UPDATE plans SET name=?, blurb=?, badge=?, monthly_price=?, trial_label=?,
                        trial_price=?, trial_discount=?, cta_label=?, cta_href=?,
                        cta_icon=?, icon=?, position=? WHERE id=?`,
      ...params,
    );
  } else {
    await run(
      `INSERT INTO plans (name, blurb, badge, monthly_price, trial_label,
                          trial_price, trial_discount, cta_label, cta_href,
                          cta_icon, icon, position, id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ...params,
    );
  }

  // features arrive as one per line
  const features = str(formData, "features")
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  await run("DELETE FROM plan_features WHERE plan_id = ?", id);
  if (features.length) {
    await batch(
      features.map((text, i) => ({
        sql: "INSERT INTO plan_features (id, plan_id, text, position) VALUES (?,?,?,?)",
        params: [newId("pf"), id, text, i],
      })),
    );
  }

  refresh();
}

export async function deletePlan(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  await run("DELETE FROM plan_features WHERE plan_id = ?", id);
  await run("DELETE FROM plans WHERE id = ?", id);
  refresh();
}

/* ------------------------------------------------- testimonials / faqs / etc */

export async function saveTestimonial(formData: FormData) {
  await requireAdmin();
  const existing = str(formData, "id");
  const id = existing || newId("t");
  const params = [
    str(formData, "quote"),
    str(formData, "name"),
    str(formData, "role"),
    str(formData, "avatar") || null,
    existing
      ? await keepPosition("testimonials", existing)
      : await nextPosition("testimonials"),
    id,
  ];
  if (existing) {
    await run(
      "UPDATE testimonials SET quote=?, name=?, role=?, avatar=?, position=? WHERE id=?",
      ...params,
    );
  } else {
    await run(
      "INSERT INTO testimonials (quote, name, role, avatar, position, id) VALUES (?,?,?,?,?,?)",
      ...params,
    );
  }
  refresh();
}

export async function deleteTestimonial(formData: FormData) {
  await requireAdmin();
  await run("DELETE FROM testimonials WHERE id = ?", str(formData, "id"));
  refresh();
}

export async function saveFaq(formData: FormData) {
  await requireAdmin();
  const existing = str(formData, "id");
  const id = existing || newId("faq");
  const params = [
    str(formData, "question"),
    str(formData, "answer"),
    existing
      ? await keepPosition("faqs", existing)
      : await nextPosition("faqs"),
    id,
  ];
  if (existing) {
    await run(
      "UPDATE faqs SET question=?, answer=?, position=? WHERE id=?",
      ...params,
    );
  } else {
    await run(
      "INSERT INTO faqs (question, answer, position, id) VALUES (?,?,?,?)",
      ...params,
    );
  }
  refresh();
}

export async function deleteFaq(formData: FormData) {
  await requireAdmin();
  await run("DELETE FROM faqs WHERE id = ?", str(formData, "id"));
  refresh();
}

/** An existing logo keeps its place, unless it moved row: then it goes last there. */
async function clientPosition(id: string, rowIndex: number): Promise<number> {
  const row = await one<{ position: number; row_index: number }>("SELECT position, row_index FROM clients WHERE id = ?", id);
  return row && row.row_index === rowIndex ? row.position : await nextPosition("clients", rowIndex);
}

export async function saveClient(formData: FormData) {
  await requireAdmin();
  const existing = str(formData, "id");
  const id = existing || newId("client");
  const rowIndex = numOrNull(formData, "row_index") ?? 0;
  const params = [
    str(formData, "name"),
    str(formData, "logo") || null,
    numOrNull(formData, "width"),
    numOrNull(formData, "height"),
    rowIndex,
    existing ? await clientPosition(existing, rowIndex) : await nextPosition("clients", rowIndex),
    id,
  ];
  if (existing) {
    await run(
      "UPDATE clients SET name=?, logo=?, width=?, height=?, row_index=?, position=? WHERE id=?",
      ...params,
    );
  } else {
    await run(
      "INSERT INTO clients (name, logo, width, height, row_index, position, id) VALUES (?,?,?,?,?,?,?)",
      ...params,
    );
  }
  refresh();
}

export async function deleteClient(formData: FormData) {
  await requireAdmin();
  await run("DELETE FROM clients WHERE id = ?", str(formData, "id"));
  refresh();
}

export async function savePhoto(formData: FormData) {
  await requireAdmin();
  const existing = str(formData, "id");
  const id = existing || newId("photo");
  const params = [
    str(formData, "src"),
    str(formData, "alt"),
    existing
      ? await keepPosition("photos", existing)
      : await nextPosition("photos"),
    id,
  ];
  if (existing) {
    await run("UPDATE photos SET src=?, alt=?, position=? WHERE id=?", ...params);
  } else {
    await run(
      "INSERT INTO photos (src, alt, position, id) VALUES (?,?,?,?)",
      ...params,
    );
  }
  refresh();
}

export async function deletePhoto(formData: FormData) {
  await requireAdmin();
  await run("DELETE FROM photos WHERE id = ?", str(formData, "id"));
  refresh();
}

/* ---------------------------------------------------------------- about */

export async function saveRole(formData: FormData) {
  await requireAdmin();
  const existing = str(formData, "id");
  const params = [
    str(formData, "role"),
    str(formData, "company"),
    str(formData, "period"),
    existing ? await keepPosition("experience", existing) : await nextPosition("experience"),
    existing || newId("exp"),
  ];
  await run(
    existing
      ? "UPDATE experience SET role=?, company=?, period=?, position=? WHERE id=?"
      : "INSERT INTO experience (role, company, period, position, id) VALUES (?,?,?,?,?)",
    ...params,
  );
  refresh();
}

export async function deleteRole(formData: FormData) {
  await requireAdmin();
  await run("DELETE FROM experience WHERE id = ?", str(formData, "id"));
  refresh();
}

export async function saveAward(formData: FormData) {
  await requireAdmin();
  const existing = str(formData, "id");
  const params = [
    str(formData, "name"),
    str(formData, "count"),
    str(formData, "badge") || null,
    str(formData, "href") || null,
    existing ? await keepPosition("awards", existing) : await nextPosition("awards"),
    existing || newId("award"),
  ];
  await run(
    existing
      ? "UPDATE awards SET name=?, count=?, badge=?, href=?, position=? WHERE id=?"
      : "INSERT INTO awards (name, count, badge, href, position, id) VALUES (?,?,?,?,?,?)",
    ...params,
  );
  refresh();
}

export async function deleteAward(formData: FormData) {
  await requireAdmin();
  await run("DELETE FROM awards WHERE id = ?", str(formData, "id"));
  refresh();
}

/* ---------------------------------------------------------------- media */

/* Uploading goes through ./upload-client.ts (in the demo, the file stays in the browser). */

export async function deleteMedia(formData: FormData) {
  await requireAdmin();
  await deleteMediaEverywhere(str(formData, "key"));
  refresh();
}

/* ------------------------------------------------------------- bookings */

export async function deleteBooking(formData: FormData) {
  await requireAdmin();
  await run("DELETE FROM bookings WHERE id = ?", str(formData, "id"));
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
}

/** The bookings table's bulk delete: the rows ticked, at most a page's worth at a time. */
export async function deleteBookings(ids: string[]) {
  await requireAdmin();
  const clean = [...new Set(ids.map(String).filter(Boolean))].slice(0, 500);
  if (!clean.length) return;
  await batch(clean.map((id) => ({ sql: "DELETE FROM bookings WHERE id = ?", params: [id] })));
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
}
