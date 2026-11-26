"use client";

import { useEffect, useState } from "react";

/** Countdown to the start of online sales. Reloads the page when it reaches zero, so the form appears. */
export function Countdown({ target, serverNow, units }: { target: string; serverNow: number; units: string[] }) {
  const end = new Date(target).getTime();
  // Correct for a phone whose clock is wrong: count from the server's time.
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const tick = () => {
      const t = Date.now() + offset;
      setNow(t);
      if (t >= end) window.location.reload();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end, offset]);

  const left = Math.max(0, Math.floor((end - now) / 1000));
  const parts = [Math.floor(left / 86400), Math.floor((left % 86400) / 3600), Math.floor((left % 3600) / 60), left % 60];
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-live="off">
      {parts.map((n, i) => (
        <div key={i} className="rounded-xl bg-ink px-1 py-3 text-center text-linen">
          <span className="block font-sans text-[clamp(1.8rem,8vw,2.6rem)] font-bold leading-none tabular-nums">{String(n).padStart(2, "0")}</span>
          <span className="mt-1 block text-sm text-linen/75">{units[i]}</span>
        </div>
      ))}
    </div>
  );
}
