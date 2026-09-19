import TransferClaimClient from "./TransferClaimClient";

export const metadata = {
  title: "Claim transfer",
  robots: { index: false, follow: false },
};

export default function TransferClaimPage({ params }) {
  const token = params?.token || "";
  return <TransferClaimClient token={token} />;
}
