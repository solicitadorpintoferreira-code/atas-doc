import { useState } from 'react';

export const fmt = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);
export const fmtD = d => d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export function Badge({ children, variant = 'neutral' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function Btn({ children, onClick, variant = 'primary', size, disabled, type = 'button', style }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`btn btn-${variant}`} style={{ ...(size === 'sm' ? { padding: '6px 12px', fontSize: 12 } : {}), ...style }}>{children}</button>;
}

export function Input({ label, value, onChange, placeholder, type = 'text', required, disabled, style }) {
  return (
    <div className="field" style={style}>
      {label && <label className="field-label">{label}{required && <span style={{ color: '#B8976A' }}> *</span>}</label>}
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className="field-input" style={disabled ? { background: '#F9FAFB' } : {}} />
    </div>
  );
}

export function Select({ label, value, onChange, options, required, placeholder = 'Selecionar...' }) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}{required && <span style={{ color: '#B8976A' }}> *</span>}</label>}
      <select value={value || ''} onChange={e => onChange(e.target.value)} className="field-input" style={{ cursor: 'pointer' }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

export function Textarea({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} className="field-input" style={{ resize: 'vertical', fontFamily: 'inherit' }} />
    </div>
  );
}

export function Alert({ variant = 'info', title, children }) {
  return (
    <div className={`alert alert-${variant}`}>
      {title && <div className="alert-warn-title">{title}</div>}
      <div style={{ fontSize: 13, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, size = 'md', footer }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, maxWidth: size === 'lg' ? 900 : 640, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="serif" style={{ fontSize: 20, color: '#1F2937', margin: 0, fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: 18, padding: 4 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
        {footer && <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon = '○', title, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280' }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 14, marginBottom: 16 }}>{title}</div>
      {action}
    </div>
  );
}
