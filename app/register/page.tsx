"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { register } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import AuthLayout from "@/app/components/AuthLayout";

const PASSWORD_HINT = "8 car. min · 1 majuscule · 1 chiffre · 1 caractère spécial";

function FieldInput({
  label, type = "text", value, onChange, placeholder, description, isInvalid, errorMessage, autoComplete,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; description?: string; isInvalid?: boolean; errorMessage?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full px-3 py-2.5 border rounded-xl text-sm outline-none transition-all
          ${isInvalid ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-[#1B3D2C] focus:ring-1 focus:ring-[#1B3D2C]/20"}`}
      />
      {isInvalid && errorMessage && (
        <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
      )}
      {description && !isInvalid && (
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      await login(email, password);
      router.push("/profil");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FieldInput
          label="Adresse e-mail"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="vous@exemple.fr"
          autoComplete="email"
        />
        <FieldInput
          label="Mot de passe"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Choisissez un mot de passe"
          description={PASSWORD_HINT}
          autoComplete="new-password"
        />
        <FieldInput
          label="Confirmer le mot de passe"
          type="password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Répétez votre mot de passe"
          autoComplete="new-password"
          isInvalid={confirm.length > 0 && password !== confirm}
          errorMessage="Les mots de passe ne correspondent pas"
        />

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        <Button
          type="submit"
          isLoading={loading}
          fullWidth
          className="h-11 font-semibold text-white mt-1 rounded-xl"
          style={{ backgroundColor: "#1B3D2C" }}
        >
          Créer mon compte
        </Button>
      </form>
    </AuthLayout>
  );
}
