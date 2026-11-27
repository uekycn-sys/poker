import { HandEvalResult, PotPayout, SidePot } from './types';

export interface PotContributor {
  seat: number;
  totalCommitted: number;
  folded: boolean;
}

function sameSeatSet(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Slices all player commitments (including folded dead money) into Main Pot and Side Pots.
 * Consecutive layers with identical eligible non-folded contenders are merged cleanly.
 */
export function calculateSidePots(players: readonly PotContributor[]): SidePot[] {
  const levels = Array.from(
    new Set(players.filter((p) => p.totalCommitted > 0).map((p) => p.totalCommitted)),
  ).sort((a, b) => a - b);

  if (levels.length === 0) {
    return [];
  }

  const rawLayers: Array<{ amount: number; eligibleSeats: number[] }> = [];
  let prevLevel = 0;

  for (const level of levels) {
    let layerAmount = 0;
    for (const p of players) {
      if (p.totalCommitted > prevLevel) {
        layerAmount += Math.min(p.totalCommitted, level) - prevLevel;
      }
    }
    const eligibleSeats = players
      .filter((p) => !p.folded && p.totalCommitted >= level)
      .map((p) => p.seat)
      .sort((a, b) => a - b);

    if (layerAmount > 0) {
      const prevLayer = rawLayers[rawLayers.length - 1];
      if (prevLayer && sameSeatSet(prevLayer.eligibleSeats, eligibleSeats)) {
        prevLayer.amount += layerAmount;
      } else {
        rawLayers.push({ amount: layerAmount, eligibleSeats });
      }
    }
    prevLevel = level;
  }

  return rawLayers.map((layer, idx) => ({
    id: idx === 0 ? 'main' : `side-${idx}`,
    label: idx === 0 ? '主池' : `边池 ${idx}`,
    amount: layer.amount,
    eligibleSeats: layer.eligibleSeats,
  }));
}

/**
 * Distributes every pot to its highest-scoring eligible contender(s).
 * Odd chips from split pots are awarded 1 chip at a time clockwise starting immediately left of the Dealer button.
 */
export function distributePots(
  pots: readonly SidePot[],
  evalsBySeat: Record<number, HandEvalResult>,
  dealerSeat: number,
  totalSeats: number,
  nonFoldedSeats: readonly number[],
): { payouts: PotPayout[]; totalWonBySeat: Record<number, number> } {
  const payouts: PotPayout[] = [];
  const totalWonBySeat: Record<number, number> = {};

  for (const pot of pots) {
    if (pot.amount <= 0) continue;

    let contenders = pot.eligibleSeats.filter((s) => nonFoldedSeats.includes(s));
    if (contenders.length === 0) {
      // Fallback: if all contenders folded above a capped level, award to remaining non-folded players
      contenders = [...nonFoldedSeats];
    }

    let winners: number[] = [];
    if (nonFoldedSeats.length === 1) {
      winners = [nonFoldedSeats[0]];
    } else {
      let bestScore = -1;
      for (const seat of contenders) {
        const evalRes = evalsBySeat[seat];
        if (!evalRes) continue;
        if (evalRes.score > bestScore) {
          bestScore = evalRes.score;
          winners = [seat];
        } else if (evalRes.score === bestScore) {
          winners.push(seat);
        }
      }
    }

    if (winners.length === 0) {
      continue;
    }

    // Order winners clockwise starting immediately left of the Dealer button
    const orderedWinners = [...winners].sort((a, b) => {
      const distA = (a - dealerSeat - 1 + totalSeats * 2) % totalSeats;
      const distB = (b - dealerSeat - 1 + totalSeats * 2) % totalSeats;
      return distA - distB;
    });

    const baseShare = Math.floor(pot.amount / orderedWinners.length);
    const remainder = pot.amount % orderedWinners.length;
    const shares: Record<number, number> = {};
    const oddChipsAwardedTo: number[] = [];

    for (let i = 0; i < orderedWinners.length; i++) {
      const seat = orderedWinners[i];
      const extra = i < remainder ? 1 : 0;
      const share = baseShare + extra;
      shares[seat] = share;
      totalWonBySeat[seat] = (totalWonBySeat[seat] ?? 0) + share;
      if (extra > 0) {
        oddChipsAwardedTo.push(seat);
      }
    }

    payouts.push({
      potId: pot.id,
      potLabel: pot.label,
      potAmount: pot.amount,
      winners: orderedWinners,
      shares,
      oddChipsAwardedTo,
    });
  }

  return { payouts, totalWonBySeat };
}
