export const money = (value: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
export const compactMoney = (value: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);
export const number = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);
export const rate = (value: number) => `${value.toFixed(1)}%`;
