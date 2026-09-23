import { notFound } from "next/navigation";

export const metadata = {
  title: "Dev previews",
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return children;
}
