import AdminLayoutClient from "./AdminLayoutClient";

export const metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function AdminLayout({ children }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
