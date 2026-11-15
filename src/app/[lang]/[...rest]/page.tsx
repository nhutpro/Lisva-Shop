import { notFound } from "next/navigation";

// Any URL under /vi or /en that no other route matches shows the localized not-found page.
export default function UnknownPage() {
  notFound();
}
