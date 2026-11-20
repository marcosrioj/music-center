"""Package the synchronized iOS project and local Swift plugins for Xcode."""
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "MusicCenter-iOS/"
PLUGINS = ("app", "filesystem", "preferences", "share")
IGNORED = {".DS_Store", ".gitignore", "xcuserdata", "DerivedData", ".build", ".git", "__pycache__"}
README = """# MusicCenter para iPhone e iPad

Extraia toda a pasta, abra ios/App/App.xcodeproj no Xcode 26 ou superior em um Mac e selecione o esquema App. A resolução inicial das dependências Swift requer internet. Escolha um simulador com iOS 16.4 ou superior e execute Run. Para instalar em aparelho físico, configure sua equipe em Signing & Capabilities.

Os quatro plugins Swift locais ficam em node_modules. Mantenha as pastas nas posições fornecidas. O aplicativo usa o mesmo projeto Supabase do painel web. Em uma instalação genérica, informe o endereço HTTPS do painel publicado na primeira abertura. Para confirmação de e-mail e recuperação de senha em aparelhos, inclua app.musiccenter.mobile://auth/callback nos Redirect URLs do projeto Supabase.

Para alterar a interface, instale Node.js 22.12 ou posterior e rode npm ci na pasta extraída. Para fixar a configuração do serviço, copie .env.example para .env.local, preencha as variáveis públicas e execute npm run ios. As migrações e a função de exclusão da conta estão em supabase.
"""


def files(folder: str):
    for path in (ROOT / folder).rglob("*"):
        parts = path.relative_to(ROOT).parts
        if (path.is_file() and not IGNORED.intersection(parts)
                and all(not part.startswith(".") for part in parts)
                and path.suffix not in {".p12", ".p8", ".pem", ".key", ".mobileprovision", ".pyc"}):
            yield path


def write(archive, name, content):
    entry = ZipInfo(PREFIX + name)
    entry.create_system = 3
    entry.external_attr = 0o100644 << 16
    archive.writestr(entry, content, compress_type=ZIP_DEFLATED, compresslevel=8)


def package():
    web = ROOT / "dist"
    native = ROOT / "ios/App/App/public"
    if not (web / "index.html").is_file():
        raise SystemExit("Execute npm run sync antes de empacotar o projeto iOS.")
    for asset in files("dist"):
        copy = native / asset.relative_to(web)
        if not copy.exists() or copy.read_bytes() != asset.read_bytes():
            raise SystemExit("A interface do projeto iOS precisa de npm run sync.")

    entries = {ROOT / name for name in (
        ".env.example", "package.json", "package-lock.json", "capacitor.config.ts",
        "vite.config.ts", "tsconfig.json", "index.html", "ios/debug.xcconfig",
        "supabase/config.toml", "public/icon.png",
    )}
    for folder in ("src", "scripts", "ios/App", "public/art", "supabase/migrations", "supabase/functions"):
        entries.update(files(folder))
    for name in PLUGINS:
        plugin = "node_modules/@capacitor/" + name
        entries.update(files(plugin + "/ios"))
        entries.update(ROOT / plugin / file for file in ("LICENSE", "Package.swift"))

    out = ROOT / "entrega"
    out.mkdir(exist_ok=True)
    target = out / "MusicCenter-iOS.zip"
    with NamedTemporaryFile(dir=out, suffix=".tmp", delete=False) as temporary:
        pending = Path(temporary.name)
    try:
        with ZipFile(pending, "w") as archive:
            write(archive, "LEIA-ME.md", README.encode())
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
