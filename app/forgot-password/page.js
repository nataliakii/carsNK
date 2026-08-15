import ForgotPasswordForm from "./ForgotPasswordForm";

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

export default function ForgotPasswordPage() {
  return (
    <div style={containerStyle}>
      <ForgotPasswordForm />
    </div>
  );
}
