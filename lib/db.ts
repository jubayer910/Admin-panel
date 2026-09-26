import initSqlJs, { type Database, type SqlValue } from "sql.js";
import { useSyncExternalStore } from "react";
import { SCHEMA } from "./demo/schema";
import { seed } from "./demo/seed";

/*
 * The demo's database: SQLite, running in the visitor's browser (sql.js).
 *
 * On a real deployment this module talks to Cloudflare D1. Here the same
 * schema is created in memory and filled with made-up data (lib/demo/seed.ts),
 * so every page and every save works exactly as it does against the real
 * database, only nothing leaves the browser: a refresh starts over.
 *
 * Reads are synchronous once the database has loaded, so pages query it
 * while they render; every write tells the pages to render again.
 */

export type Env = {
  MEDIA_BASE_URL?: string;
  /** where the admin is running, shown in the webhook instructions */
  CANONICAL_HOST?: string;
};

let database: Database | null = null;
let loading: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();
let queued = false;

function notify() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    version++;
    for (const l of listeners) l();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Load sql.js, create the tables and fill them. Once per page load. */
export function loadDatabase(): Promise<void> {
  if (database) return Promise.resolve();
  loading ??= (async () => {
    const SQL = await initSqlJs({ locateFile: (file) => `/sqljs/${file}` });
    const d = new SQL.Database();
    d.exec(SCHEMA);
    d.exec("BEGIN");
    seed(d);
    d.exec("COMMIT");
    database = d;
    notify();
  })();
  return loading;
}

/** true once the data is in; the admin shell waits for it. */
export function useDatabaseReady(): boolean {
  return useSyncExternalStore(subscribe, () => database !== null, () => false);
}

/** Renders again after every write, so the page shows what was saved. */
export function useDatabase(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

function db(): Database {
  if (!database) throw new Error("The demo database is still loading.");
  return database;
}

const value = (v: unknown): SqlValue =>
  v === undefined || v === null ? null : typeof v === "boolean" ? (v ? 1 : 0) : (v as SqlValue);

/** Cloudflare's bindings, as far as the admin reads them. */
export function env(): Env {
  return {
    MEDIA_BASE_URL: "",
    CANONICAL_HOST: typeof location === "undefined" ? "" : location.host,
  };
}

/** All rows for a query. */
export function all<T>(sql: string, ...params: unknown[]): T[] {
  const stmt = db().prepare(sql);
  try {
    stmt.bind(params.map(value));
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

/** First row, or null. */
export function one<T>(sql: string, ...params: unknown[]): T | null {
  return all<T>(sql, ...params)[0] ?? null;
}

/** Write. Returns the number of rows touched. */
export function run(sql: string, ...params: unknown[]): number {
  const d = db();
  d.run(sql, params.map(value));
  const changed = d.getRowsModified();
  notify();
  return changed;
}

/** Several writes, all or nothing. */
export function batch(statements: { sql: string; params?: unknown[] }[]): void {
  const d = db();
  d.exec("BEGIN");
  try {
    for (const s of statements) d.run(s.sql, (s.params ?? []).map(value));
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
  notify();
}

/** Short, URL-safe id. */
export function newId(prefix = ""): string {
  const s = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return prefix ? `${prefix}-${s}` : s;
}

/**
 * Resolve a stored media reference to a URL the browser can fetch.
 * Absolute, blob: and data: URLs pass through; bare keys are the demo's
 * files in public/media/.
 */
export function mediaUrl(ref: string | null | undefined, baseUrl?: string): string | null {
  if (!ref) return null;
  if (/^(https?:|blob:|data:)/.test(ref) || ref.startsWith("/")) return ref;
  const base = (baseUrl ?? "").replace(/\/$/, "");
  return base ? `${base}/${ref}` : `/media/${ref}`;
}

/** What `revalidatePath` does on the server: here, render again. */
export function revalidatePath(path?: string, type?: "layout" | "page"): void {
  void path;
  void type;
  notify();
}
