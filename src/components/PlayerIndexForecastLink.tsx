'use client'

import type { MouseEvent, ReactNode } from 'react'

type Props = {
  href: string
  className?: string
  children: ReactNode
  /** Shown on hover; mentions Shift+click to copy. */
  title?: string
  /** Runs before Shift+click copy handling (e.g. stopPropagation on nested cards). */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * External link to Player Index Card Forecaster. Shift+click copies the full URL
 * (including `number` / `printRun` when present on the inventory row).
 */
export function PlayerIndexForecastLink({ href, className, children, title, onClick: onClickProp }: Props) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClickProp?.(e)
    if (!e.shiftKey) return
    e.preventDefault()
    void navigator.clipboard.writeText(href).then(
      () => alert('Player Index forecaster link copied to clipboard.'),
      () => alert('Could not copy to clipboard.'),
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={
        title ??
        'Open Card Forecaster on Player Index. Shift+click to copy this link (includes card # when saved on the item).'
      }
      onClick={onClick}
    >
      {children}
    </a>
  )
}
