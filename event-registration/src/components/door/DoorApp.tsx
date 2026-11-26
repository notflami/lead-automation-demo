"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { checkInAction, countsAction, doorLogoutAction, guestAction, lookupAction, undoAction } from "@/app/door/actions";
import type { DoorGuest, LookupResult } from "@/lib/door";

type Counts = { inside: number; expected: number };
type Shown = LookupResult | { kind: "admitted"; guest: DoorGuest; admitted: number };
type Camera = "off" | "starting" | "on" | "denied" | "unavailable";

const STOP: Record<Exclude<DoorGuest["verdict"], "ok">, { title: string; text: string }> = {
  all_in: { title: "Bereits eingelassen", text: "Dieser QR-Code wurde schon benutzt." },
  cancelled: { title: "Ungültig", text: "Die Reservierung wurde storniert." },
  refunded: { title: "Ungültig", text: "Das Geld wurde erstattet." },
  waitlisted: { title: "Nicht bestätigt", text: "Nur auf der Warteliste, kein Ticket." },
  unpaid: { title: "Nicht bezahlt", text: "Die Zahlung wurde nicht abgeschlossen." },
  anonymised: { title: "Ungültig", text: "Diese Reservierung existiert nicht mehr." },
};

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "";

function buzz(ok: boolean) {
  try {
    navigator.vibrate?.(ok ? 80 : [200, 100, 200]);
  } catch {}
}

export function DoorApp(props: { eventName: string; minAge: number; initialCounts: Counts; isAdmin: boolean }) {
  const [counts, setCounts] = useState(props.initialCounts);
  const [shown, setShown] = useState<Shown | null>(null);
  const [admitCount, setAdmitCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [camera, setCamera] = useState<Camera>("off");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  const signedOut = () => window.location.reload();

  const show = useCallback((r: Shown) => {
    setShown(r);
    if (r.kind === "guest") {
      setAdmitCount(Math.max(1, r.guest.guestCount - r.guest.checkedIn));
      buzz(r.guest.verdict === "ok");
    } else if (r.kind === "not_found") buzz(false);
    scanningRef.current = false;
  }, []);

  const lookup = useCallback(
    async (code: string) => {
      if (!code.trim()) return;
      setBusy(true);
      setError(null);
      try {
        const res = await lookupAction(code);
        if (res.signedOut) return signedOut();
        setCounts(res.counts);
        show(res.result);
      } catch {
        setError("Keine Verbindung. Bitte nochmal versuchen.");
        scanningRef.current = true;
      } finally {
        setBusy(false);
      }
    },
    [show],
  );

  // ------------------------------------------------------------ camera + QR decoding
  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera("off");
  }, []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return setCamera("unavailable");
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCamera("on");
      scanningRef.current = true;
    } catch (e) {
      setCamera(e instanceof DOMException && e.name === "NotAllowedError" ? "denied" : "unavailable");
    }
  }

  useEffect(() => {
    if (camera !== "on") return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const video = videoRef.current;
      if (scanningRef.current && video && video.readyState >= 2 && video.videoWidth) {
        const scale = Math.min(1, 640 / video.videoWidth);
        const w = Math.round(video.videoWidth * scale);
        const h = Math.round(video.videoHeight * scale);
        const canvas = (canvasRef.current ??= document.createElement("canvas"));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            scanningRef.current = false;
            lookup(code.data);
          }
        }
      }
      timer = setTimeout(tick, 150);
    };
    tick();
    return () => clearTimeout(timer);
  }, [camera, lookup]);

  useEffect(() => stopCamera, [stopCamera]);

  // Keep the "inside" counter current when several door phones are in use.
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await countsAction();
        if (res.signedOut) return signedOut();
        setCounts(res.counts);
      } catch {}
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  function next() {
    setShown(null);
    setManual("");
    setError(null);
    if (camera === "on") scanningRef.current = true;
  }

  async function admit(guest: DoorGuest) {
    setBusy(true);
    setError(null);
    try {
      const res = await checkInAction(guest.id, admitCount);
      if (res.signedOut) return signedOut();
      setCounts(res.counts);
      if (res.ok && res.guest) {
        buzz(true);
        setShown({ kind: "admitted", guest: res.guest, admitted: admitCount });
      } else if (res.guest) show({ kind: "guest", guest: res.guest });
    } catch {
      setError("Keine Verbindung. Bitte nochmal versuchen.");
    } finally {
      setBusy(false);
    }
  }

  async function undo(guest: DoorGuest, n: number) {
    setBusy(true);
    try {
      const res = await undoAction(guest.id, n);
      if (res.signedOut) return signedOut();
      setCounts(res.counts);
      if (res.guest) show({ kind: "guest", guest: res.guest });
    } catch {
      setError("Keine Verbindung. Bitte nochmal versuchen.");
    } finally {
      setBusy(false);
    }
  }

  async function pick(id: string) {
    setBusy(true);
    try {
      const res = await guestAction(id);
      if (res.signedOut) return signedOut();
      show(res.guest ? { kind: "guest", guest: res.guest } : { kind: "not_found" });
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------ render
  return (
    <div className="min-h-dvh bg-ink text-linen">
      <header className="flex items-center gap-3 px-4 py-3">
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm text-linen/70">{props.eventName}</p>
          <p className="text-lg font-semibold tabular-nums">
            Drinnen: {counts.inside} / {counts.expected}
          </p>
        </div>
        {!props.isAdmin && (
          <form action={doorLogoutAction}>
            <button className="min-h-11 rounded-full border border-linen/30 px-4 text-sm">Abmelden</button>
          </form>
        )}
      </header>

      <main className="mx-auto max-w-md px-4 pb-10">
        {/* The video stays mounted so the camera keeps running between guests. */}
        <div className={`relative overflow-hidden rounded-2xl bg-black ${shown ? "hidden" : ""}`}>
          <video ref={videoRef} playsInline muted className={`aspect-square w-full object-cover ${camera === "on" ? "" : "hidden"}`} />
          {camera === "on" && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-saffron/90" />
          )}
          {camera !== "on" && (
            <div className="grid aspect-square place-items-center p-6 text-center">
              <div>
                <button type="button" onClick={startCamera} disabled={camera === "starting"} className="btn-primary text-xl">
                  {camera === "starting" ? "Kamera startet…" : "Kamera starten"}
                </button>
                {camera === "denied" && (
                  <p className="mt-4 text-base text-linen/80">
                    Kamera blockiert. Bitte in den Browser-Einstellungen den Kamerazugriff für diese Seite erlauben, dann neu laden.
                  </p>
                )}
                {camera === "unavailable" && (
                  <p className="mt-4 text-base text-linen/80">Keine Kamera verfügbar. Nummer oder Name unten eingeben.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {!shown && (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              lookup(manual);
            }}>
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="REG-Nummer oder Name"
              aria-label="REG-Nummer oder Name"
              autoComplete="off"
              className="min-h-14 min-w-0 flex-1 rounded-xl border-2 border-linen/30 bg-white px-4 text-lg text-ink outline-none focus:border-saffron"
            />
            <button disabled={busy || !manual.trim()} className="min-h-14 rounded-xl bg-linen px-5 text-lg font-semibold text-ink disabled:opacity-50">
              Suchen
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-kilim px-4 py-3 text-lg font-semibold text-white">
            {error}
          </p>
        )}
        {busy && !shown && <p className="mt-4 text-center text-lg text-linen/80">Suche…</p>}

        {shown && (
          <section aria-live="assertive" className="mt-2">
            {shown.kind === "not_found" && (
              <Verdict tone="stop" title="Nicht gefunden" text="Kein Ticket zu diesem Code oder Namen." />
            )}

            {shown.kind === "list" && (
              <div className="rounded-2xl bg-linen p-4 text-ink">
                <p className="text-lg font-semibold">Mehrere Treffer – Gast wählen:</p>
                <ul className="mt-3 divide-y divide-ink/10">
                  {shown.guests.map((g) => (
                    <li key={g.id}>
                      <button type="button" onClick={() => pick(g.id)} className="flex min-h-14 w-full items-center gap-3 text-left">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-lg font-semibold">{g.fullName}</span>
                          <span className="block text-sm text-muted">
                            {g.reference} · {g.guestCount} Pers.{g.ticketType === "vip" ? " · VIP" : ""}
                          </span>
                        </span>
                        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${g.verdict === "ok" ? "bg-moss text-white" : "bg-kilim text-white"}`}>
                          {g.verdict === "ok" ? "gültig" : STOP[g.verdict].title}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {shown.kind === "guest" && (
              <>
                {shown.guest.verdict === "ok" ? (
                  <Verdict
                    tone="go"
                    title="Gültig"
                    text={props.minAge > 0 ? `Ausweis prüfen · ab ${props.minAge} Jahren` : "Ausweis prüfen"}
                  />
                ) : (
                  <Verdict
                    tone="stop"
                    title={STOP[shown.guest.verdict].title}
                    text={
                      shown.guest.verdict === "all_in"
                        ? `Alle ${shown.guest.guestCount} Personen sind schon drin (seit ${time(shown.guest.checkedInAt)} Uhr).`
                        : STOP[shown.guest.verdict].text
                    }
                  />
                )}
                <GuestCard guest={shown.guest} />
                {shown.guest.verdict === "ok" && (
                  <div className="mt-4 rounded-2xl bg-linen p-4 text-ink">
                    {shown.guest.guestCount - shown.guest.checkedIn > 1 && (
                      <div className="mb-4">
                        <p className="text-lg font-semibold">Wie viele kommen jetzt rein?</p>
                        <div className="mt-2 flex items-center gap-4">
                          <Step label="Weniger" disabled={admitCount <= 1} onClick={() => setAdmitCount((n) => n - 1)}>
                            −
                          </Step>
                          <span className="min-w-12 text-center text-4xl font-bold tabular-nums">{admitCount}</span>
                          <Step
                            label="Mehr"
                            disabled={admitCount >= shown.guest.guestCount - shown.guest.checkedIn}
                            onClick={() => setAdmitCount((n) => n + 1)}>
                            +
                          </Step>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => admit(shown.guest)}
                      className="min-h-16 w-full rounded-2xl bg-moss px-5 text-2xl font-bold text-white disabled:opacity-60">
                      {busy ? "…" : `${admitCount} ${admitCount === 1 ? "Person" : "Personen"} einlassen`}
                    </button>
                  </div>
                )}
              </>
            )}

            {shown.kind === "admitted" && (
              <>
                <Verdict
                  tone="go"
                  title={`✓ ${shown.admitted} eingelassen`}
                  text={
                    shown.guest.checkedIn < shown.guest.guestCount
                      ? `${shown.guest.guestCount - shown.guest.checkedIn} von ${shown.guest.guestCount} kommen noch (gleicher QR-Code).`
                      : "Viel Spaß!"
                  }
                />
                <GuestCard guest={shown.guest} />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => undo(shown.guest, shown.admitted)}
                  className="mt-3 min-h-12 w-full rounded-xl border-2 border-linen/40 text-lg font-semibold">
                  Rückgängig
                </button>
              </>
            )}

            <button type="button" onClick={next} className="btn-primary mt-4 w-full text-xl">
              Nächster Gast
            </button>
          </section>
        )}

        {!props.isAdmin && <p className="mt-8 text-center text-sm text-linen/50">Nur für das Einlass-Team.</p>}
      </main>
    </div>
  );
}

function Verdict({ tone, title, text }: { tone: "go" | "stop"; title: string; text: string }) {
  return (
    <div className={`rounded-2xl px-5 py-5 text-white ${tone === "go" ? "bg-moss" : "bg-kilim"}`}>
      <p className="text-4xl font-black uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-lg font-medium">{text}</p>
    </div>
  );
}

function GuestCard({ guest }: { guest: DoorGuest }) {
  return (
    <div className="mt-3 rounded-2xl bg-linen p-4 text-ink">
      <p className="text-2xl font-bold">{guest.fullName}</p>
      <p className="mt-1 text-base text-muted">{guest.reference}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-lg">
        <span className="rounded-full bg-ink px-3 py-1 font-semibold text-linen">
          {guest.guestCount} {guest.guestCount === 1 ? "Person" : "Personen"}
        </span>
        {guest.ticketType === "vip" && <span className="rounded-full bg-saffron px-3 py-1 font-bold text-ink">★ VIP</span>}
        {guest.paid && <span className="rounded-full border border-moss px-3 py-1 font-semibold text-moss">bezahlt</span>}
        {guest.checkedIn > 0 && (
          <span className="rounded-full border border-ink/30 px-3 py-1">
            drin: {guest.checkedIn}/{guest.guestCount}
          </span>
        )}
      </div>
    </div>
  );
}

function Step(props: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="grid size-14 place-items-center rounded-full border-2 border-ink text-3xl disabled:border-ink/20 disabled:text-ink/25">
      {props.children}
    </button>
  );
}
