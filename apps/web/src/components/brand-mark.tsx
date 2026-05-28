import Link from 'next/link';
import Image from 'next/image';

interface BrandMarkProps {
  /**
   * Visual variant:
   * - `sm`: small, medium-weight — for footers and subtle contexts
   * - `md`: medium, bold — for cards, modals, focal elements
   * - `responsive`: scales from md to lg across breakpoints — for the site header
   */
  size?: 'sm' | 'md' | 'responsive';
  /** If provided, wraps the brand in a Link (typically `/` for header/footer). */
  href?: string;
  /** Additional Tailwind classes for the outer container (e.g., margins, alignment). */
  className?: string;
  /** LCP hint — set true on the most prominent brand mark on a page. */
  priority?: boolean;
}

const VARIANTS = {
  sm: {
    img: 'size-7',
    text: 'text-sm font-medium',
  },
  md: {
    img: 'size-10',
    text: 'text-xl font-bold tracking-tight',
  },
  responsive: {
    img: 'size-10 sm:size-12 md:size-16',
    text: 'text-xl font-bold tracking-tight sm:text-2xl md:text-3xl',
  },
} as const;

export function BrandMark({
  size = 'md',
  href,
  className,
  priority = false,
}: BrandMarkProps) {
  const variant = VARIANTS[size];
  const containerClass = `flex items-center gap-2 ${variant.text} ${className ?? ''}`;

  const content = (
    <>
      <Image
        src="/logo.png"
        alt=""
        width={64}
        height={64}
        priority={priority}
        className={variant.img}
      />
      {/* Logo-only under 360px so the wordmark doesn't collide with the
          header controls on the smallest phones. */}
      <span className="max-[360px]:hidden">
        Chatarooni<span className="font-normal text-primary">.com</span>
      </span>
    </>
  );

  return href ? (
    <Link href={href} className={containerClass}>
      {content}
    </Link>
  ) : (
    <div className={containerClass}>{content}</div>
  );
}
