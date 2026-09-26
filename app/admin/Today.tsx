"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Today's date in the admin's own time zone; nothing on the server, which does not know it. */
export function Today() {
  const local = useSyncExternalStore(subscribe, () => true, () => false);
  if (!local) return null;
  return <>{new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</>;
}
