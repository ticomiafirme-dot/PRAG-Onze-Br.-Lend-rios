import { ICONS, type IconName } from './icons';

export function Icon({ name, size = 20, className, title }: { name: IconName; size?: number; className?: string; title?: string }) {
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={ICONS[name]} fillRule="evenodd" />
    </svg>
  );
}
