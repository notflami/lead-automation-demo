"use client";

import { useEffect, useState } from "react";

/**
 * Mobile-only bottom bar. Shown only between the hero button and the reservation
 * section, so it never covers the form; hidden while the keyboard is open.
 */
export function StickyCta({ label }: { label: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-cta");
    const form = document.getElementById("reserve");
    if (!hero || !form) return;
    let typing = false;
    const update = () => {
      const heroGone = hero.getBoundingClientRect().bottom < 0;
      const formAhead = form.getBoundingClientRect().top > window.innerHeight - 40;
      setShow(heroGone && formAhead && !typing);
    };
    const onFocus = (e: FocusEvent) => {
      typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      update();
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    document.addEventListener("focusin", onFocus);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", onFocus);
    };
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-deep/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-200 md:hidden ${
        show ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
      aria-hidden={!show}
    >
      <a href="#reserve" tabIndex={show ? 0 : -1} className="btn-primary w-full">
        {label}
      </a>
    </div>
  );
}
