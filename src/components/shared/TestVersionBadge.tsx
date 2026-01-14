import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TestVersionBadgeProps {
  className?: string;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

/**
 * Badge reutilizável para indicar funcionalidades em versão de teste
 * Pode ser usado em qualquer parte da aplicação para marcar features em desenvolvimento
 */
export function TestVersionBadge({ 
  className, 
  variant = 'destructive',
  size = 'md',
  showIcon = true 
}: TestVersionBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <Badge
      variant={variant}
      className={cn(
        'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 font-semibold animate-pulse',
        sizeClasses[size],
        className
      )}
    >
      {showIcon && (
        <AlertTriangle className={cn('mr-1.5', iconSizes[size])} />
      )}
      Versão em Teste
    </Badge>
  );
}

/**
 * Banner de alerta para funcionalidades em teste
 * Use quando precisar de mais destaque visual
 */
interface TestVersionBannerProps {
  className?: string;
  message?: string;
  showIcon?: boolean;
}

export function TestVersionBanner({ 
  className, 
  message = 'Esta funcionalidade está em versão de teste e pode conter inconsistências.',
  showIcon = true 
}: TestVersionBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20',
        className
      )}
    >
      {showIcon && (
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
      )}
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          ⚠️ Versão em Teste
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
          {message}
        </p>
      </div>
    </div>
  );
}
