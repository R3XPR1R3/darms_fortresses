import type { GameState } from "@darms/shared-types";
import { HEROES, WIN_DISTRICTS } from "@darms/shared-types";
import { calculateScores } from "@darms/game-core";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const LOGS_DIR = process.env.LOGS_DIR ?? "/data/match-logs";

export interface MatchSummary {
  matchId: string;
  roomId: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  totalDays: number;
  players: MatchPlayerSummary[];
  winnerId: string;
  winnerName: string;
  winnerScore: number;
  log: { day: number; message: string }[];
}

export interface MatchPlayerSummary {
  id: string;
  name: string;
  isBot: boolean;
  score: number;
  gold: number;
  districts: { name: string; cost: number; hp: number; colors: string[] }[];
  districtCount: number;
  finishedFirst: boolean;
  allColors: boolean;
}

function computeScore(p: GameState["players"][number]): number {
  let score = 0;
  for (const d of p.builtDistricts) score += d.hp;
  if (p.finishedFirst) score += 4;
  const colors = new Set(p.builtDistricts.flatMap((d) => d.colors));
  if (colors.has("yellow") && colors.has("blue") && colors.has("green") && colors.has("red")) {
    score += 3;
  }
  return score;
}

export function generateMatchSummary(
  state: GameState,
  roomId: string,
  startedAt: Date,
  botIds: Set<string>,
): MatchSummary {
  const now = new Date();
  const matchId = `${roomId}-${startedAt.getTime()}`;

  const players: MatchPlayerSummary[] = state.players.map((p) => {
    const score = computeScore(p);
    const colors = new Set(p.builtDistricts.flatMap((d) => d.colors));
    return {
      id: p.id,
      name: p.name,
      isBot: botIds.has(p.id),
      score,
      gold: p.gold,
      districts: p.builtDistricts.map((d) => ({
        name: d.name,
        cost: d.cost,
        hp: d.hp,
        colors: [...d.colors],
      })),
      districtCount: p.builtDistricts.length,
      finishedFirst: p.finishedFirst,
      allColors: colors.has("yellow") && colors.has("blue") && colors.has("green") && colors.has("red"),
    };
  });

  const winner = state.winner !== null ? state.players[state.winner] : null;
  const winnerSummary = winner ? players.find((p) => p.id === winner.id) : null;

  return {
    matchId,
    roomId,
    startedAt: startedAt.toISOString(),
    endedAt: now.toISOString(),
    durationSec: Math.round((now.getTime() - startedAt.getTime()) / 1000),
    totalDays: state.day,
    players,
    winnerId: winner?.id ?? "",
    winnerName: winner?.name ?? "???",
    winnerScore: winnerSummary?.score ?? 0,
    log: state.log,
  };
}

export async function saveMatchSummary(summary: MatchSummary): Promise<string> {
  if (!existsSync(LOGS_DIR)) {
    await mkdir(LOGS_DIR, { recursive: true });
  }

  const filename = `${summary.endedAt.slice(0, 10)}_${summary.roomId}_${summary.matchId}.json`;
  const filepath = join(LOGS_DIR, filename);
  await writeFile(filepath, JSON.stringify(summary, null, 2), "utf-8");

  // Also write human-readable summary
  const txtPath = filepath.replace(".json", ".txt");
  const txt = formatSummaryText(summary);
  await writeFile(txtPath, txt, "utf-8");

  console.log(`[match-log] Saved: ${filepath}`);
  return filepath;
}

function formatSummaryText(s: MatchSummary): string {
  const lines: string[] = [];
  const hr = "═".repeat(50);

  lines.push(hr);
  lines.push(`  DARMS: FORTRESSES — Сводка матча`);
  lines.push(hr);
  lines.push(`  Комната: ${s.roomId}  |  Дней: ${s.totalDays}  |  ${fmtDuration(s.durationSec)}`);
  lines.push(`  Начало:  ${fmtTime(s.startedAt)}`);
  lines.push(`  Конец:   ${fmtTime(s.endedAt)}`);
  lines.push(hr);
  lines.push("");

  // Scoreboard sorted by score desc
  const sorted = [...s.players].sort((a, b) => b.score - a.score);
  lines.push("  # │ Игрок              │ Очки │ Кварт. │ Золото │ Бонусы");
  lines.push("  ──┼────────────────────┼──────┼────────┼────────┼────────");

  sorted.forEach((p, i) => {
    const rank = i + 1;
    const crown = p.id === s.winnerId ? " 🏆" : "";
    const bonuses: string[] = [];
    if (p.finishedFirst) bonuses.push("+4 первый");
    if (p.allColors) bonuses.push("+3 все цвета");
    const name = (p.name + (p.isBot ? " 🤖" : "") + crown).padEnd(18);
    lines.push(
      `  ${rank} │ ${name} │ ${String(p.score).padStart(4)} │ ${String(p.districtCount).padStart(6)} │ ${String(p.gold).padStart(6)} │ ${bonuses.join(", ") || "—"}`
    );
  });

  lines.push("");
  lines.push("  Построенные кварталы:");
  for (const p of sorted) {
    if (p.districts.length === 0) continue;
    lines.push(`    ${p.name}:`);
    for (const d of p.districts) {
      const colorEmoji = d.colors.map((c) => ({ yellow: "🟡", blue: "🔵", green: "🟢", red: "🔴" }[c] ?? "⚪")).join("");
      lines.push(`      ${colorEmoji} ${d.name} (стоимость: ${d.cost}, HP: ${d.hp})`);
    }
  }

  lines.push("");
  lines.push(hr);
  lines.push(`  Победитель: ${s.winnerName} с ${s.winnerScore} очками!`);
  lines.push(hr);

  return lines.join("\n") + "\n";
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} мин ${s} сек` : `${s} сек`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}
