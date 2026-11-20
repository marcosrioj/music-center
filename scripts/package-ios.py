"""Package the synchronized iOS workspace and its local Swift dependencies."""
import json
import re
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "MusicCenter-iOS/"
WEB = ROOT / "apps/web"
MOBILE = ROOT / "apps/mobile"
IOS = MOBILE / "ios"
IGNORED = {"xcuserdata", "DerivedData", "build", "node_modules", "__pycache__"}
PRIVATE_SUFFIXES = {".p12", ".p8", ".pem", ".key", ".mobileprovision", ".pyc"}
README = """# MusicCenter para iPhone e iPad

Extraia a pasta MusicCenter-iOS inteira e abra `apps/mobile/ios/App/App.xcodeproj` no Xcode 26 ou superior, em um Mac. Selecione o esquema **App**, escolha um simulador com iOS 16.4 ou superior e execute **Run**. Para instalar no aparelho, selecione sua equipe em **Signing & Capabilities**. O Xcode precisa de internet para baixar as dependências Swift remotas na primeira abertura.

A interface compilada e os plugins Swift locais já acompanham o projeto. Mantenha `node_modules` e `apps` nas posições fornecidas. O aplicativo usa o serviço Supabase do painel. Uma compilação genérica solicita o endereço HTTPS do painel na primeira abertura.

Para alterar a interface e recompilar, abra um terminal na pasta MusicCenter-iOS, onde estão `package.json` e `package-lock.json`. Instale Node.js 22.12 ou posterior e execute `npm ci`. O código da interface está em `apps/web`. As compilações configuradas incluem na raiz um `.env` com os valores públicos do painel para que a recompilação use o mesmo serviço. Para apontar para outro painel, copie `.env.example` para `.env.local` na raiz e preencha as três variáveis públicas. Use `npm run ios` no Mac para recompilar a interface, sincronizar o projeto iOS e abri-lo no Xcode.

As migrações e a função de exclusão de conta ficam em `backend/supabase`. Para receber os links de confirmação e recuperação de senha no aplicativo, cadastre `app.musiccenter.mobile://auth/callback` entre os endereços de redirecionamento permitidos no Supabase.
"""


def files(folder):
    for path in folder.rglob("*"):
        parts = path.relative_to(folder).parts
        if (path.is_file() and not path.is_symlink()
                and not IGNORED.intersection(parts)
                and all(not part.startswith(".") for part in parts)
                and path.suffix.lower() not in PRIVATE_SUFFIXES):
            yield path


def swift_dependencies():
    manifest = IOS / "App/CapApp-SPM/Package.swift"
    relative_paths = re.findall(r'\.package\([^()]*?\bpath:\s*"([^"]+)"', manifest.read_text())
    if not relative_paths:
        raise SystemExit("Sincronize os plugins Swift locais antes de empacotar o projeto iOS.")
    for relative in relative_paths:
        plugin = (manifest.parent / relative).resolve()
        if not plugin.is_relative_to(ROOT / "node_modules") or not (plugin / "Package.swift").is_file():
            raise SystemExit("O plugin Swift local não está sincronizado: " + relative)
        yield plugin / "LICENSE"
        yield plugin / "Package.swift"
        yield from files(plugin / "ios")


def public_build_env(dist):
    config = json.loads((dist / "musiccenter-config.json").read_text())
    names = {"url": "VITE_SUPABASE_URL", "key": "VITE_SUPABASE_PUBLISHABLE_KEY",
             "webUrl": "VITE_PUBLIC_WEB_URL"}
    # Only the values from the built, client-visible JSON travel with the archive.
    return "".join(f"{var}={json.dumps(config[key])}\n"
                   for key, var in names.items() if config.get(key))


def write(archive, name, content):
    entry = ZipInfo(PREFIX + name)
    entry.create_system = 3
    entry.external_attr = 0o100644 << 16
    archive.writestr(entry, content, compress_type=ZIP_DEFLATED, compresslevel=8)


def package():
    dist = WEB / "dist"
    native = IOS / "App/App/public"
    if not all((dist / name).is_file() for name in ("index.html", "musiccenter-config.json")):
        raise SystemExit("Execute npm run sync antes de empacotar o projeto iOS.")
    for asset in files(dist):
        copy = native / asset.relative_to(dist)
        if not copy.is_file() or copy.read_bytes() != asset.read_bytes():
            raise SystemExit("A interface do projeto iOS precisa de npm run sync.")

    entries = {ROOT / name for name in (
        ".env.example", "package.json", "package-lock.json",
        "apps/web/package.json", "apps/web/vite.config.ts", "apps/web/tsconfig.json",
        "apps/web/index.html", "apps/mobile/package.json", "apps/mobile/capacitor.config.ts",
        "backend/package.json", "backend/supabase/config.toml", "backend/tests/online.mjs",
        "scripts/package-ios.py", "scripts/package-web.py",
    )}
    for folder in (
        WEB / "src", WEB / "scripts", WEB / "public", MOBILE / "scripts", IOS,
        ROOT / "docs", ROOT / "backend/supabase/migrations",
        ROOT / "backend/supabase/functions", ROOT / "backend/supabase/tests",
    ):
        entries.update(files(folder))
    entries.update(swift_dependencies())

    out = ROOT / "entrega"
    out.mkdir(exist_ok=True)
    target = out / "MusicCenter-iOS.zip"
    with NamedTemporaryFile(dir=out, suffix=".tmp", delete=False) as temporary:
        pending = Path(temporary.name)
    try:
        with ZipFile(pending, "w") as archive:
            write(archive, "LEIA-ME.md", README.encode())
            public_env = public_build_env(dist)
            if public_env:
                write(archive, ".env", public_env.encode())
            for path in sorted(entries):
                write(archive, path.relative_to(ROOT).as_posix(), path.read_bytes())
        with ZipFile(pending) as archive:
            damage = archive.testzip()
            if damage:
                raise ValueError("Arquivo corrompido: " + damage)
        pending.chmod(0o644)
        pending.replace(target)
        print(target)
    finally:
        pending.unlink(missing_ok=True)


if __name__ == "__main__":
    package()
