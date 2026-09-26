import { redirect } from "next/navigation";

/* The demo is the admin; there is no public site in this repo. */
export default function Home() {
  redirect("/admin");
}
