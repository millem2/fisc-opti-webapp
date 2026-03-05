import { FiscalInput, FiscalResult } from "@/types/fiscal";

export interface UserSelf {
  id: string;
  email: string;
  fiscalProfile?: FiscalInput;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

function authHeader(username: string, password: string): string {
  return "Basic " + btoa(`${username}:${password}`);
}

function getStoredCredentials(): { username: string; password: string } | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("fiscopti_credentials");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeCredentials(username: string, password: string): void {
  sessionStorage.setItem("fiscopti_credentials", JSON.stringify({ username, password }));
}

export function clearCredentials(): void {
  sessionStorage.removeItem("fiscopti_credentials");
}

export function isAuthenticated(): boolean {
  return getStoredCredentials() !== null;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const creds = getStoredCredentials();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (creds) {
    headers["Authorization"] = authHeader(creds.username, creds.password);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/self`, {
    headers: {
      Authorization: authHeader(email, password),
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  storeCredentials(email, password);
}

export async function register(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    // Parse constraint violations into a readable message
    try {
      const json = JSON.parse(text);
      if (json.violations?.length) {
        throw new Error(json.violations.map((v: { message: string }) => v.message).join(". "));
      }
      throw new Error(json.title ?? text);
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error(text);
      throw e;
    }
  }
}

export interface DocumentMeta {
  id: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  category: string;
  uploadedAt: string;
}

export async function uploadDocument(file: File, category: string): Promise<DocumentMeta> {
  const creds = getStoredCredentials();
  const form = new FormData();
  form.append("file", file);
  form.append("category", category);
  const headers: Record<string, string> = {};
  if (creds) headers["Authorization"] = authHeader(creds.username, creds.password);
  const res = await fetch(`${API_BASE}/documents`, { method: "POST", headers, body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Upload échoué (${res.status}): ${text}`);
  }
  return res.json() as Promise<DocumentMeta>;
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  return apiFetch<DocumentMeta[]>("/documents");
}

export async function getSelf(): Promise<UserSelf> {
  return apiFetch<UserSelf>("/users/self");
}

export async function saveProfile(profile: FiscalInput): Promise<void> {
  await apiFetch<unknown>("/users/self/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

export async function optimize(input: FiscalInput): Promise<FiscalResult> {
  return apiFetch<FiscalResult>("/fiscal/optimize", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface SimulationRecord {
  id: string;
  userId: string;
  label?: string;
  simulatedAt: string;
  fiscalInput: FiscalInput;
  fiscalResult: FiscalResult;
}

export async function saveSimulation(input: FiscalInput, label?: string): Promise<SimulationRecord> {
  return apiFetch<SimulationRecord>("/simulations", {
    method: "POST",
    body: JSON.stringify({ input, label }),
  });
}

export async function listSimulations(): Promise<SimulationRecord[]> {
  return apiFetch<SimulationRecord[]>("/simulations");
}
