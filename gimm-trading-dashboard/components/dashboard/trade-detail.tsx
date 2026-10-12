'use client';

import { useEffect, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { money, number, tradeUrl } from '@/lib/format';

export function TradeDetail({ trade, timeZone, demo, onClose }: { trade: Trade | null; timeZone: string; demo: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (trade) dialog.current?.showModal(); else dialog.current?.close();
  }, [trade]);
  useEffect(() => {
    if (!trade) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [trade]);
  const confluences = trade ? [trade.liquiditySweep && 'Liquidity sweep', trade.dxy && 'DXY confirmation', trade.delta && 'Delta', trade.fractalShift && 'Fractal shift', ...trade.tfType].filter((value): value is string => typeof value === 'string') : [];
  return <dialog ref={dialog} className="detail-dialog" aria-labelledby="trade-detail-title" onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === dialog.current) { const bounds = dialog.current.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>{trade && <>
    <div className="dialog-heading"><div><p className="eyebrow">{demo ? 'Sample trade' : 'Trade review'}</p><h2 id="trade-detail-title">{trade.pair || 'Trade'} <span className="muted">#{trade.tradeId}</span></h2></div><button type="button" className="icon-button" aria-label="Close trade details" onClick={onClose}><X size={17}/></button></div>
    <div className="dialog-body"><p className="panel-subtitle">Realized net P&L</p><div className={`dialog-pnl ${trade.netEur !== null && trade.netEur < 0 ? 'negative' : trade.netEur ? 'positive' : ''}`}>{trade.netEur === null ? 'Unrecorded' : money(trade.netEur)}</div>
      <dl className="detail-grid">{[['Entry time', trade.dateTime ? new Date(trade.dateTime).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short', timeZone }) : 'Unrecorded'], ['Timezone', timeZone], ['Account', trade.account.join(', ') || 'Untagged'], ['Direction', trade.position || 'Unrecorded'], ['Setup', trade.setup.join(', ') || 'Untagged'], ['Session', trade.sessionTime.join(', ') || 'Untagged'], ['R multiple', trade.rMultiple === null ? 'Unrecorded' : `${number(trade.rMultiple)}R`], ['Recorded outcome', trade.recordedOutcome || 'Unrecorded'], ['MFE (30 min)', trade.mfe30m == null ? 'Unrecorded' : number(trade.mfe30m)], ['MAE (30 min)', trade.mae30m == null ? 'Unrecorded' : number(trade.mae30m)], ['Recorded balance', trade.accountBalance === null ? 'Unrecorded' : money(trade.accountBalance)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="panel-subtitle">Recorded confluences</p><div className="confluence-tags">{confluences.length ? confluences.map((value, index) => <span key={`${value}-${index}`}>{value}</span>) : <p className="panel-subtitle">No checked confluences recorded.</p>}</div>
      {demo ? <p className="panel-subtitle">Synthetic sample for the local preview. No real trading data.</p> : <a className="button button-primary" href={tradeUrl(trade.id)} target="_blank" rel="noopener noreferrer">Review in Notion<ExternalLink size={13}/></a>}
    </div>
  </>}</dialog>;
}
