"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "../components/Login/loginForm.module.css";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = useMemo(
    () => String(searchParams.get("token") || "").trim(),
    [searchParams]
  );

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!token) {
      setError("Missing reset token. Open the link from your email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setError(data.message || "Could not reset password");
        return;
      }
      setMessage(data.message || "Password updated.");
      setPassword("");
      setConfirm("");
    } catch (err) {
      console.error(err);
      setError("Unexpected error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h1>Reset password</h1>
      {!token ? (
        <h2 style={{ color: "red", fontSize: 16, textAlign: "center" }}>
          Missing token. Use the link from your email.
        </h2>
      ) : null}
      <input
        type="password"
        placeholder="new password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        autoComplete="new-password"
      />
      <input
        type="password"
        placeholder="confirm password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        minLength={6}
        autoComplete="new-password"
      />
      <button type="submit" disabled={isLoading || !token}>
        {isLoading ? "Saving..." : "Save new password"}
      </button>
      {message && (
        <h2 style={{ color: "teal", fontSize: 16, textAlign: "center" }}>
          {message}{" "}
          <Link href="/login" style={{ color: "inherit" }}>
            Login
          </Link>
        </h2>
      )}
      {error && (
        <h2 style={{ color: "red", fontSize: 16, textAlign: "center" }}>
          {error}
        </h2>
      )}
      <Link href="/login" style={{ color: "inherit", opacity: 0.9 }}>
        Back to login
      </Link>
    </form>
  );
}
