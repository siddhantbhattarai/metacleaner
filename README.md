# metacleaner

A local, offline metadata cleaner and AI-tag remover for images,
text/Markdown, HTML, SVG, PDF, Office documents, and MP3/MP4/M4A/MOV
audio-video, written in Rust. Strips EXIF, GPS, XMP, IPTC, C2PA, and
AI-generator signatures (Stable Diffusion, DALL-E, Midjourney, Firefly);
invisible-Unicode steganography; PDF/XMP metadata; ID3/iTunes tags; and
document metadata. Includes an optional local-model writing assistant for
general English and IELTS/PTE Academic practice. No external upload. Install
via apt.

- **Images** (JPEG, PNG, WebP, BMP, GIF, TIFF): strips EXIF, GPS, XMP, IPTC,
  C2PA content credentials, and AI-generator signatures (Stable Diffusion
  `tEXt`/`iTXt`/`zTXt` chunks, DALL-E/Midjourney/Adobe Firefly fingerprints),
  and can optionally reset the pixel-level fingerprint of the output so old
  copies can't be hash-matched back to the source file. Also does classical
  (Lanczos3) and real AI (Real-ESRGAN, bundled, via ONNX Runtime)
  super-resolution upscaling.
- **Text/Markdown** (`.txt`/`.md`): strips invisible-Unicode steganography
  (zero-width characters, bidi overrides, Unicode Tag block smuggling,
  variation-selector smuggling) and, for `.md`, AI/tool-identifying
  frontmatter keys (`author`, `generator`, etc.).
- **HTML** (`.html`/`.htm`): strips identifying `<meta>` tags (`generator`,
  `author`, `dc.creator`, ...) and non-conditional comments — the invisible-
  Unicode pass above applies here too.
- **SVG** (`.svg`): strips editor-injected `<metadata>` elements (Inkscape/
  Illustrator RDF/Dublin Core blocks), `inkscape:*`/`sodipodi:*` namespaced
  attributes, and comments. `<title>`/`<desc>` are left alone — that's
  accessibility content, not editor cruft.
- **PDF** (`.pdf`): strips the `/Info` dictionary (Author, Producer,
  Creator, Title, Subject, Keywords, dates) and every XMP metadata stream
  in the file, wherever in the object graph it appears. Page content,
  fonts, and images are untouched. Scope note: embedded file attachments,
  form field values, and JavaScript actions aren't covered by this first
  pass — see `crates/metacleaner-pdf/src/lib.rs` for the documented gap.
- **Office documents** (`.docx`/`.xlsx`/`.pptx`): strips author, company,
  last-modified-by, and custom tracking properties from `docProps/*.xml`,
  leaving document content byte-for-byte untouched.
- **Audio/video** (`.mp3`, `.mp4`/`.m4a`/`.m4v`/`.mov`): strips every
  ID3v2 frame and the legacy ID3v1 trailer from MP3 (artist, album,
  comment, encoder tag, embedded artwork), or the iTunes-style `ilst`
  metadata item list and chapter data from MP4/M4A/MOV. Audio/video
  sample data is untouched. Scope note: covers the standard iTunes-style
  metadata dictionary — see `crates/metacleaner-media/src/mp4.rs` for the
  documented gap on non-standard atoms. (Uses the `id3` crate, MPL-2.0 —
  see `crates/metacleaner-media/Cargo.toml`.)

A separate `inspect` (and per-format `inspect-text`/`inspect-doc`/
`inspect-pdf`/`inspect-media`) subcommand reports what's present in a file
without modifying it. Every `clean`/`inspect` command also accepts
directories via `--recursive`/`-r`, auto-detecting each file's type by
extension. A `serve` subcommand runs a local web UI (drag-and-drop, batch,
download) at `http://127.0.0.1`, bound to loopback only, with options that
adapt to whatever file type you drop. It also includes an optional writing
assistant that extracts text from TXT, Markdown, DOCX, and PDF files and
requests revisions from an Ollama service running locally. Searchable PDFs
use embedded text; scanned PDFs use local Poppler rendering and Tesseract
OCR. Modes
cover general grammar and clarity, IELTS Academic Task 1 and Task 2, PTE
Academic Write Essay, and PTE Academic Summarize Written Text. Users can set
an IELTS band/PTE score practice target and select an English variety. The
assistant returns a revised draft, individual grammar suggestions that can
be applied or dismissed, and exam feedback against published criteria. It
does not predict official exam scores. DOCX export retains the package,
page setup, tables, and paragraph/run formatting while revising body text.
PDF export retains the source pages and appends the revised text in PDF
pages sized to the source document.

The cleaner makes no external network calls and never uploads files. The
optional writing assistant connects to Ollama on this machine by default
(`127.0.0.1:11434`). Install Ollama separately, start it, and pull a
model (for example, `ollama pull qwen3.5:9b`; smaller models are available
for computers with less memory). Enter that model name in the
writing panel. Ollama and its model weights are not bundled into the apt
package, so the cleaner remains usable without a model.

For rule-based English grammar and spelling checks, the writing panel can
also connect to a [local LanguageTool server](https://github.com/languagetool-org/languagetool)
on `127.0.0.1:8081`. Install Java, download and unpack the
[LanguageTool standalone package](https://languagetool.org/download/), then
start its HTTP server from that directory:

```sh
touch server.properties
java -cp languagetool-server.jar org.languagetool.server.HTTPServer \
  --config server.properties --port 8081
```

Choose **Check grammar locally** in the writing panel. The app sends the
draft only to this local server. LanguageTool's public free endpoint is not
used: its published rules prohibit automated requests. [ZeroGPT's API](https://www.zerogpt.com/pricing)
requires an account and usage credits, so it is not an open-source free API.

For scanned PDF OCR on Debian/Ubuntu, install `tesseract-ocr` with English
language data and `poppler-utils` (`pdftoppm`). OCR runs locally.

The exam feedback follows the public [IELTS Writing criteria](https://ielts.org/take-a-test/preparation-resources/writing-test-resources)
and [Pearson PTE Academic task guidance](https://www.pearsonpte.com/pte-academic/test-format/speaking-writing/).
These modes are study aids, not official IELTS or PTE scoring services.

## Install

### Download the latest release

Release builds publish a Debian package and a Windows bundle on the
[GitHub Releases page](https://github.com/siddhantbhattarai/metacleaner/releases/latest).
Download `metacleaner_<version>-1_amd64.deb` and install it with
`sudo apt install ./metacleaner_<version>-1_amd64.deb`. On Windows, download
`metacleaner-windows-x86_64.zip` and run `metaclean.exe` from the extracted
folder. The release also includes the standalone `metaclean.exe`.

### Debian / Ubuntu (apt)

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://siddhantbhattarai.github.io/metacleaner/pubkey.gpg \
  | sudo tee /etc/apt/keyrings/metacleaner.asc > /dev/null

echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/metacleaner.asc] https://siddhantbhattarai.github.io/metacleaner stable main" \
  | sudo tee /etc/apt/sources.list.d/metacleaner.list

sudo apt update
sudo apt install metacleaner
```

This adds a dedicated apt source signed with a repo-specific GPG key (not a
global `apt-key` entry) — standard practice for third-party apt
repositories. The repo itself (`Packages`/`Release`/`InRelease`, GPG-signed)
is published at <https://siddhantbhattarai.github.io/metacleaner/> via
GitHub Pages, built from the `.deb` this project's `cargo deb` produces (see
[Package as a `.deb`](#package-as-a-deb) below).

### From source

See [Build](#build) below — `cargo build --release --workspace` or
`cargo deb -p metacleaner-cli` if you'd rather build the `.deb` yourself.

### Windows

With the Rust stable toolchain installed, build the standalone executable in
PowerShell:

```powershell
cargo build --release --workspace
.\target\release\metaclean.exe serve
```

The executable includes the web UI and existing image-upscaling model. For
writing assistance, install Ollama separately and pull a text model as shown
above; the model weights are not bundled with the `.exe`.

## Why full decode/re-encode instead of parsing each metadata format?

JPEG APPn segments, PNG ancillary chunks, and WebP RIFF metadata chunks are
all *container-level* data that sits alongside — not inside — the pixel
data. Rather than hand-parsing every known tag scheme (EXIF, XMP, IPTC,
C2PA/JUMBF, plus whatever the next AI tool invents), `metacleaner-core`
fully decodes the image to raw pixels and re-encodes it from scratch. The
encoder only ever writes geometry + pixel data, so every non-pixel segment
is dropped by construction — including formats this tool has never heard of.

## Workspace layout

```
metacleaner/
├── crates/
│   ├── metacleaner-core/   # image clean/inspect: pure in-memory library,
│   │                       # bytes in -> clean bytes out, no file or network
│   │                       # I/O, so it's reusable from a future
│   │                       # wasm32-unknown-unknown build for a browser UI
│   ├── metacleaner-ai/     # real AI super-resolution (Real-ESRGAN via ONNX
│   │   └── models/         # Runtime); bundled model weights, own crate so
│   │                       # metacleaner-core stays dependency-light
│   ├── metacleaner-text/   # invisible-Unicode stripping, Markdown
│   │                       # frontmatter, HTML <meta>/comment stripping,
│   │                       # SVG editor-metadata stripping — dependency-
│   │                       # free hand-rolled scanners
│   ├── metacleaner-docs/   # OOXML (DOCX/XLSX/PPTX) metadata stripping
│   │                       # (zip + quick-xml)
│   ├── metacleaner-pdf/    # PDF /Info + XMP metadata stripping (lopdf)
│   ├── metacleaner-media/  # MP3 (id3) + MP4/M4A/MOV (mp4ameta) metadata
│   │                       # stripping
│   └── metacleaner-cli/    # `metaclean` binary (clean / inspect / clean-text
│       │                   # / inspect-text / clean-doc / inspect-doc /
│       │                   # clean-pdf / inspect-pdf / clean-media /
│       │                   # inspect-media / serve)
│       └── assets/         # embedded web UI (index.html/style.css/app.js),
│                            # compiled into the binary via include_str! —
│                            # no files to ship alongside it
└── Cargo.toml              # workspace
```

## Build

```bash
cargo build --release --workspace
# binary at target/release/metaclean
```

### Package as a `.deb`

```bash
cargo install cargo-deb   # one-time
cargo deb -p metacleaner-cli
# package at target/debian/metacleaner_<version>-1_amd64.deb

sudo apt install ./target/debian/metacleaner_*.deb
# or: sudo dpkg -i target/debian/metacleaner_*.deb
```

The `metaclean` binary is fully self-contained — the AI model and web UI
assets are embedded via `include_bytes!`/`include_str!`, and ONNX Runtime
is statically linked (no `libonnxruntime.so` at runtime) — so the package
needs no postinst script and depends on nothing beyond `libc6`/`libstdc++6`
(auto-detected by `dpkg-shlibdeps` via the `depends = "$auto"` setting in
`crates/metacleaner-cli/Cargo.toml`'s `[package.metadata.deb]`). After
installing, `metaclean` and `metaclean serve` are on your `PATH`. The package
recommends Tesseract OCR and Poppler utilities for scanned-PDF extraction.

### Shell completions and man page

`metaclean` can generate its own shell completion script and man page at
runtime (via `clap_complete`/`clap_mangen`), so they always match the
actual CLI rather than a hand-maintained copy:

```bash
metaclean completions bash > /etc/bash_completion.d/metaclean   # or zsh/fish/powershell/elvish
metaclean man > /usr/share/man/man1/metaclean.1 && mandb
```

These two subcommands are intentionally hidden from `--help` (they're a
packaging/maintainer tool, not a primary feature) but work like any other
subcommand. They aren't yet wired into the `.deb` build's `assets` list —
today that would break the plain `cargo deb -p metacleaner-cli` one-liner
above, since the files don't exist until a binary has already been built.
Automating that (build, generate, then package with the generated files
as assets) is on the [Roadmap](#roadmap).

## Usage

`metaclean` has a read-only/destructive pair of subcommands per file type:
`inspect`/`clean` for images, `inspect-text`/`clean-text` for `.txt`/`.md`/
`.html`/`.htm`/`.svg`, `inspect-doc`/`clean-doc` for `.docx`/`.xlsx`/`.pptx`,
and `inspect-pdf`/`clean-pdf` for `.pdf`. Run the `inspect*` variant first
if you want to know what's in a file before deciding to clean it.

### `inspect` — report what's there, without touching the file

```bash
# Human-readable report
metaclean inspect photo.jpg

# Multiple files, machine-readable JSON (for scripting/CI)
metaclean inspect --json *.jpg *.png
```

Exits `0` if every file was clean and readable, `1` if any file has
findings or failed to parse — so `metaclean inspect *.jpg || echo "found metadata"`
works as a CI gate.

Example output:

```
$ metaclean inspect vacation.jpg
vacation.jpg  [Jpeg 4032x3024, 3841022 bytes]
  [gps] EXIF metadata with GPS location (2481 bytes)
  [icc-profile] ICC color profile (560 bytes)
```

`inspect` walks each format's container structure directly (JPEG APPn
markers, PNG chunks, WebP RIFF chunks) — it never decodes pixels, so it's
cheap and safe to run on files you haven't decided to trust yet.

### `clean` — strip it

```bash
# Clean a single image (writes photo-clean.jpg alongside the original)
metaclean clean photo.jpg

# Batch process many images at once
metaclean clean *.jpg *.png

# Write outputs to a specific directory
metaclean clean -o cleaned/ *.jpg

# Overwrite files in place
metaclean clean --in-place photo.jpg

# Skip the invisible pixel-fingerprint reset (metadata is still stripped)
metaclean clean --no-fingerprint-reset photo.jpg

# Tune the fingerprint reset (max per-channel delta, and fraction of pixels touched)
metaclean clean --fingerprint-strength 1 --fingerprint-fraction 0.5 photo.jpg

# Force output to a different container format
metaclean clean --format webp photo.png

# Control JPEG re-encode quality (1-100, default 92)
metaclean clean --jpeg-quality 90 photo.jpg

# Classical (Lanczos3) upscale — sharper resize, doesn't invent detail
metaclean clean --upscale 2.0 photo.jpg

# Real AI super-resolution (Real-ESRGAN, bundled model) — hallucinates
# plausible detail; meant for small/low-res images, capped at 1600px input
metaclean clean --ai-upscale photo.jpg

# Classical (non-AI) quality enhancement: auto-contrast + unsharp-mask
metaclean clean --enhance photo.jpg

# Machine-readable JSON output
metaclean clean --json *.jpg

# Tune the decompression-bomb guard (defaults: 256 MB input, 12000px per side, 512 MB decoded)
metaclean clean --max-input-mb 100 --max-dimension 8000 --max-decoded-mb 256 photo.jpg
```

Both subcommands share the same decompression-bomb guard flags
(`--max-input-mb`, `--max-dimension`; `clean` additionally has
`--max-decoded-mb`), so inspecting an untrusted file is exactly as safe as
cleaning one.

Run `metaclean --help`, `metaclean clean --help`, or `metaclean inspect --help`
for the full flag list.

### `inspect-text` / `clean-text` — text, Markdown, HTML, SVG

```bash
# Report invisible characters / frontmatter keys / meta+comments present
metaclean inspect-text notes.md page.html icon.svg

# Strip them (writes notes-clean.md alongside the original)
metaclean clean-text notes.md page.html icon.svg

# Also strip the zero-width joiner (off by default — it's what joins emoji
# into family/profession sequences, so it's kept unless you need it gone)
metaclean clean-text --strip-zero-width-joiner notes.md

# Also normalize typography: curly quotes -> straight, em/en-dash -> hyphen,
# non-breaking space -> regular space (off by default — these are genuine
# AI-tool typographic artifacts, but this changes rendered characters, not
# just hidden ones, unlike everything else clean-text does)
metaclean clean-text --normalize-typography notes.md

# Report advisory AI-writing-style indicators (stock vocabulary/phrases,
# unusually uniform sentence length, elevated em-dash rate) alongside the
# normal findings — informational only, never a score, never gates the
# exit code; see the printed caveat about false positives
metaclean inspect-text --ai-style notes.md
```

For `.md` files, AI/tool-identifying frontmatter keys (`author`, `creator`,
`generator`, `model`, `prompt`, ...) are removed from the YAML frontmatter
block; every other key (`title`, `date`, `tags`, ...) is left untouched,
since frontmatter is often functionally required by a site generator, not
pure metadata. For `.html`/`.htm` files, identifying `<meta>` tags
(`generator`, `author`, `dc.creator`, ...) and non-conditional HTML comments
are removed; functional meta (`charset`, `viewport`, ...) and IE conditional
comments (`<!--[if IE]>...<![endif]-->`) are left alone. For `.svg` files,
editor-injected `<metadata>` elements (Inkscape/Illustrator RDF/Dublin Core),
`inkscape:*`/`sodipodi:*` namespaced attributes, and comments are removed;
`<title>`/`<desc>` are left alone since those are accessibility content.
Every other invisible/steganography-relevant character is always stripped
from every text file, regardless of extension.

`--normalize-typography` (opt-in) additionally converts curly quotes to
straight quotes, em/en-dashes to a plain hyphen, and non-breaking/narrow
no-break spaces to a regular space. It's the one `clean-text` pass that
changes ordinary rendered characters rather than only hidden/identifying
ones — but ChatGPT/Claude/Gemini/Google Docs all default to smart quotes,
em-dashes, and non-breaking spaces where a plain-keyboard human types
straight quotes, hyphens, and regular spaces, so normalizing them doubles
as removing a provenance signal. `inspect-text` always reports these
findings regardless of the flag, same as every other category.

`inspect-text --ai-style` (opt-in) additionally reports advisory
AI-writing-style indicators: stock vocabulary/phrases documented as common
LLM tells (sourced from Wikipedia's "Signs of AI writing"), unusually
uniform sentence length (low "burstiness"), and an elevated em-dash rate.
This is a linter-style hint for reviewing your own draft, **not** a score,
percentage, or verdict, and it never affects the exit code — every report
carries a caveat that these signals also occur in genuine human writing,
especially formal/academic and non-native-English prose. There is no
corresponding "clean" action: metacleaner strips *metadata about
provenance* everywhere else in this tool; rewriting prose to defeat an
AI-content detector is a different, deception-enabling capability and is
out of scope by design.

### `inspect-doc` / `clean-doc` — DOCX, XLSX, PPTX

```bash
# Report identifying metadata present (author, company, custom properties)
metaclean inspect-doc report.docx

# Strip it (document content is untouched, byte-for-byte)
metaclean clean-doc report.docx budget.xlsx slides.pptx
```

All three OOXML formats share the same `docProps/core.xml`/`app.xml`/
`custom.xml` metadata parts, which is where author/company/last-modified-by/
custom tracking properties live; `clean-doc` blanks the text nodes in those
parts via a streaming XML rewrite while every other zip entry — including
the actual document content — is copied through unchanged.

### `inspect-pdf` / `clean-pdf` — PDF

```bash
# Report identifying metadata present (/Info fields, XMP packets)
metaclean inspect-pdf report.pdf

# Strip it (page content, fonts, and images are untouched)
metaclean clean-pdf report.pdf
```

Strips the `/Info` dictionary (Author, Producer, Creator, Title, Subject,
Keywords, CreationDate, ModDate) and every XMP metadata stream in the file
— XMP can appear more than once (the document Catalog's packet, plus
duplicates embedded in images or other objects), so every object is
scanned rather than just the one the Catalog points to. Scope note:
embedded file attachments, form field values, and JavaScript actions
aren't covered by this first pass; see `crates/metacleaner-pdf/src/lib.rs`
for the documented gap.

### `inspect-media` / `clean-media` — MP3, MP4, M4A, MOV

```bash
# Report identifying metadata present (ID3 frames, MP4 metadata items)
metaclean inspect-media podcast.mp3 clip.mp4

# Strip it (audio/video sample data is untouched)
metaclean clean-media podcast.mp3 clip.mp4
```

For `.mp3`, strips every ID3v2 frame (artist, album, comment, encoder tag
`TSSE`, embedded artwork, custom `TXXX`/`PRIV` frames) and the legacy
128/227-byte ID3v1 trailer, if present. For `.mp4`/`.m4a`/`.m4v`/`.mov`,
strips the iTunes-style `ilst` metadata item list (title, artist, encoder,
embedded artwork, custom freeform items) and chapter data. Both formats
are edited in place — the existing tag/atom is located and
replaced/removed, not a full re-encode — so audio/video sample data is
byte-for-byte untouched. Scope note: `mp4ameta` targets the standard
iTunes-style metadata dictionary; some camera- or editor-specific atoms
outside it may not be covered — see `crates/metacleaner-media/src/mp4.rs`
for the documented gap.

### Recursive / batch directory input

Every `clean*`/`inspect*` command accepts a directory in place of an
explicit file list when you pass `--recursive`/`-r` — it's rejected
without the flag, since a destructive tool shouldn't silently expand a
mistyped path into "process everything underneath it":

```bash
metaclean clean --recursive ./photos
metaclean inspect-text -r ./site/content
```

Each file's type is auto-detected by extension; files with an extension the
command doesn't handle are skipped and counted in a single summary line
rather than one line of noise per skip. A file passed explicitly (not via
directory expansion) is always processed regardless of its extension.

### `serve` — local web UI

```bash
# Starts on http://127.0.0.1:7878 and opens it in your default browser
metaclean serve

# Different port, don't auto-open a browser tab
metaclean serve --port 9000 --no-open
```

Drag files onto the page (or pick them) — images, text/Markdown/HTML/SVG,
Office documents, and PDFs can all be mixed in the same batch. Each file is
inspected automatically on drop, showing findings inline, and the Options
panel adapts to show only what's relevant to the file types actually
present (image options, text options, or a doc/PDF note — those have
nothing to configure, everything identifying is always stripped). Then
"Clean & download all" cleans every file server-side (via the same
`metacleaner-core`/`metacleaner-text`/`metacleaner-docs`/`metacleaner-pdf`
functions the CLI uses) and downloads each result through the browser.

Binds to `127.0.0.1` (loopback) by default — nothing outside this machine
can reach it. `--host` exists to override this, but only do so if you
understand that anyone who can reach that address can then upload and
process files through it. There's no authentication: this is designed to
be a personal local tool, the same trust model as running a local Jupyter
notebook or dev server, not a multi-user service.

The HTML/CSS/JS are compiled into the `metaclean` binary itself
(`include_str!`) — `serve` needs nothing on disk beyond the binary, which
matters for shipping this as a single apt-installable package.

## Security: decompression-bomb guard

`clean()` rejects oversized or maliciously-crafted input before doing any
expensive work, in three layers:

1. **Raw byte size** — the CLI checks the file's size on disk (and the
   library checks `input.len()`) against `max_input_bytes` before reading or
   parsing anything.
2. **Declared dimensions** — a file's header can claim any width/height it
   wants regardless of how small the file actually is (e.g. a 65-byte PNG
   declaring a 60,000x60,000 canvas, which would need ~14 GB to decode).
   `metacleaner-core` reads each format's header via its own decoder, checks
   the declared dimensions against `max_image_dimension` via `image::Limits`,
   and rejects the file *before* allocating a pixel buffer.
3. **Decoded allocation size** — `max_decoded_bytes` bounds how much memory
   the decoder may allocate while reading pixel data, as a second, more
   general backstop.

All three are configurable via `CleanOptions` (library) or
`--max-input-mb` / `--max-dimension` / `--max-decoded-mb` (CLI), and can be
disabled individually by setting the corresponding `CleanOptions` field to
`None` if you trust your input source and want to process unusually large
legitimate images.

## What it removes

**Images:**
- EXIF (camera make/model, lens, ISO, aperture, shutter speed, software, timestamps)
- GPS / geotags
- XMP and IPTC (creator info, copyright, keywords, edit history)
- C2PA content credentials (Adobe Firefly, Photoshop, other Content Authenticity Initiative tools)
- Stable Diffusion generation parameters (Automatic1111, ComfyUI, Forge) stored in PNG `tEXt`/`iTXt`/`zTXt` chunks
- AI generator signatures embedded by DALL-E, Midjourney, Adobe Firefly, etc.
- The file's pixel-level fingerprint (optional, on by default)

**Text / Markdown / HTML / SVG:**
- Zero-width characters, bidi-control overrides, Unicode Tag block
  smuggling, and supplementary-plane variation-selector smuggling — the
  same techniques used to invisibly watermark LLM output, and (Unicode Tag
  block specifically) to smuggle hidden instructions past a reader, as in
  the 2025 "EchoLeak" prompt-injection attack on Microsoft 365 Copilot
  (CVE-2025-32711)
- Markdown YAML frontmatter keys that identify an author/tool/AI system
  (`author`, `creator`, `generator`, `model`, `prompt`, ...)
- HTML `<meta>` tags with the same identifying names, and non-conditional
  HTML comments
- SVG `<metadata>` elements (editor-injected RDF/Dublin Core), `inkscape:*`/
  `sodipodi:*` namespaced attributes, and comments
- Curly quotes, em/en-dashes, and non-breaking spaces (opt-in via
  `--normalize-typography`) — genuine AI-tool typographic artifacts

**Office documents (DOCX/XLSX/PPTX):**
- Author, last-modified-by, company, manager, title, keywords, comments,
  and any custom tracking properties in `docProps/core.xml`/`app.xml`/`custom.xml`

**PDF:**
- `/Info` dictionary fields (Author, Producer, Creator, Title, Subject,
  Keywords, CreationDate, ModDate, and any custom keys)
- Every XMP metadata stream in the object graph, not just the one the
  document Catalog points to

**Audio/video (MP3/MP4/M4A/MOV):**
- Every ID3v2 frame (artist, album, comment, encoder tag, embedded
  artwork, custom `TXXX`/`PRIV` frames) and the legacy ID3v1 trailer, for MP3
- The iTunes-style `ilst` metadata item list and chapter data, for
  MP4/M4A/MOV

## What it can't remove

Only data stored in file metadata / non-pixel container chunks (for images)
or dedicated metadata parts/tags (for text and documents) is in scope.
Anything encoded into the pixels themselves — an invisible watermark such as
Google's SynthID, or signals a visual AI classifier looks for — is not
metadata and can't be stripped this way; the same goes for AI-text-detector
evasion (paraphrasing to defeat statistical detectors), which is out of
scope by design, not a gap. Treat this as a privacy/provenance tool, not a
guarantee against AI-content detectors.

Supported image formats: JPEG, PNG, WebP, BMP, GIF, TIFF. HEIC/AVIF and
video are not yet supported.

**Animated GIFs and multi-page TIFFs are refused outright, not silently
truncated.** The `image` crate's public decoder API for both formats only
exposes "decode the first frame/page" — there's no way to ask "is there
more than one?" through it. Rather than quietly cleaning only page 1 of a
scanned document or frame 1 of an animation and discarding the rest,
`clean()` does its own bounds-checked structural scan first (GIF block
walk / TIFF IFD-chain walk) and returns a clear `MultiFrameNotSupported`
error if it finds more than one. `inspect` still works fine on these files
(it only reports on the first frame/page, never discards anything since it
doesn't write output).

## Testing

```bash
cargo test --workspace
```

`metacleaner-core`'s tests build a PNG with a real Automatic1111-style
`parameters` tEXt chunk and assert it's absent from the cleaned output, among
other checks (format conversion, unsupported-format rejection, fingerprint
reset actually changing bytes, the decompression-bomb guard rejecting a PNG
header that declares a 60,000x60,000 canvas, a genuinely animated GIF and a
multi-page TIFF both being refused rather than silently truncated, and
`inspect()` correctly identifying GPS-bearing EXIF, C2PA/JUMBF segments,
Stable Diffusion parameters, and GIF comment/application extensions across
PNG, JPEG, GIF, and TIFF fixtures).

`metacleaner-text`'s tests cover each invisible-character category (zero-width
watermark patterns, bidi-override spoofing, Unicode Tag block smuggling,
supplementary variation selectors), zero-width-joiner emoji preservation,
frontmatter key stripping (including dash/underscore-insensitive matching
and leaving non-identifying keys untouched), the HTML module (generator/
author `<meta>` stripping, plain-comment stripping, IE conditional-comment
preservation, and not mis-parsing a hypothetical `<metadata>` tag as `<meta>`),
and the SVG module (`<metadata>` element / `inkscape:`/`sodipodi:` attribute
stripping while preserving `<title>`/`<desc>` and every other attribute).

`metacleaner-docs`'s tests, plus real-file verification against fixtures
generated with `python-docx`/`openpyxl`/`python-pptx`, confirm identifying
properties are blanked while document content and every other zip entry are
preserved byte-for-byte.

`metacleaner-pdf`'s tests build a PDF with `lopdf` carrying both an `/Info`
dictionary and an XMP metadata stream, verify `inspect_pdf` reports both,
then verify `clean_pdf`'s output re-inspects as fully clean; also verified
against a real PDF tagged with `exiftool` (author/producer/title plus an
injected XMP packet) — `exiftool` itself confirms zero metadata survives
the cleaned output.

`metacleaner-media`'s tests build a minimal in-memory MP3 (via `id3`
itself) and a hand-built minimal MP4 box tree (`ftyp`+`moov{mvhd,udta/
meta/ilst}`+`mdat`) covering both formats' tag structures, verify
`inspect_mp3`/`inspect_mp4` report the tagged fields, then verify
`clean_mp3`/`clean_mp4` re-inspect as fully clean, plus an ID3v1-aware
no-op check on untagged audio; also verified against a real MP3 tagged
with `mutagen` (artist/album/comment/encoder) — `mutagen` itself confirms
zero ID3 tags survive the cleaned output, with the audio payload
byte-identical.

## Roadmap

- Automate apt-repo updates on release (currently a manual `cargo deb` +
  publish step) — a GitHub Actions workflow that rebuilds `Packages`/
  `Release`/`InRelease` and pushes a new `.deb` into `pool/main` on the
  `gh-pages` branch whenever a version is tagged.
- EPUB metadata stripping — remaining format coverage matching the fuller
  feature set of tools like `watermarks-remover`.
- Wire `metaclean completions`/`metaclean man` (already implemented, see
  [Shell completions and man page](#shell-completions-and-man-page)) into
  the `cargo deb` flow automatically, instead of the current manual step.
- Animated GIF / multi-page TIFF support — clean each frame/page instead of
  refusing the whole file (needs the multi-frame encode path, not just the
  single-frame one `clean()` uses today).
- HEIC/AVIF support.
- Real C2PA manifest parsing via the `c2pa` crate. Today `inspect` flags
  *that* a JPEG APP11 segment or PNG `caBX` chunk is present (C2PA's known
  homes in each container) but doesn't parse the JUMBF/manifest contents —
  so it can't yet tell you *who* signed a Content Credentials claim.
- Segment-preserving strip mode (via `img-parts`) that keeps the ICC profile
  and exact pixels while only dropping EXIF/XMP/C2PA segments, as an
  alternative to the current full re-encode for users who want zero
  quality/pixel change instead of a hash-busting fingerprint reset.
- `metacleaner-wasm`: a `wasm-bindgen` wrapper around `metacleaner-core`
  for a fully client-side, publicly-hostable web version (the `serve`
  subcommand's local server covers the "apt-installable local tool" use
  case; this would cover "deploy this as a public website" instead).
