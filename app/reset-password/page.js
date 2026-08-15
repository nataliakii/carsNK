import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = {
  robots: { index: false, follow: false },
};

const containerStyle = {
  width: "100%",
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default function ResetPasswordPage() {
  return (
    <div style={containerStyle}>
      <Suspense fallback={<div>Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
