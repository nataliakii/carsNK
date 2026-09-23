"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { getActiveBrand } from "@config/brand";
import { SiteLogo, SiteMark } from "@app/components/brand/RovaroLogo";
import styles from "./loginForm.module.css";

const isDev = process.env.NODE_ENV === "development";

export default function LoginForm() {
  const brand = getActiveBrand();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "CredentialsSignin") {
          setError("Invalid email or password. Try again.");
        } else {
          setError(result.error || "An error occurred during login");
        }
      } else if (result?.ok) {
        window.location.href = "/admin";
      } else {
        setError("Unexpected response. Please try again.");
      }
    } catch (err) {
      console.error("Login exception:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page} data-brand={brand.id}>
      <div className={styles.glowA} aria-hidden />
      <div className={styles.glowB} aria-hidden />
      <div className={styles.grain} aria-hidden />

      <div className={styles.shell}>
        <header className={styles.brandBlock}>
        


          <SiteLogo variant="dark" height={42} priority />
          <p className={styles.tagline}>{brand.tagline}</p>
        </header>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <h1 className={styles.title}>Admin sign in</h1>
          <p className={styles.subtitle}>Access the fleet and booking console</p>

          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              type={isDev ? "text" : "email"}
              placeholder={isDev ? "Leave empty for local superadmin" : "you@company.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={!isDev}
              autoComplete="username"
              autoFocus
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              className={styles.input}
              type="password"
              placeholder={isDev ? "Leave empty for local superadmin" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isDev}
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          {isDev ? (
            <p className={styles.devHint}>
              Local tip: empty fields → Superadmin
            </p>
          ) : null}

          <button
            type="submit"
            className={styles.submit}
            disabled={isLoading}
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </button>

          <Link href="/forgot-password" className={styles.forgot}>
            Forgot password?
          </Link>
        </form>

        <p className={styles.footerNote}>
          <Link href="/en" className={styles.homeLink}>
            ← Back to {brand.name}
          </Link>
        </p>
      </div>
    </div>
  );
}
