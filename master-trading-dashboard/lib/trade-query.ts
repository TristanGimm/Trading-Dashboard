export type TradeFilter = { account?: string; period?: string };

export function buildTradeWhere(filter: TradeFilter = {}, now = new Date()): { sql: string; values: (string | Date)[] } {
  const clauses: string[] = [];
  const values: (string | Date)[] = [];
  if (filter.account && filter.account !== 'all') {
    values.push(filter.account);
    clauses.push(`account @> ARRAY[$${values.length}]::text[]`);
  }
  const days: Record<string, number> = { '30d': 30, '90d': 90, '365d': 365 };
  if (filter.period && Object.hasOwn(days, filter.period)) {
    values.push(new Date(now.getTime() - days[filter.period] * 86400000));
    clauses.push(`date_time >= $${values.length}`);
    values.push(now);
    clauses.push(`date_time <= $${values.length}`);
  }
  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', values };
}
