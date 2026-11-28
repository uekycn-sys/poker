import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ScrollText } from 'lucide-react';
import { ActionRecord, BettingStreet, HandState } from '../engine/types';
import { formatChipsOrBb } from '../utils/formatChips';

interface ActionTickerProps {
  handState: HandState;
  displayInBb: boolean;
  defaultOpen?: boolean;
}

interface FormattedTickerItem {
  seq: number;
  position: string;
  playerName: string;
  actionText: string;
  tone: 'agg' | 'call' | 'check' | 'fold';
}

interface StreetTickerGroup {
  street: BettingStreet;
  labelZh: string;
  items: FormattedTickerItem[];
}

const STREET_LABELS: Record<BettingStreet, string> = {
  preflop: '翻前',
  flop: '翻牌',
  turn: '转牌',
  river: '河牌',
};

const TONE_CLASS: Record<FormattedTickerItem['tone'], string> = {
  agg: 'text-amber-200',
  call: 'text-sky-200',
  check: 'text-emerald-200/90',
  fold: 'text-slate-400',
};

export const ActionTicker: React.FC<ActionTickerProps> = ({
  handState,
  displayInBb,
  defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const playerNamesBySeat = useMemo(() => {
    const map: Record<number, string> = {};
    for (const p of handState.players) {
      map[p.seat] = p.name;
    }
    return map;
  }, [handState.players]);

  const groups = useMemo<StreetTickerGroup[]>(() => {
    const byStreet = new Map<BettingStreet, FormattedTickerItem[]>();
    let preflopRaiseCount = 0;
    const postflopBetStreets = new Set<BettingStreet>();

    for (const rec of handState.actions as ActionRecord[]) {
      const name = playerNamesBySeat[rec.seat] ?? `座位${rec.seat}`;
      const fmt = (val: number) => formatChipsOrBb(val, handState.bigBlind, displayInBb);

      let actionText = '';
      let tone: FormattedTickerItem['tone'] = 'check';

      if (rec.action.type === 'fold') {
        actionText = '弃牌';
        tone = 'fold';
      } else if (rec.action.type === 'check') {
        actionText = '过牌';
        tone = 'check';
      } else if (rec.action.type === 'call') {
        actionText = `跟注 ${fmt(rec.amountAdded)}`;
        tone = 'call';
      } else if (rec.action.type === 'all_in') {
        if (rec.street === 'preflop') {
          preflopRaiseCount++;
        } else {
          postflopBetStreets.add(rec.street);
        }
        actionText = `All-in ${fmt(rec.resultingStreetBet)}`;
        tone = 'agg';
      } else if (rec.action.type === 'raise') {
        tone = 'agg';
        if (rec.street === 'preflop') {
          preflopRaiseCount++;
          if (preflopRaiseCount === 1) {
            actionText = `加注至 ${fmt(rec.resultingStreetBet)}`;
          } else {
            actionText = `${preflopRaiseCount + 1}-Bet 至 ${fmt(rec.resultingStreetBet)}`;
          }
        } else {
          if (!postflopBetStreets.has(rec.street)) {
            postflopBetStreets.add(rec.street);
            actionText = `下注 ${fmt(rec.resultingStreetBet)}`;
          } else {
            actionText = `加注至 ${fmt(rec.resultingStreetBet)}`;
          }
        }
      }

      if (!byStreet.has(rec.street)) {
        byStreet.set(rec.street, []);
      }
      byStreet.get(rec.street)!.push({
        seq: rec.seq,
        position: rec.position,
        playerName: name,
        actionText,
        tone,
      });
    }

    const order: BettingStreet[] = ['preflop', 'flop', 'turn', 'river'];
    return order
      .filter((st) => (byStreet.get(st)?.length ?? 0) > 0)
      .map((st) => ({
        street: st,
        labelZh: STREET_LABELS[st],
        items: byStreet.get(st)!,
      }));
  }, [handState.actions, handState.bigBlind, displayInBb, playerNamesBySeat]);

  const totalActions = handState.actions.length;
  const latestItem = useMemo(() => {
    if (groups.length === 0) return null;
    const lastGroup = groups[groups.length - 1];
    return lastGroup.items[lastGroup.items.length - 1] ?? null;
  }, [groups]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, totalActions]);

  return (
    <div className="pointer-events-auto flex flex-col items-start">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hud-glass inline-flex max-w-[240px] sm:max-w-[310px] items-center gap-1.5 rounded-xl border border-amber-300/30 bg-black/75 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-amber-100 shadow-lg hover:border-amber-300/60 cursor-pointer"
          title="展开本手牌行动流水"
        >
          <ScrollText className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span className="shrink-0 font-black text-amber-300">流水({totalActions})</span>
          {latestItem ? (
            <span className="truncate text-emerald-100/85">
              {latestItem.position} {latestItem.playerName} {latestItem.actionText}
            </span>
          ) : (
            <span className="text-slate-400">盲注已下</span>
          )}
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-amber-200/80" />
        </button>
      ) : (
        <div className="hud-glass w-[245px] sm:w-[320px] rounded-2xl border border-amber-300/30 bg-black/80 shadow-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-between gap-2 border-b border-white/10 px-2.5 py-1.5 text-left cursor-pointer hover:bg-white/5 rounded-t-2xl"
          >
            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-amber-200">
              <ScrollText className="h-3.5 w-3.5 text-amber-300" />
              实时行动流水
              <span className="rounded bg-white/10 px-1 font-mono text-[9px] text-emerald-200">
                {totalActions}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
          </button>

          <div
            ref={scrollRef}
            className="max-h-[118px] sm:max-h-[144px] space-y-1.5 overflow-y-auto px-2.5 py-2 text-[10px] sm:text-[11px] leading-snug"
          >
            {groups.length === 0 ? (
              <div className="text-slate-400">盲注已投入，等待首位玩家行动...</div>
            ) : (
              groups.map((grp) => (
                <div key={grp.street} className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-amber-400/20 px-1.5 py-0.2 text-[9px] font-black text-amber-300">
                      {grp.labelZh}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] sm:text-[11px]">
                    {grp.items.map((item, idx) => (
                      <React.Fragment key={item.seq}>
                        {idx > 0 && <span className="text-slate-500">→</span>}
                        <span className={`font-bold ${TONE_CLASS[item.tone]}`}>
                          <span className="font-mono text-[9px] text-amber-300/85">
                            {item.position}
                          </span>{' '}
                          {item.playerName} {item.actionText}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
