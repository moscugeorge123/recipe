#!/usr/bin/env node
/**
 * Lists user-visible string literals that skip `t()`: JSX text, string props that
 * render as text (title, label, placeholder, accessibilityLabel, ...), string
 * literals inside conditionals / concatenations / templates passed to those
 * props or used as JSX children, and the message passed to `toast()`.
 *
 *   node scripts/i18n-audit.mjs            # report, exit 1 when anything is un-keyed
 *   node scripts/i18n-audit.mjs --summary  # one line per file
 *   node scripts/i18n-audit.mjs --json     # machine-readable (used by the codemod)
 *   node scripts/i18n-audit.mjs --check    # ratchet: fail if any file has more un-keyed
 *                                          # strings than scripts/i18n-audit-baseline.json
 *   node scripts/i18n-audit.mjs --update-baseline   # record the current counts
 *
 * A literal is allowed when the text has no letters (icons, punctuation, numbers)
 * or is in ALLOW_TEXT (brand names).
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** JSX in these is audited fully; `toast()` calls are audited everywhere under src. */
const JSX_DIRS = ['src/tortie/screens', 'src/tortie/ui'];
const TOAST_DIRS = ['src/tortie', 'src/features'];
/** Object-literal properties (`{ label: 'x' }`) are audited here too. */
const PROP_DIRS = ['src/tortie/screens', 'src/tortie/ui', 'src/tortie/data'];

/** Props whose string value ends up on screen or in the screen-reader. */
const TEXT_PROPS = new Set([
  'title',
  'label',
  'subtitle',
  'body',
  'placeholder',
  'accessibilityLabel',
  'accessibilityHint',
  'hint',
  'cta',
  'message',
  'text',
  'heading',
  'kicker',
  'sub',
  'eyebrow',
  'actionLabel',
  'confirmLabel',
  'cancelLabel',
  'description',
  'l',
]);

/** Brand names, icon-font ligatures and dev-only placeholder captions. */
const ALLOW_TEXT = new Set([
  'Tortie',
  'Google',
  'Facebook',
  'Instagram',
  'YouTube',
  'tune',
  'check_circle',
  'auto_awesome',
  'photo ·',
]);

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const asSummary = args.has('--summary');
const check = args.has('--check');
const updateBaseline = args.has('--update-baseline');
const BASELINE = join(ROOT, 'scripts/i18n-audit-baseline.json');

function walk(dir, exts) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === '__tests__') continue;
    if (statSync(full).isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

function visible(text) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return /\p{L}/u.test(trimmed) &&
    !ALLOW_TEXT.has(trimmed) &&
    !/^[a-z]:[a-z]+$/.test(trimmed) &&
    !/^[A-Z_]+$/.test(trimmed)
    ? trimmed
    : null;
}

/**
 * String pieces an expression can render: literals, both branches of a
 * conditional, both sides of `+` / `||` / `??`, and templates (expressions
 * become `{expr}` placeholders).
 */
function pieces(node, sf) {
  if (ts.isParenthesizedExpression(node)) return pieces(node.expression, sf);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return [{ node, text: node.text, params: [] }];
  }
  if (ts.isTemplateExpression(node)) {
    const params = [];
    let text = node.head.text;
    for (const span of node.templateSpans) {
      params.push(span.expression.getText(sf));
      text += `{${params.length - 1}}` + span.literal.text;
    }
    return [{ node, text, params }];
  }
  if (ts.isConditionalExpression(node)) {
    return [...pieces(node.whenTrue, sf), ...pieces(node.whenFalse, sf)];
  }
  if (
    ts.isBinaryExpression(node) &&
    [
      ts.SyntaxKind.PlusToken,
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken,
      ts.SyntaxKind.AmpersandAmpersandToken,
    ].includes(node.operatorToken.kind)
  ) {
    return [...pieces(node.left, sf), ...pieces(node.right, sf)];
  }
  return [];
}

function auditFile(file, { jsx, toasts, props }) {
  const source = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found = [];
  const add = (node, kind, text, params = []) => {
    const value = visible(text);
    if (!value) return;
    const start = node.getStart(sf);
    const { line } = sf.getLineAndCharacterOfPosition(start);
    found.push({
      line: line + 1,
      kind,
      text: value,
      params,
      start,
      end: node.getEnd(),
      raw: text,
    });
  };

  const visit = (node) => {
    if (jsx && ts.isJsxText(node)) {
      add(node, 'text', node.getText(sf));
    } else if (
      jsx &&
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      for (const p of pieces(node.expression, sf))
        add(p.node, 'child', p.text, p.params);
    } else if (
      jsx &&
      ts.isJsxAttribute(node) &&
      TEXT_PROPS.has(node.name.getText(sf)) &&
      node.initializer
    ) {
      const kind = `prop:${node.name.getText(sf)}`;
      const init = node.initializer;
      if (ts.isStringLiteral(init)) add(init, kind, init.text);
      else if (ts.isJsxExpression(init) && init.expression) {
        for (const p of pieces(init.expression, sf))
          add(p.node, kind, p.text, p.params);
      }
    } else if (
      props &&
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      TEXT_PROPS.has(node.name.text) &&
      !ts.isJsxAttribute(node.parent)
    ) {
      for (const p of pieces(node.initializer, sf))
        add(p.node, `field:${node.name.text}`, p.text, p.params);
    } else if (
      toasts &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'toast' &&
      node.arguments[0]
    ) {
      for (const p of pieces(node.arguments[0], sf))
        add(p.node, 'toast', p.text, p.params);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

export function runAudit() {
  const files = new Map();
  for (const dir of JSX_DIRS) {
    for (const f of walk(join(ROOT, dir), ['.tsx']))
      files.set(f, { jsx: true, toasts: true, props: true });
  }
  for (const dir of PROP_DIRS) {
    for (const f of walk(join(ROOT, dir), ['.ts', '.tsx'])) {
      const cur = files.get(f);
      files.set(f, { jsx: cur?.jsx ?? false, toasts: true, props: true });
    }
  }
  for (const dir of TOAST_DIRS) {
    for (const f of walk(join(ROOT, dir), ['.ts', '.tsx'])) {
      const cur = files.get(f);
      files.set(f, {
        jsx: cur?.jsx ?? false,
        toasts: true,
        props: cur?.props ?? false,
      });
    }
  }
  const report = [];
  for (const [file, opts] of files) {
    const rel = relative(ROOT, file).split(sep).join('/');
    const hits = auditFile(file, opts);
    if (hits.length) report.push({ file: rel, hits });
  }
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = runAudit();
  const total = report.reduce((n, r) => n + r.hits.length, 0);
  const counts = Object.fromEntries(report.map((r) => [r.file, r.hits.length]));

  if (updateBaseline) {
    writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + '\n');
    console.log(`Baseline written: ${Object.keys(counts).length} file(s)`);
    process.exit(0);
  }
  if (check) {
    const baseline = existsSync(BASELINE)
      ? JSON.parse(readFileSync(BASELINE, 'utf8'))
      : {};
    const worse = report.filter((r) => r.hits.length > (baseline[r.file] ?? 0));
    for (const r of worse) {
      console.log(
        `${r.file}: ${r.hits.length} un-keyed string(s), baseline ${baseline[r.file] ?? 0}`,
      );
      for (const h of r.hits) console.log(`  ${h.line}: [${h.kind}] ${h.text}`);
    }
    const fixed = Object.keys(baseline).filter(
      (f) => (counts[f] ?? 0) < baseline[f],
    ).length;
    if (fixed)
      console.log(
        `${fixed} file(s) improved: run --update-baseline to lock it in.`,
      );
    process.exit(worse.length ? 1 : 0);
  }
  if (asJson) {
    console.log(JSON.stringify({ total, files: report }, null, 2));
  } else if (asSummary) {
    for (const r of report.sort((a, b) => b.hits.length - a.hits.length)) {
      console.log(String(r.hits.length).padStart(4), r.file);
    }
    console.log(String(total).padStart(4), 'total');
  } else {
    for (const r of report) {
      console.log(r.file);
      for (const h of r.hits) console.log(`  ${h.line}: [${h.kind}] ${h.text}`);
    }
    console.log(`\n${total} un-keyed string(s) in ${report.length} file(s)`);
  }
  process.exit(total ? 1 : 0);
}
