/**
 * Woven kilim frame for the reservation form: deep red ground with chevron bands
 * (black / tan / white), white zigzags, diamond rows and thin stripes, after the
 * Balkan rug reference. One SVG tile, repeated as a CSS background. Server-rendered.
 */
const W = 96;
const H = 200;
const C = { red: "#8b1212", dark: "#5c0b0b", black: "#1d1414", tan: "#c99a6e", white: "#f6efe4" };

function tile(): string {
  const p: string[] = [`<rect width="${W}" height="${H}" fill="${C.red}"/>`];
  const rect = (y: number, h: number, fill: string) => p.push(`<rect y="${y}" width="${W}" height="${h}" fill="${fill}"/>`);
  const dots = (y: number, fill: string, step = 8) => {
    for (let x = 2; x < W; x += step) p.push(`<rect x="${x}" y="${y}" width="3" height="3" fill="${fill}"/>`);
  };
  const chevrons = (y: number, h: number) => {
    rect(y - 2, h + 4, C.dark);
    const colors = [C.black, C.tan, C.white, C.black];
    for (let i = 0; i < W / 24; i++) {
      colors.forEach((c, k) => {
        const x = i * 24 + k * 6 - 4;
        p.push(`<polygon points="${x},${y} ${x + 5},${y} ${x + 13},${y + h / 2} ${x + 5},${y + h} ${x},${y + h} ${x + 8},${y + h / 2}" fill="${c}"/>`);
      });
    }
  };
  const zigzag = (y: number, h: number, up: boolean) => {
    let d = "";
    for (let x = 0; x < W; x += 12) d += up ? `M${x},${y + h}L${x + 6},${y}L${x + 12},${y + h}Z` : `M${x},${y}L${x + 6},${y + h}L${x + 12},${y}Z`;
    p.push(`<path d="${d}" fill="${C.white}"/>`);
  };
  const diamonds = (y: number) => {
    for (let x = 12; x < W; x += 24) {
      p.push(`<path d="M${x},${y}l8,8l-8,8l-8,-8Z" fill="${C.white}"/>`, `<path d="M${x},${y + 5}l3,3l-3,3l-3,-3Z" fill="${C.red}"/>`);
      p.push(`<rect x="${x + 10}" y="${y + 7}" width="3" height="3" fill="${C.tan}"/>`);
    }
  };
  rect(0, 4, C.dark);
  dots(8, C.white);
  chevrons(16, 22);
  rect(42, 3, C.tan);
  rect(47, 2, C.white);
  zigzag(54, 10, true);
  rect(68, 3, C.tan);
  diamonds(78);
  dots(100, C.white);
  zigzag(108, 10, false);
  rect(122, 3, C.tan);
  rect(127, 2, C.white);
  chevrons(136, 22);
  rect(162, 3, C.tan);
  dots(170, C.white);
  diamonds(178);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${p.join("")}</svg>`;
}

const PATTERN = `url("data:image/svg+xml,${encodeURIComponent(tile())}")`;

export function KilimFrame({ children, className = "", ...rest }: React.HTMLAttributes<HTMLElement> & { children: React.ReactNode }) {
  return (
    <section
      {...rest}
      className={`rounded-[26px] px-3 py-7 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] sm:px-6 sm:py-10 ${className}`}
      style={{ backgroundImage: PATTERN, backgroundSize: `${W}px ${H}px`, backgroundColor: C.red }}
    >
      <div className="rounded-[18px] bg-white p-4 text-ink shadow-[0_0_0_3px_#1d1414] min-[380px]:p-5 sm:p-7">{children}</div>
    </section>
  );
}
