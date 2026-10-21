import type { CSSProperties } from 'react';

/**
 * Converts an inline CSS declaration string (as written in the old Astro markup)
 * into a React style object, preserving values (incl. `var(--x)`) exactly.
 */
export function css(input: string): CSSProperties {
  const out: Record<string, string> = {};
  let depth = 0;
  let buf = '';
  const decls: string[] = [];
  for (const ch of input) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      decls.push(buf);
      buf = '';
    } else buf += ch;
  }
  decls.push(buf);
  for (const d of decls) {
    const i = d.indexOf(':');
    if (i < 0) continue;
    const prop = d.slice(0, i).trim();
    const val = d.slice(i + 1).trim();
    if (!prop || !val) continue;
    const key = prop.startsWith('--')
      ? prop
      : prop.replace(/^-ms-/, 'ms-').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = val;
  }
  return out as CSSProperties;
}
