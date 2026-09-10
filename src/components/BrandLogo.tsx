import Image from "next/image";
import Link from "next/link";

const sizes = {
  xs: "h-12 w-auto",
  sm: "h-16 w-auto",
  md: "h-24 w-auto",
  lg: "h-36 w-auto",
  xl: "h-44 w-auto",
  /** Dashboard header slot above the sidebar — centered, scaled to trim PNG whitespace. */
  header: "h-full w-auto max-w-[11.5rem] object-contain object-center p-0 m-0 scale-[1.4] origin-center",
} as const;

type Props = {
  href?: string;
  size?: keyof typeof sizes;
  className?: string;
  priority?: boolean;
  /** Wrap logo in a light panel (useful on dark/colored backgrounds). */
  panel?: boolean;
};

export function BrandLogo({ href = "/", size = "sm", className = "", priority, panel }: Props) {
  const isHeader = size === "header";
  const img = (
    <Image
      src="/fastplus-logo.png"
      alt="FASTPLUS — Faster business. Better future."
      width={320}
      height={320}
      priority={priority}
      className={`${sizes[size]} ${className}`.trim()}
    />
  );

  const content = panel ? (
    <span className="inline-flex rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-black/5">{img}</span>
  ) : (
    img
  );

  if (href) {
    return (
      <Link
        href={href}
        className={
          isHeader
            ? "flex h-full w-full items-center justify-center transition hover:opacity-90"
            : "inline-flex shrink-0 items-center transition hover:opacity-90"
        }
      >
        {content}
      </Link>
    );
  }

  return content;
}
