// store/historyDb.ts — historial de cálculos con IndexedDB (spec v10 §3:
// "persistencia local" vía `idb`, ya listado como dependencia desde el
// Módulo 1). Sin backend, el historial vive enteramente en el navegador del
// usuario — se pierde si limpia datos del sitio, lo cual es aceptable y
// coherente con "sin backend" (spec v10 §16, sincronización en la nube
// explícitamente fuera de alcance).

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface HistoryEntry {
  id: string;
  mode: string;
  input: string;
  resultSummary: string;
  timestamp: number;
}

interface CalcDB extends DBSchema {
  history: {
    key: string;
    value: HistoryEntry;
    indexes: { "by-timestamp": number };
  };
}

const DB_NAME = "calculadora-historial";
const DB_VERSION = 1;
const MAX_ENTRIES = 200; // evita que el historial crezca sin límite en IndexedDB

let dbPromise: Promise<IDBPDatabase<CalcDB>> | null = null;

function getDb(): Promise<IDBPDatabase<CalcDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CalcDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("history", { keyPath: "id" });
        store.createIndex("by-timestamp", "timestamp");
      },
    });
  }
  return dbPromise;
}

export async function addHistoryEntry(entry: Omit<HistoryEntry, "id" | "timestamp">): Promise<void> {
  const db = await getDb();
  const full: HistoryEntry = { ...entry, id: crypto.randomUUID?.() ?? String(Math.random()), timestamp: Date.now() };
  await db.put("history", full);

  // Poda entradas antiguas si se pasa del límite (spec v10 §3, persistencia acotada).
  const all = await db.getAllFromIndex("history", "by-timestamp");
  if (all.length > MAX_ENTRIES) {
    const toDelete = all.slice(0, all.length - MAX_ENTRIES);
    const tx = db.transaction("history", "readwrite");
    await Promise.all(toDelete.map((e) => tx.store.delete(e.id)));
    await tx.done;
  }
}

export async function getAllHistoryEntries(): Promise<HistoryEntry[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("history", "by-timestamp");
  return all.reverse(); // más reciente primero
}

export async function clearHistory(): Promise<void> {
  const db = await getDb();
  await db.clear("history");
}
