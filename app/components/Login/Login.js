"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./loginForm.module.css";

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      console.log("Attempting login with email:", email);
      
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      console.log("SignIn result:", result);

      if (result?.error) {
        console.error("Login error:", result.error);
        if (result.error === "CredentialsSignin") {
          setError(
            "Access Denied: Invalid Email or Password. Give It Another Shot."
          );
        } else {
          setError(result.error || "An error occurred during login");
        }
      } else if (result?.ok) {
        console.log("Login successful, redirecting to /admin");
        // Используем window.location для надежного редиректа
        window.location.href = "/admin";
      } else {
        console.warn("Unexpected result format:", result);
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
        type="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Logging in..." : "Login"}
      </button>
      {error && <h2 style={{ color: "red" }}>{error}</h2>}
    </form>
  );
};

export default LoginForm;
