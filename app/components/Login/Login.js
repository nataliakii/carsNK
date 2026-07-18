"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import styles from "./loginForm.module.css";

const isDev = process.env.NODE_ENV === "development";

const LoginForm = () => {
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
          setError(
            "Access Denied: Invalid Email or Password. Give It Another Shot."
          );
        } else {
          setError(result.error || "An error occurred during login");
        }
      } else if (result?.ok) {
        window.location.href = "/admin";
      } else {
        setError("Unexpected response. Please try again.");
      }
    } catch (error) {
      console.error("Login exception:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h1>Login</h1>
      <input
        type={isDev ? "text" : "email"}
        placeholder={isDev ? "email (empty = superadmin)" : "email"}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required={!isDev}
        autoComplete="username"
      />
      <input
        type="password"
        placeholder={isDev ? "password (empty = superadmin)" : "password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required={!isDev}
        autoComplete="current-password"
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Logging in..." : "Login"}
      </button>
      {error && <h2 style={{ color: "red" }}>{error}</h2>}
    </form>
  );
};

export default LoginForm;
