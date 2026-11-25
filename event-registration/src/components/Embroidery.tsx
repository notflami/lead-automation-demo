/**
 * Cross-stitch band inspired by the rhombus-and-hook motifs of Balkan kilims
 * and embroidered towels (peškir). Each cell is drawn as an X stitch.
 * Rendered on the server as plain SVG; animated by CSS (`.stitch-in`).
 */
type Thread = "kilim" | "saffron" | "ink";

const COLORS: Record<Thread, string> = {
  kilim: "var(--color-kilim)",
  saffron: "var(--color-saffron)",
  ink: "var(--color-ink)",
};

const TILE_W = 18;
const ROWS = 19; // 2 border rows + 15 motif rows + spacing

function threadAt(x: number, y: number): Thread | null {
  // borders: a running stitch line top and bottom
  if (y === 0 || y === ROWS - 1) return x % 2 === 0 ? "ink" : null;
  if (y === 1 || y === ROWS - 2) return null;
  const my = y - 2; // 0..14
  const dx = x - 9;
  const dy = my - 7;
  const d = Math.abs(dx) + Math.abs(dy);
  if (d === 7) return "kilim";
  if (d === 5) return "saffron";
  if (d === 3) return "kilim";
  if (d === 0) return "ink";
  // hooks (kuke) growing from the four tips
  if ((Math.abs(dy) === 8 || Math.abs(dy) === 7) && Math.abs(dx) === 1 && d === 8) return "kilim";
  // small ink diamonds between the large rhombi
  const sx = x === 0 ? 0 : x === TILE_W - 1 ? 1 : null;
  if (sx !== null && Math.abs(dy) <= 1 && (Math.abs(dy) === 1 || x === 0)) return "ink";
  if (x === 1 && dy === 0) return "ink";
  return null;
}

export function Embroidery({
  tiles = 14,
  cell = 6,
  animate = false,
  className = "",
}: {
  tiles?: number;
  cell?: number;
  animate?: boolean;
  className?: string;
}) {
  const cols = TILE_W * tiles;
  const stitches: { x: number; y: number; c: Thread }[] = [];
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < ROWS; y++) {
      const c = threadAt(x % TILE_W, y);
      if (c) stitches.push({ x, y, c });
    }
  }
  const w = cols * cell;
  const h = ROWS * cell;
  const p = cell * 0.18;
  return (
    <div className={`overflow-hidden ${className}`} aria-hidden="true">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className={`mx-auto block max-w-none ${animate ? "stitch-in" : ""}`}
        style={{ marginLeft: "50%", transform: "translateX(-50%)" }}
      >
        {stitches.map(({ x, y, c }) => {
          const x0 = x * cell + p;
          const y0 = y * cell + p;
          const x1 = (x + 1) * cell - p;
          const y1 = (y + 1) * cell - p;
          return (
            <path
              key={`${x}-${y}`}
              className="stitch"
              d={`M${x0} ${y0}L${x1} ${y1}M${x1} ${y0}L${x0} ${y1}`}
              stroke={COLORS[c]}
              strokeWidth={cell * 0.26}
              strokeLinecap="round"
              style={animate ? { animationDelay: `${Math.round(Math.abs(x - cols / 2) * 6)}ms` } : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
}

/** A single small rhombus, used as a list bullet. */
export function StitchDiamond({ className = "" }: { className?: string }) {
  const pts = [
    [2, 0],
    [1, 1],
    [3, 1],
    [0, 2],
    [4, 2],
    [1, 3],
    [3, 3],
    [2, 4],
  ];
  const s = 4;
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      {pts.map(([x, y]) => (
        <path
          key={`${x}${y}`}
          d={`M${x * s + 0.8} ${y * s + 0.8}L${x * s + s - 0.8} ${y * s + s - 0.8}M${x * s + s - 0.8} ${y * s + 0.8}L${x * s + 0.8} ${y * s + s - 0.8}`}
          stroke="var(--color-kilim)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      ))}
      <path d="M8.8 8.8L11.2 11.2M11.2 8.8L8.8 11.2" stroke="var(--color-saffron)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
