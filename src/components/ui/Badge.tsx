/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'sage' | 'neutral' | 'amber' | 'muted';
  size?: 'sm' | 'md';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'sage',
  size = 'sm',
  className = '',
  icon,
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
  };

  const variantClasses = {
    sage: 'bg-[#EEF4F0] text-[#324C3B] border border-[#D9E5DC]',
    neutral: 'bg-[#F2F5F2] text-[#556057] border border-[#E4E9E3]',
    amber: 'bg-[#FDF6E9] text-[#7A5B1C] border border-[#F5E5C4]',
    muted: 'bg-white text-[#768078] border border-[#E4E9E3]',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md whitespace-nowrap ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
