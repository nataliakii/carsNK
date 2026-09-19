import Login from "../components/Login/Login";
import { getActiveBrand } from "@config/brand";

export const metadata = {
  title: {
    absolute: `Admin sign in | ${getActiveBrand().name}`,
  },
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <Login />;
}
