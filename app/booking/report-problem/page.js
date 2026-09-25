import { Suspense } from "react";

import ReportProblemForm from "./ReportProblemForm";

export default function ReportProblemPage() {
  return (
    <Suspense fallback={null}>
      <ReportProblemForm />
    </Suspense>
  );
}
