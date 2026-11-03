import { permanentRedirect } from "next/navigation";

/** Legacy URL: the workflow tour now lives at /tour. */
export default function Page() {
  permanentRedirect("/tour");
}
