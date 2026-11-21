import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const web = path.join(root, 'apps/web/src')
const functions = path.join(root, 'backend/supabase/functions')
const ts = createRequire(new URL('../apps/web/package.json', import.meta.url))(
  'typescript'
)
const configPath = path.join(web, '../tsconfig.json')
const config = ts.readConfigFile(configPath, ts.sys.readFile)
if (config.error)
  throw new Error(
    ts.flattenDiagnosticMessageText(config.error.messageText, '\n')
  )
const { options } = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  path.dirname(configPath)
)
const extensions = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]
const roots = ['domain', 'application', 'features'].map((layer) =>
  path.join(web, layer)
)
const webFiles = roots.flatMap((dir) => ts.sys.readDirectory(dir, extensions))
webFiles.push(...ts.sys.readDirectory(path.join(web, 'app'), ['.tsx']))
const backendFiles = ts.sys.readDirectory(
  functions,
  extensions,
  [],
  ['*/application/**/*']
)
const files = [...webFiles, ...backendFiles].sort()
const program = ts.createProgram(files, { ...options, allowJs: true })
const checker = program.getTypeChecker()
const issues = []
const sdk =
  /(?:^|\/)(?:@capacitor(?:-community)?|@supabase)\/|^(?:capacitor|supabase)(?:\/|$)/
const ui =
  /(?:^|\/)(?:react(?:-dom|-native|-router(?:-dom)?)?|lucide-react)(?:@[^/]+)?(?:\/|$)/
const httpGlobals = new Set([
  'Deno',
  'fetch',
  'Request',
  'RequestInit',
  'RequestInfo',
  'Response',
  'ResponseInit',
  'Headers',
  'HeadersInit',
])

function report(node, source, reason) {
  const { line, character } = source.getLineAndCharacterOfPosition(
    node.getStart(source)
  )
  const file = path.relative(root, source.fileName)
  issues.push(`${file}:${line + 1}:${character + 1} — ${reason}`)
}

function localTarget(specifier, source) {
  const name = specifier.split(/[?#]/, 1)[0]
  if (name.startsWith('.'))
    return path.resolve(path.dirname(source.fileName), name)
  if (name.startsWith('/src/')) return path.join(web, name.slice(5))
  if (path.isAbsolute(name)) return name
  const resolved = ts.resolveModuleName(
    name,
    source.fileName,
    options,
    ts.sys
  ).resolvedModule
  return resolved && !resolved.isExternalLibraryImport
    ? resolved.resolvedFileName
    : undefined
}

function checkImport(node, source, layer) {
  if (!ts.isStringLiteralLike(node)) {
    report(
      node,
      source,
      'O caminho do módulo precisa ser estático para verificar esta fronteira.'
    )
    return
  }
  const name = node.text
  const target = localTarget(name, source)
  let reason
  if (layer === 'backend') {
    const directory = target && path.relative(functions, target).split(path.sep)
    if (
      !directory ||
      directory[0] === '..' ||
      !['application', 'domain'].includes(directory[1])
    ) {
      reason =
        'A aplicação de backend depende somente dos casos de uso e do domínio.'
    }
  } else {
    const pkg = name.replace(/^(?:npm:|jsr:)/, '')
    const destination = target && path.relative(web, target).split(path.sep)[0]
    if (sdk.test(pkg)) {
      reason =
        'O SDK de infraestrutura deve ser acessado por uma porta da aplicação.'
    } else if (layer === 'features' || layer === 'app') {
      if (
        ['..', 'data', 'platform', 'adapters'].includes(destination) ||
        (layer === 'features' && destination === 'app') ||
        /^main\.[cm]?[jt]sx?$/.test(destination || '')
      ) {
        reason = 'A interface deve receber o adaptador pela composição.'
      }
    } else if (
      ui.test(pkg) ||
      /\.css(?:[?#]|$)/.test(name) ||
      (target &&
        destination !== 'domain' &&
        !(layer === 'application' && destination === 'application'))
    ) {
      reason =
        'O domínio e os casos de uso da web devem permanecer independentes da interface e dos adaptadores.'
    }
  }
  if (reason) report(node, source, `${reason} Import: ${name}`)
}

// Resolve the symbol so a port method or a locally defined type named Request is allowed.
function globalDependency(node) {
  if (
    ts.isElementAccessExpression(node) &&
    node.expression.getText() === 'globalThis' &&
    ts.isStringLiteralLike(node.argumentExpression) &&
    httpGlobals.has(node.argumentExpression.text)
  ) {
    return node.argumentExpression.text
  }
  if (!ts.isIdentifier(node) || !httpGlobals.has(node.text)) return
  const parent = node.parent
  if (
    ts.isPropertyAccessExpression(parent) &&
    parent.name === node &&
    parent.expression.getText() !== 'globalThis'
  )
    return
  const symbol = ts.isShorthandPropertyAssignment(parent)
    ? checker.getShorthandAssignmentValueSymbol(parent)
    : checker.getSymbolAtLocation(node)
  const declarations = symbol?.declarations
  if (
    !declarations?.length ||
    declarations.some((d) =>
      program.isSourceFileDefaultLibrary(d.getSourceFile())
    )
  )
    return node.text
}

function visit(node, source, layer) {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier
  ) {
    checkImport(node.moduleSpecifier, source, layer)
  } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    checkImport(node.argument.literal, source, layer)
  } else if (ts.isExternalModuleReference(node)) {
    checkImport(node.expression, source, layer)
  } else if (
    ts.isCallExpression(node) &&
    node.arguments.length &&
    (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
  ) {
    checkImport(node.arguments[0], source, layer)
  }

  if (layer === 'backend') {
    const name = globalDependency(node)
    if (name)
      report(
        node,
        source,
        'O caso de uso de backend depende do runtime ou de HTTP: ' + name
      )
  } else if (
    layer !== 'features' &&
    layer !== 'app' &&
    (ts.isJsxOpeningElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxOpeningFragment(node))
  ) {
    report(
      node,
      source,
      'JSX depende da interface e deve ficar fora do domínio e dos casos de uso.'
    )
  }
  ts.forEachChild(node, (child) => visit(child, source, layer))
}

for (const file of files) {
  const source = program.getSourceFile(file)
  const layer = path.relative(web, file).split(path.sep)[0]
  visit(source, source, layer === '..' ? 'backend' : layer)
}
if (issues.length) {
  console.error(issues.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    `Fronteiras de arquitetura verificadas em ${files.length} arquivos.`
  )
}
