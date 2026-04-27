/**
 * Template renderer: replaces {{ node_id.output.field }} patterns
 * with values from the execution context.
 * No eval() used — purely regex + object traversal.
 */

const TEMPLATE_RE = /\{\{([^}]+)\}\}/g;

function resolvePathInContext(path: string, context: Record<string, any>): string {
  const parts = path.trim().split('.');
  let value: any = context;
  for (const part of parts) {
    if (value === null || value === undefined) {
      console.warn(`[templateRenderer] path not found: ${path}`);
      return '';
    }
    value = value[part];
  }
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function renderTemplate(
  template: string | object,
  context: Record<string, any>,
): string | object {
  if (typeof template === 'string') {
    return template.replace(TEMPLATE_RE, (_, path) =>
      resolvePathInContext(path, context),
    );
  }
  if (typeof template === 'object' && template !== null) {
    const rendered: Record<string, any> = {};
    for (const [key, val] of Object.entries(template)) {
      rendered[key] = renderTemplate(val as string | object, context);
    }
    return rendered;
  }
  return template;
}

/** Evaluate simple comparison expressions without eval() */
export function evaluateExpression(
  expr: string,
  context: Record<string, any>,
): boolean {
  // Render any template placeholders first
  const rendered = renderTemplate(expr, context) as string;

  // Supported operators (order matters — longest first)
  const operators = ['>=', '<=', '==', '!=', '>', '<'] as const;

  for (const op of operators) {
    const idx = rendered.indexOf(op);
    if (idx === -1) continue;

    const left = rendered.slice(0, idx).trim();
    const right = rendered.slice(idx + op.length).trim();

    const lv = parseValue(left);
    const rv = parseValue(right);

    switch (op) {
      case '==': return lv == rv; // intentional loose equality
      case '!=': return lv != rv;
      case '>=': return Number(lv) >= Number(rv);
      case '<=': return Number(lv) <= Number(rv);
      case '>': return Number(lv) > Number(rv);
      case '<': return Number(lv) < Number(rv);
    }
  }

  // No operator → treat as boolean
  const v = rendered.trim().toLowerCase();
  return v === 'true' || v === '1';
}

function parseValue(s: string): any {
  const t = s.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  const n = Number(t);
  if (!isNaN(n)) return n;
  // Strip surrounding quotes
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}
