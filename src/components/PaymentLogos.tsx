import React from 'react';

interface LogoProps {
  className?: string;
}

export const BkashLogo: React.FC<LogoProps> = ({ className = "w-5 h-5 flex-shrink-0" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#E2136E" />
    <path d="M25 65 L45 35 L55 50 Z" fill="#FFFFFF" fillOpacity="0.85" />
    <path d="M45 35 L75 30 L55 50 Z" fill="#FFFFFF" />
    <path d="M55 50 L50 75 L45 35 Z" fill="#FFFFFF" fillOpacity="0.9" />
    <path d="M55 50 L75 30 L65 60 Z" fill="#FFFFFF" fillOpacity="0.75" />
  </svg>
);

export const NagadLogo: React.FC<LogoProps> = ({ className = "w-5 h-5 flex-shrink-0" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="url(#nagadGrad)" />
    <defs>
      <linearGradient id="nagadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FB5702" />
        <stop offset="100%" stopColor="#FE9A05" />
      </linearGradient>
    </defs>
    <path d="M30 65 C40 33, 60 33, 70 65 C55 45, 45 45, 30 65 Z" fill="#FFFFFF" />
    <circle cx="50" cy="36" r="10" fill="#FFFFFF" />
  </svg>
);

export const RocketLogo: React.FC<LogoProps> = ({ className = "w-5 h-5 flex-shrink-0" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#8C2D82" />
    <path d="M60 30 L45 40 L40 55 L35 70 C35 70, 50 65, 60 60 L70 45 L60 30 Z" fill="#FFFFFF" />
    <path d="M40 55 L25 58 L35 70 Z" fill="#FFFFFF" fillOpacity="0.8" />
    <path d="M60 60 L63 75 L70 45 Z" fill="#FFFFFF" fillOpacity="0.8" />
    <path d="M35 70 L25 80 L32 73 L28 85 L42 71 Z" fill="#FF8A00" />
    <circle cx="52" cy="48" r="4" fill="#8C2D82" />
  </svg>
);

export const SslCommerzLogo: React.FC<LogoProps> = ({ className = "w-5 h-5 flex-shrink-0" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#013F8C" />
    <path d="M30 40 C30 25, 70 25, 70 40 V50 H30 V40 Z" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
    <rect x="22" y="46" width="56" height="34" rx="8" fill="#FFFFFF" />
    <circle cx="50" cy="63" r="6" fill="#013F8C" />
    {/* Text SSL styled */}
    <path d="M28 32 C28 32 30 28 35 28 C40 28 42 32 42 32" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CashLogo: React.FC<LogoProps> = ({ className = "w-5 h-5 flex-shrink-0" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#10B981" />
    <rect x="22" y="30" width="56" height="40" rx="6" stroke="#FFFFFF" strokeWidth="6" />
    <circle cx="50" cy="50" r="11" fill="#FFFFFF" fillOpacity="0.3" />
    <path d="M50 40 V60 M45 45 H55 M45 55 H55" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
  </svg>
);

export const BankLogo: React.FC<LogoProps> = ({ className = "w-5 h-5 flex-shrink-0" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#2563EB" />
    <path d="M20 75 H80 M20 70 V48 M35 70 V48 M50 70 V48 M65 70 V48 M80 70 V48 M25 48 H75 M50 25 L15 48 H85 Z" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const UpayLogo: React.FC<LogoProps> = ({ className = "w-5 h-5 flex-shrink-0" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#FFC107" />
    <path d="M25 45 C35 30, 65 30, 75 45 C65 65, 35 65, 25 45 Z" fill="#FFFFFF" />
    <circle cx="50" cy="45" r="8" fill="#FFC107" />
  </svg>
);

export const CellfinLogo: React.FC<LogoProps> = ({ className = "w-5 h-5 flex-shrink-0" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#009688" />
    <rect x="25" y="25" width="50" height="50" rx="8" stroke="#FFFFFF" strokeWidth="6" fill="none" />
    <circle cx="50" cy="50" r="10" fill="#FFFFFF" />
  </svg>
);

export const TapLogo: React.FC<LogoProps> = ({ className = "w-5 h-5 flex-shrink-0" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#E91E63" />
    <circle cx="50" cy="50" r="20" stroke="#FFFFFF" strokeWidth="6" fill="none" />
    <circle cx="50" cy="50" r="8" fill="#FFFFFF" />
  </svg>
);

interface PaymentMethodLogoProps {
  method?: string;
  className?: string;
}

export const PaymentMethodLogo: React.FC<PaymentMethodLogoProps> = ({ method = 'Cash', className = "w-5 h-5 flex-shrink-0" }) => {
  const normMethod = method ? method.trim().toLowerCase() : 'cash';
  switch (normMethod) {
    case 'bkash':
      return <BkashLogo className={className} />;
    case 'nagad':
      return <NagadLogo className={className} />;
    case 'rocket':
      return <RocketLogo className={className} />;
    case 'sslcommerz':
      return <SslCommerzLogo className={className} />;
    case 'bank':
      return <BankLogo className={className} />;
    case 'upay':
      return <UpayLogo className={className} />;
    case 'cellfin':
      return <CellfinLogo className={className} />;
    case 'tap':
      return <TapLogo className={className} />;
    case 'cash':
    default:
      return <CashLogo className={className} />;
  }
};
