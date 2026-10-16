/** MongoDB collation for Hebrew (and mixed Hebrew/Latin) name sorting. */
export interface HebrewNameCollation {
  locale: 'he';
  strength: 1;
  numericOrdering: true;
}

export function hebrewNameCollation(): HebrewNameCollation {
  return { locale: 'he', strength: 1, numericOrdering: true };
}
