import { Pipe, PipeTransform } from '@angular/core';
import { splitSymbolHighlight } from '../utils/watchlist-search.util';

@Pipe({ name: 'symbolHighlight', standalone: true })
export class SymbolHighlightPipe implements PipeTransform {
  transform(symbol: string, query: string): { text: string; match: boolean }[] {
    return splitSymbolHighlight(symbol, query);
  }
}
