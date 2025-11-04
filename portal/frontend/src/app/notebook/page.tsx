import { Suspense } from "react";
import NotebookClient from "./NotebookClient";

export const dynamic = "force-static"; // fine for export

export default function Page() {
  return (
    <Suspense>
      <NotebookClient />
    </Suspense>
  );
}