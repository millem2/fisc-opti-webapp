"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Button, Chip, Progress } from "@heroui/react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/lib/auth-context";
import AppShell from "@/app/components/AppShell";
import { uploadDocument, listDocuments, DocumentMeta } from "@/lib/api";

type DocCategory = "fiche_paie" | "avis_imposition" | "facture" | "autre";

const CATEGORY_LABELS: Record<string, string> = {
  fiche_paie: "Fiche de paie",
  avis_imposition: "Avis d'imposition",
  facture: "Facture",
  autre: "Autre",
};

const CATEGORY_COLORS: Record<string, "primary" | "secondary" | "warning" | "default"> = {
  fiche_paie: "primary",
  avis_imposition: "secondary",
  facture: "warning",
  autre: "default",
};

function guessCategory(filename: string): DocCategory {
  const lower = filename.toLowerCase();
  if (lower.includes("paie") || lower.includes("bulletin")) return "fiche_paie";
  if (lower.includes("impot") || lower.includes("avis")) return "avis_imposition";
  if (lower.includes("facture") || lower.includes("invoice")) return "facture";
  return "autre";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

interface PendingUpload {
  tempId: string;
  file: File;
  category: DocCategory;
  status: "uploading" | "error";
  error?: string;
}

export default function DocumentsPage() {
  const { authenticated, initializing } = useAuth();
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initializing) return;
    if (!authenticated) { router.replace("/login"); return; }
    listDocuments()
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [initializing, authenticated, router]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploads: PendingUpload[] = acceptedFiles.map((file) => ({
      tempId: `${Date.now()}-${Math.random()}`,
      file,
      category: guessCategory(file.name),
      status: "uploading" as const,
    }));
    setPending((prev) => [...uploads, ...prev]);

    uploads.forEach((up) => {
      uploadDocument(up.file, up.category)
        .then((meta) => {
          setPending((prev) => prev.filter((p) => p.tempId !== up.tempId));
          setDocs((prev) => [meta, ...prev]);
        })
        .catch((err: unknown) => {
          setPending((prev) =>
            prev.map((p) =>
              p.tempId === up.tempId
                ? { ...p, status: "error" as const, error: err instanceof Error ? err.message : "Erreur" }
                : p
            )
          );
        });
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "image/*": [".jpg", ".jpeg", ".png"] },
    multiple: true,
  });

  function dismissError(tempId: string) {
    setPending((prev) => prev.filter((p) => p.tempId !== tempId));
  }

  const totalCount = docs.length + pending.length;

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Mes Documents</h1>

      {/* Upload zone */}
      <Card className="mb-6">
        <CardBody>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
              ${isDragActive ? "border-primary bg-blue-50" : "border-gray-300 hover:border-primary hover:bg-gray-50"}`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {isDragActive ? (
                <p className="text-primary font-medium">Déposez vos fichiers ici…</p>
              ) : (
                <>
                  <p className="font-medium text-gray-700">Glissez-déposez vos documents ici</p>
                  <p className="text-sm text-gray-400">ou cliquez pour parcourir</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG acceptés</p>
                </>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* RGPD banner */}
      <Card className="mb-6 border border-blue-200 bg-blue-50">
        <CardBody className="flex flex-row items-start gap-3">
          <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Vos documents sont sécurisés</p>
            <p>Seules les métadonnées (nom, taille, type) sont enregistrées. Aucune donnée identifiante n&apos;est conservée.</p>
          </div>
        </CardBody>
      </Card>

      {/* Document list */}
      {(loading || totalCount > 0) && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold">
              {loading ? "Chargement…" : `Documents importés (${totalCount})`}
            </h3>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {/* Pending uploads */}
            {pending.map((up) => (
              <div key={up.tempId} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 bg-gray-50">
                <svg className="w-8 h-8 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{up.file.name}</p>
                  <p className="text-xs text-gray-400">{formatSize(up.file.size)}</p>
                  {up.status === "uploading" && <Progress size="sm" isIndeterminate className="mt-1 max-w-xs" />}
                  {up.status === "error" && <p className="text-xs text-danger mt-1">{up.error}</p>}
                </div>
                <Chip size="sm" color={CATEGORY_COLORS[up.category] ?? "default"} variant="flat">
                  {CATEGORY_LABELS[up.category] ?? "Autre"}
                </Chip>
                <Chip size="sm" color={up.status === "error" ? "danger" : "default"} variant="dot">
                  {up.status === "uploading" ? "Envoi…" : "Erreur"}
                </Chip>
                {up.status === "error" && (
                  <Button size="sm" variant="light" color="danger" isIconOnly onPress={() => dismissError(up.tempId)}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                )}
              </div>
            ))}

            {/* Stored docs */}
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 bg-gray-50">
                <svg className="w-8 h-8 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.originalFilename}</p>
                  <p className="text-xs text-gray-400">{formatSize(doc.sizeBytes)}</p>
                </div>
                <Chip size="sm" color={CATEGORY_COLORS[doc.category] ?? "default"} variant="flat">
                  {CATEGORY_LABELS[doc.category] ?? doc.category}
                </Chip>
                <Chip size="sm" color="success" variant="dot">Enregistré</Chip>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {!loading && totalCount === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          Aucun document importé pour l&apos;instant.
        </div>
      )}
    </AppShell>
  );
}
