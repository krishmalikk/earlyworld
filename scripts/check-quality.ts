import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** Parse source so comments, prose, and unrelated numeric values do not trigger style checks. */
export function qualityIssues(file: string, text: string): string[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const issues: string[] = [];
  const report = (node: ts.Node, message: string) =>
    issues.push(
      `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${message}`,
    );
  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === 'react-native'
    ) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const item of bindings.elements)
          if ((item.propertyName || item.name).text === 'Image')
            report(item, 'Use the shared Artwork component or expo-image.');
    }
    if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(source),
        value = node.initializer;
      if (
        /^(?:padding\w*|margin\w*|gap|rowGap|columnGap|fontSize|lineHeight|letterSpacing|borderRadius)$/.test(
          key,
        ) &&
        (ts.isNumericLiteral(value) ||
          (ts.isPrefixUnaryExpression(value) && ts.isNumericLiteral(value.operand)))
      )
        report(value, 'Use a design token from shared/theme.ts for static design values.');
      if (/^(?:fontFamily|fontWeight)$/.test(key) && ts.isStringLiteral(value))
        report(value, 'Use a typography token.');
      if (/color$/i.test(key) && ts.isStringLiteral(value) && value.text !== 'transparent')
        report(value, 'Use a shared brand color.');
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword)
      report(node, 'Use a specific type or validate unknown at the boundary.');
    ts.forEachChild(node, visit);
  };
  visit(source);
  return issues;
}
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}
if (process.argv[1]?.endsWith('check-quality.ts')) {
  const issues = ['app', 'src']
    .flatMap(sourceFiles)
    .flatMap((file) => qualityIssues(file, readFileSync(file, 'utf8')));
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else console.log('UI quality checks passed: shared images, design tokens, and explicit types.');
}
