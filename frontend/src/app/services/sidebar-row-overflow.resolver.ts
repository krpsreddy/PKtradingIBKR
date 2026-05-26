import { Injectable } from '@angular/core';
import { MarketModeRow } from '../utils/market-mode.util';

export type TimeframeKey = '5m' | '15m' | '1h';

export interface TimeframeChip {
  tf: TimeframeKey;
  label: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  visible: boolean;
}

export interface SidebarRowResolved {
  leftLabel: string;
  symbol: string;
  timeframeChips: TimeframeChip[];
  edgeText: string;
  edgeSentiment: 'bullish' | 'bearish' | 'neutral' | null;
  plainDetail: string;
  fullTitle: string;
  compressionLevel: number;
}

const GROUP_GAP_PX = 12;
const LABEL_PX = 12;
const SYM_PX = 13;
const TF_PX = 11;
const EDGE_PX = 11;
const CHIP_SEP_PX = 6;

@Injectable({ providedIn: 'root' })
export class SidebarRowOverflowResolver {
  resolveMarketModeRow(row: MarketModeRow, containerWidthPx?: number): SidebarRowResolved {
    const container = containerWidthPx ?? this.inferContainerWidth(row);
    const parsed = this.parseDetail(row.detail);
    const leftW = this.estimate(row.label, LABEL_PX, 0.62) + 6 + this.estimate(row.symbol, SYM_PX, 0.58);
    const edgeW = parsed.edgeText ? this.estimate(parsed.edgeText, EDGE_PX, 0.54) : 0;
    const reserved = leftW + (edgeW > 0 ? GROUP_GAP_PX + edgeW : 0) + 20;
    const budget = Math.max(48, container - reserved);

    let chips = parsed.chips;
    let level = 0;
    for (; level <= 6; level++) {
      chips = this.applyCompression(parsed.chips, level);
      const visible = chips.filter(c => c.visible);
      if (visible.length === 0) {
        break;
      }
      const midW = this.chipsWidth(visible);
      if (midW <= budget) {
        break;
      }
    }

    const visibleChips = chips.filter(c => c.visible);
    let plainDetail = visibleChips.length
      ? visibleChips.map(c => c.label).join(' · ')
      : parsed.edgeText || row.detail;

    if (visibleChips.length && this.joinedWidth(plainDetail) > budget && level >= 5) {
      const five = visibleChips.find(c => c.tf === '5m') ?? visibleChips[0];
      plainDetail = five.label;
    }

    if (visibleChips.length && this.joinedWidth(plainDetail) > budget) {
      plainDetail = this.trimToWidth(plainDetail, budget);
    }

    return {
      leftLabel: row.label,
      symbol: row.symbol,
      timeframeChips: chips,
      edgeText: parsed.edgeText,
      edgeSentiment: parsed.edgeSentiment,
      plainDetail,
      fullTitle: row.detail,
      compressionLevel: level
    };
  }

  resolveMtfSummary(summary: string, containerWidthPx = 280): { chips: TimeframeChip[]; plain: string; fullTitle: string } {
    const parsed = this.parseDetail(summary);
    if (!parsed.chips.length) {
      return { chips: [], plain: summary, fullTitle: summary };
    }

    const budget = Math.max(60, containerWidthPx - 8);
    let chips = parsed.chips;
    let level = 0;
    for (; level <= 6; level++) {
      chips = this.applyCompression(parsed.chips, level);
      const visible = chips.filter(c => c.visible);
      if (!visible.length || this.chipsWidth(visible) <= budget) {
        break;
      }
    }

    const visible = chips.filter(c => c.visible);
    return {
      chips,
      plain: visible.map(c => c.label).join(' · '),
      fullTitle: summary
    };
  }

  private parseDetail(detail: string): {
    chips: TimeframeChip[];
    edgeText: string;
    edgeSentiment: 'bullish' | 'bearish' | 'neutral' | null;
  } {
    const parts = detail.split(/\s*[·/]\s*/).map(p => p.trim()).filter(Boolean);
    const chips: TimeframeChip[] = [];
    let edgeParts: string[] = [];

    for (const part of parts) {
      const mtf = part.match(/^(5m|15m|1h)\s+(.+)$/i);
      if (mtf) {
        const tf = mtf[1].toLowerCase() as TimeframeKey;
        const sentiment = this.parseSentiment(mtf[2]);
        chips.push({
          tf,
          label: `${tf} ${this.sentimentLabel(sentiment, false)}`,
          sentiment,
          visible: true
        });
        continue;
      }
      edgeParts.push(part);
    }

    const edgeText = edgeParts.join(' · ');
    const edgeSentiment = edgeParts.length === 1
      ? this.parseSentiment(edgeParts[0])
      : edgeParts.some(p => /bull/i.test(p))
        ? 'bullish'
        : edgeParts.some(p => /bear/i.test(p))
          ? 'bearish'
          : null;

    return { chips, edgeText, edgeSentiment };
  }

  private applyCompression(base: TimeframeChip[], level: number): TimeframeChip[] {
    const chips = base.map(c => ({
      ...c,
      label: `${c.tf} ${this.sentimentLabel(c.sentiment, false)}`,
      visible: true
    }));

    const abbreviate = (tf: TimeframeKey) => {
      const chip = chips.find(c => c.tf === tf);
      if (chip) {
        chip.label = `${tf} ${this.sentimentLabel(chip.sentiment, true)}`;
      }
    };
    const hide = (tf: TimeframeKey) => {
      const chip = chips.find(c => c.tf === tf);
      if (chip) {
        chip.visible = false;
      }
    };

    if (level >= 1) abbreviate('1h');
    if (level >= 2) hide('1h');
    if (level >= 3) abbreviate('15m');
    if (level >= 4) hide('15m');
    if (level >= 5) abbreviate('5m');

    return chips;
  }

  private sentimentLabel(raw: string | 'bullish' | 'bearish' | 'neutral', abbrev: boolean): string {
    const s = typeof raw === 'string' && ['bullish', 'bearish', 'neutral'].includes(raw)
      ? raw
      : this.parseSentiment(String(raw));
    if (abbrev) {
      if (s === 'bullish') return 'B';
      if (s === 'bearish') return 'R';
      return 'N';
    }
    if (s === 'bullish') return 'Bullish';
    if (s === 'bearish') return 'Bearish';
    if (s === 'neutral') return 'Neutral';
    return String(raw).trim();
  }

  private parseSentiment(raw: string): 'bullish' | 'bearish' | 'neutral' {
    const s = raw.trim().toLowerCase();
    if (s.startsWith('bull') || s === 'b') return 'bullish';
    if (s.startsWith('bear') || s === 'r') return 'bearish';
    return 'neutral';
  }

  private inferContainerWidth(row: MarketModeRow): number {
    const symPad = Math.max(0, row.symbol.length - 3) * 6;
    if (row.label === 'TREND LEADER') return 248 - symPad;
    if (row.label === 'HIGH RVOL') return 272 - symPad;
    if (row.label.length >= 11) return 264 - symPad;
    return 276 - symPad;
  }

  private trimToWidth(text: string, budget: number): string {
    if (this.joinedWidth(text) <= budget) return text;
    const ell = '…';
    let out = text;
    while (out.length > 8 && this.joinedWidth(out + ell) > budget) {
      out = out.slice(0, -1).trimEnd();
    }
    return out.endsWith('·') ? out.slice(0, -1).trimEnd() + ell : out + ell;
  }

  private chipsWidth(chips: TimeframeChip[]): number {
    if (!chips.length) return 0;
    const labels = chips.map(c => this.estimate(c.label, TF_PX, 0.56));
    const seps = Math.max(0, chips.length - 1) * CHIP_SEP_PX;
    return labels.reduce((sum, w) => sum + w, 0) + seps;
  }

  private joinedWidth(text: string): number {
    return this.estimate(text, TF_PX, 0.56);
  }

  private estimate(text: string, fontPx: number, charRatio = 0.56): number {
    return text.length * fontPx * charRatio + 2;
  }
}
