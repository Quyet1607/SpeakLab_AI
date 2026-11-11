/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#83A58E] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap cursor-pointer';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[32px]',
    md: 'text-sm px-4 py-2 gap-2 min-h-[40px]',
    lg: 'text-base px-5 py-2.5 gap-2.5 min-h-[46px]',
  };

  const variantClasses = {
    primary:
      'bg-[#83A58E] hover:bg-[#6F917A] active:bg-[#5E7D68] text-white shadow-xs font-semibold',
    secondary:
      'bg-[#EEF4F0] hover:bg-[#E2ECE5] active:bg-[#D5E3DA] text-[#324C3B] font-medium border border-[#D9E5DC]',
    outline:
      'bg-white hover:bg-[#F7F9F6] active:bg-[#EDF2EC] text-[#3D4740] border border-[#E4E9E3] shadow-2xs',
    ghost:
      'bg-transparent hover:bg-[#EEF4F0] active:bg-[#E2ECE5] text-[#3D4740]',
    danger:
      'bg-[#FBF1F0] hover:bg-[#F5E2E0] active:bg-[#EED2D0] text-[#9E3E37] border border-[#F2DCDA]',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
      {!isLoading && icon && iconPosition === 'right' && (
        <span className="shrink-0">{icon}</span>
      )}
    </button>
  );
};
