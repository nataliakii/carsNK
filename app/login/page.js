import React from "react";
import Login from "../components/Login/Login";

export const metadata = {
  robots: { index: false, follow: true },
};

const containerStyle = {
  width: "100%",
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const LoginPage = () => {
  return (
    <div style={containerStyle}>
      <Login />{" "}
    </div>
  );
};

export default LoginPage;

// "use client";
// import { signIn } from "next-auth/react";
// import { useState } from "react";

// export default function LoginForm() {
//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     try {
//       const result = await signIn("credentials", {
//         username,
//         password,
//         redirect: false,
//       });
//       if (result.error) {
//         alert(result.error);
//       } else {
//         window.location.href = "/admin";
//       }
//     } catch (error) {
//       console.error("Login error:", error);
//     }
//   };

//   return (
//     <form onSubmit={handleSubmit}>
//       <input
//         type="text"
//         value={username}
//         onChange={(e) => setUsername(e.target.value)}
//         placeholder="Username"
//       />
//       <input
//         type="password"
//         value={password}
//         onChange={(e) => setPassword(e.target.value)}
//         placeholder="Password"
//       />
//       <button type="submit">Login</button>
//     </form>
//   );
// }
