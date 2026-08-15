"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../components/Login/loginForm.module.css";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setError(data.message || "Could not send reset email");
        return;
      }
      setMessage(
        data.message ||
          "If an account exists for this email, a reset link has been sent."
      );
    } catch (err) {
      console.error(err);
      setError("Unexpected error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h1>Forgot password</h1>
      <p style={{ margin: 0, textAlign: "center", opacity: 0.85, fontSize: 14 }}>
        Enter your admin email. We will send a reset link if the account exists.
      </p>
      <input
        type="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="username"
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Sending..." : "Send reset link"}
      </button>
      {message && (
        <h2 style={{ color: "teal", fontSize: 16, textAlign: "center" }}>
          {message}
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
