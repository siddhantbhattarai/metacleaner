//! Strip identifying metadata from PDF files: the `/Info` dictionary
//! (Author, Producer, Creator, Title, Subject, Keywords, CreationDate,
//! ModDate, and any custom keys) and every XMP metadata stream (`/Type
//! /Metadata /Subtype /XML`). XMP can appear more than once — the
//! document Catalog's own packet, plus duplicates embedded inside images
//! or other objects — so every object in the file is scanned rather than
//! just the Catalog-referenced one.
//!
//! Approach mirrors `metacleaner-docs`: blunt, unconditional removal of
//! everything found in these known metadata containers, rather than
//! selectively targeting specific known-sensitive fields — the same
//! "don't miss something just because we didn't think to name it"
//! reasoning `metacleaner-core` applies to images.
//!
//! Scope note: this cleans `/Info` + XMP only, not the full PDF object
//! graph. A PDF can also carry identifying content in embedded file
//! attachments (`/EmbeddedFiles` name tree), form field values
//! (`/AcroForm`), and JavaScript actions (`/Names /JavaScript`,
//! `/OpenAction`) — those are real, known, and out of scope for this
//! first pass; flagged here rather than silently ignored, the same
//! documented-gap pattern `metacleaner-docs` uses for DOCX
//! tracked-change revision authors.
//!
//! Uses `lopdf` (pure Rust, no system libpoppler/mupdf dependency) to
//! read/rewrite the object graph directly, rather than fully
//! decode/re-encode the document the way `metacleaner-core` handles
//! images — PDF page content isn't practical to re-render losslessly
//! from scratch.

use lopdf::{Dictionary, Document, LoadOptions, Object, ObjectId, Stream};

pub const DEFAULT_MAX_INPUT_BYTES: u64 = 256 * 1024 * 1024;
pub const DEFAULT_MAX_DECOMPRESSED_STREAM_BYTES: usize = 256 * 1024 * 1024;

#[derive(Debug, Clone, Copy)]
pub struct PdfOptions {
    pub max_input_bytes: u64,
    /// Per-stream decompression cap, applied both while loading (object/
    /// xref streams) and when decoding an XMP packet for its finding
    /// preview. Guards against decompression-bomb-style attacks the same
    /// way `metacleaner-docs`'s zip-entry caps do.
    pub max_decompressed_stream_bytes: usize,
}

impl Default for PdfOptions {
    fn default() -> Self {
        Self {
            max_input_bytes: DEFAULT_MAX_INPUT_BYTES,
            max_decompressed_stream_bytes: DEFAULT_MAX_DECOMPRESSED_STREAM_BYTES,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PdfError {
    #[error("input is {size} bytes, which exceeds the {max}-byte limit")]
    InputTooLarge { size: usize, max: u64 },
    #[error("invalid or unsupported PDF: {0}")]
    Parse(#[from] lopdf::Error),
    #[error("I/O error while writing PDF: {0}")]
    Io(#[from] std::io::Error),
}

/// One identifying value found in `/Info` or an XMP metadata stream.
#[derive(Debug, Clone)]
pub struct PdfFinding {
    /// `"/Info"` for document-info entries, or `"XMP stream (object N
    /// G)"` for an XMP metadata packet.
    pub location: String,
    pub field: String,
    pub value: String,
}

#[derive(Debug, Clone, Default)]
pub struct InspectPdfReport {
    pub findings: Vec<PdfFinding>,
}

impl InspectPdfReport {
    pub fn is_clean(&self) -> bool {
        self.findings.is_empty()
    }
}

#[derive(Debug, Clone)]
pub struct PdfCleanReport {
    pub bytes_in: usize,
    pub bytes_out: usize,
    /// Human-readable labels of what was stripped, e.g. "/Info
    /// dictionary (5 field(s))", "2 XMP metadata stream(s)".
    pub stripped: Vec<String>,
}

/// Report what would be stripped, without modifying `input`.
pub fn inspect_pdf(input: &[u8], opts: &PdfOptions) -> Result<InspectPdfReport, PdfError> {
    check_size(input, opts)?;
    let document = load(input, opts)?;

    let mut findings = info_findings(&document);
    findings.extend(xmp_findings(&document, opts));

    Ok(InspectPdfReport { findings })
}

/// Extract page text for the local writing assistant. Scanned/image-only
/// pages need OCR and return little or no text here.
pub fn extract_pdf_text(input: &[u8], opts: &PdfOptions) -> Result<String, PdfError> {
    check_size(input, opts)?;
    let document = load(input, opts)?;
    let pages = document.get_pages();
    let page_numbers: Vec<u32> = pages.keys().copied().collect();
    Ok(document.extract_text_with_limit(&page_numbers, opts.max_decompressed_stream_bytes)?)
}

/// Extract page-separated text, including empty entries for image-only pages.
pub fn extract_pdf_pages_text(input: &[u8], opts: &PdfOptions) -> Result<Vec<String>, PdfError> {
    check_size(input, opts)?;
    let document = load(input, opts)?;
    let pages = document.get_pages();
    let page_numbers: Vec<u32> = pages.keys().copied().collect();
    Ok(document
        .extract_text_chunks_with_limit(&page_numbers, opts.max_decompressed_stream_bytes)
        .into_iter()
        .map(|chunk| chunk.unwrap_or_default())
        .collect())
}

/// Preserve the uploaded PDF pages and append a clean, editable-text
/// revision as PDF pages using the original page dimensions and margins.
pub fn append_revision_pages(
    input: &[u8],
    text: &str,
    opts: &PdfOptions,
) -> Result<Vec<u8>, PdfError> {
    check_size(input, opts)?;
    let mut document = load(input, opts)?;
    let original_page_count = document.get_pages().len();
    let root_id = match document.trailer.get(b"Root")? {
        Object::Reference(id) => *id,
        _ => return Err(lopdf::Error::ObjectNotFound((0, 0)).into()),
    };
    let pages_id = match document.get_object(root_id)?.as_dict()?.get(b"Pages")? {
        Object::Reference(id) => *id,
        _ => return Err(lopdf::Error::ObjectNotFound((0, 0)).into()),
    };
    let (media_box, resources) = {
        let pages = document.get_object(pages_id)?.as_dict()?;
        let media_box = pages
            .get(b"MediaBox")
            .cloned()
            .unwrap_or_else(|_| vec![0.into(), 0.into(), 612.into(), 792.into()].into());
        (media_box, pages.get(b"Resources").cloned().ok())
    };
    let (left, bottom, right, top) = media_box
        .as_array()
        .ok()
        .filter(|values| values.len() >= 4)
        .map(|values| {
            let number = |value: &Object| {
                value
                    .as_float()
                    .map(f64::from)
                    .or_else(|_| value.as_i64().map(|integer| integer as f64))
                    .unwrap_or(0.0)
            };
            (
                number(&values[0]),
                number(&values[1]),
                number(&values[2]),
                number(&values[3]),
            )
        })
        .unwrap_or((0.0, 0.0, 612.0, 792.0));
    let width = (right - left).max(200.0);
    let height = (top - bottom).max(200.0);
    let wrap_width = ((width - 104.0) / 5.5).floor().max(20.0) as usize;
    let lines_per_page = ((height - 100.0) / 13.0).floor().max(10.0) as usize;
    let lines = wrap_revision(text, wrap_width);
    let page_count = lines.len().div_ceil(lines_per_page);
    let font_id = document.add_object(Dictionary::from_iter([
        (b"Type".to_vec(), Object::Name(b"Font".to_vec())),
        (b"Subtype".to_vec(), Object::Name(b"Type1".to_vec())),
        (b"BaseFont".to_vec(), Object::Name(b"Helvetica".to_vec())),
        (
            b"Encoding".to_vec(),
            Object::Name(b"WinAnsiEncoding".to_vec()),
        ),
    ]));
    let mut page_ids = Vec::new();
    for page_lines in lines.chunks(lines_per_page) {
        let origin_x = left + 52.0;
        let origin_y = top - 44.0;
        let mut content =
            format!("BT /F1 11 Tf {origin_x:.2} {origin_y:.2} Td (Revised copy) Tj 0 -26 Td\n")
                .into_bytes();
        for line in page_lines {
            content.extend_from_slice(b"(");
            for byte in pdf_text_bytes(line) {
                if matches!(byte, b'(' | b')' | b'\\') {
                    content.push(b'\\');
                }
                content.push(byte);
            }
            content.extend_from_slice(b") Tj 0 -13 Td\n");
        }
        content.extend_from_slice(b"ET");
        let content_id = document.add_object(Stream::new(Dictionary::new(), content));
        let mut font_map = Dictionary::new();
        font_map.set("F1", Object::Reference(font_id));
        let mut resource_dict = match resources.clone() {
            Some(Object::Dictionary(dict)) => dict,
            _ => Dictionary::new(),
        };
        resource_dict.set("Font", font_map);
        let resource_id = document.add_object(resource_dict);
        let page_id = document.add_object(Dictionary::from_iter([
            (b"Type".to_vec(), Object::Name(b"Page".to_vec())),
            (b"Parent".to_vec(), Object::Reference(pages_id)),
            (b"MediaBox".to_vec(), media_box.clone()),
            (b"Resources".to_vec(), Object::Reference(resource_id)),
            (b"Contents".to_vec(), Object::Reference(content_id)),
        ]));
        page_ids.push(page_id);
    }
    {
        let pages = document.get_object_mut(pages_id)?.as_dict_mut()?;
        let kids = pages.get_mut(b"Kids")?.as_array_mut()?;
        kids.extend(page_ids.into_iter().map(Object::Reference));
        pages.set("Count", (original_page_count + page_count) as u32);
    }
    let mut out = Vec::new();
    document.save_to(&mut out)?;
    Ok(out)
}

fn wrap_revision(text: &str, width: usize) -> Vec<String> {
    let mut lines = Vec::new();
    for paragraph in text.lines() {
        let mut line = String::new();
        for word in paragraph.split_whitespace() {
            if !line.is_empty() && line.chars().count() + word.chars().count() + 1 > width {
                lines.push(std::mem::take(&mut line));
            }
            if !line.is_empty() {
                line.push(' ');
            }
            line.push_str(word);
        }
        lines.push(line);
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

fn pdf_text_bytes(text: &str) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '\u{2018}' | '\u{2019}' | '\u{02bc}' => bytes.push(b'\''),
            '\u{201c}' | '\u{201d}' => bytes.push(b'"'),
            '\u{2013}' | '\u{2014}' | '\u{2212}' => bytes.push(b'-'),
            '\u{2026}' => bytes.extend_from_slice(b"..."),
            '\u{2022}' => bytes.push(b'*'),
            '\u{00a0}' => bytes.push(b' '),
            _ => match ch as u32 {
                0x20..=0x7e | 0xa0..=0xff => bytes.push(ch as u8),
                _ => bytes.push(b'?'),
            },
        }
    }
    bytes
}

/// Strip the `/Info` dictionary and all XMP metadata streams from
/// `input`. Page content, fonts, images, and every other object pass
/// through untouched (though `lopdf` re-serializes the object/xref
/// tables from scratch, so the output isn't byte-identical beyond that).
pub fn clean_pdf(input: &[u8], opts: &PdfOptions) -> Result<(Vec<u8>, PdfCleanReport), PdfError> {
    check_size(input, opts)?;
    let mut document = load(input, opts)?;

    let info = info_findings(&document);
    if !info.is_empty() {
        let info_id = trailer_info_id(&document);
        document.trailer.remove(b"Info");
        if let Some(id) = info_id {
            document.delete_object(id);
        }
    }

    let xmp_ids = xmp_stream_ids(&document);
    for id in &xmp_ids {
        if let Some(Object::Stream(stream)) = document.objects.get_mut(id) {
            stream.set_plain_content(Vec::new());
        }
    }

    let mut stripped = Vec::new();
    if !info.is_empty() {
        stripped.push(format!("/Info dictionary ({} field(s))", info.len()));
    }
    if !xmp_ids.is_empty() {
        stripped.push(format!("{} XMP metadata stream(s)", xmp_ids.len()));
    }

    let mut out = Vec::new();
    document.save_to(&mut out)?;
    let bytes_out = out.len();

    Ok((
        out,
        PdfCleanReport {
            bytes_in: input.len(),
            bytes_out,
            stripped,
        },
    ))
}

fn check_size(input: &[u8], opts: &PdfOptions) -> Result<(), PdfError> {
    if input.len() as u64 > opts.max_input_bytes {
        return Err(PdfError::InputTooLarge {
            size: input.len(),
            max: opts.max_input_bytes,
        });
    }
    Ok(())
}

fn load(input: &[u8], opts: &PdfOptions) -> Result<Document, PdfError> {
    let load_opts = LoadOptions {
        max_decompressed_size: Some(opts.max_decompressed_stream_bytes),
        ..Default::default()
    };
    Ok(Document::load_mem_with_options(input, load_opts)?)
}

fn trailer_info_id(document: &Document) -> Option<ObjectId> {
    match document.trailer.get(b"Info").ok()? {
        Object::Reference(id) => Some(*id),
        _ => None,
    }
}

fn resolve_dict<'a>(document: &'a Document, obj: &'a Object) -> Option<&'a Dictionary> {
    match obj {
        Object::Dictionary(d) => Some(d),
        Object::Reference(id) => document.get_object(*id).ok().and_then(|o| o.as_dict().ok()),
        _ => None,
    }
}

fn info_findings(document: &Document) -> Vec<PdfFinding> {
    let Ok(info_obj) = document.trailer.get(b"Info") else {
        return Vec::new();
    };
    let Some(dict) = resolve_dict(document, info_obj) else {
        return Vec::new();
    };

    dict.iter()
        .filter_map(|(key, value)| {
            let bytes = value.as_str().ok()?;
            if bytes.is_empty() {
                return None;
            }
            Some(PdfFinding {
                location: "/Info".to_string(),
                field: String::from_utf8_lossy(key).to_string(),
                value: pdf_string_lossy(bytes),
            })
        })
        .collect()
}

fn xmp_stream_ids(document: &Document) -> Vec<ObjectId> {
    document
        .objects
        .iter()
        .filter_map(|(id, obj)| match obj {
            Object::Stream(s) if s.dict.has_type(b"Metadata") => Some(*id),
            _ => None,
        })
        .collect()
}

fn xmp_findings(document: &Document, opts: &PdfOptions) -> Vec<PdfFinding> {
    // Preview only — cap independently of the (potentially much larger)
    // load-time limit so a single huge XMP packet doesn't blow up an
    // inspect report.
    let preview_limit = opts.max_decompressed_stream_bytes.min(1 << 20);
    xmp_stream_ids(document)
        .into_iter()
        .filter_map(|id| {
            let Some(Object::Stream(stream)) = document.objects.get(&id) else {
                return None;
            };
            if stream.content.is_empty() {
                return None;
            }
            Some(PdfFinding {
                location: format!("XMP stream (object {} {})", id.0, id.1),
                field: "xmp".to_string(),
                value: stream_preview(stream, preview_limit),
            })
        })
        .collect()
}

const PREVIEW_MAX_CHARS: usize = 160;

fn stream_preview(stream: &Stream, max_bytes: usize) -> String {
    let bytes = stream
        .decompressed_content_with_limit(max_bytes)
        .unwrap_or_else(|_| stream.content.clone());
    let text = String::from_utf8_lossy(&bytes);
    let collapsed: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.chars().count() > PREVIEW_MAX_CHARS {
        let truncated: String = collapsed.chars().take(PREVIEW_MAX_CHARS).collect();
        format!("{truncated}…")
    } else {
        collapsed
    }
}

/// Best-effort human-readable decode of a PDF string. PDF text strings
/// are either PDFDocEncoding (a superset of Latin-1 for the common
/// range) or, when prefixed with the UTF-16BE byte-order mark, UTF-16BE.
fn pdf_string_lossy(bytes: &[u8]) -> String {
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        let units: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_be_bytes([c[0], c[1]]))
            .collect();
        String::from_utf16_lossy(&units)
    } else {
        bytes.iter().map(|&b| b as char).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::{Dictionary as Dict, Stream as PdfStream};

    fn build_test_pdf() -> Vec<u8> {
        let mut document = Document::with_version("1.7");

        let pages_id = document.new_object_id();
        let mut catalog = Dict::new();
        catalog.set("Type", Object::Name(b"Catalog".to_vec()));
        catalog.set("Pages", Object::Reference(pages_id));
        let catalog_id = document.add_object(catalog);

        let mut pages = Dict::new();
        pages.set("Type", Object::Name(b"Pages".to_vec()));
        pages.set("Kids", Object::Array(vec![]));
        pages.set("Count", Object::Integer(0));
        document.set_object(pages_id, pages);

        document.trailer.set("Root", Object::Reference(catalog_id));

        let mut info = Dict::new();
        info.set("Author", Object::string_literal("Jane Doe"));
        info.set("Producer", Object::string_literal("ChatGPT"));
        info.set("Title", Object::string_literal("A Report"));
        let info_id = document.add_object(info);
        document.trailer.set("Info", Object::Reference(info_id));

        let xmp_content = br#"<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description pdf:Producer="ChatGPT"/></rdf:RDF></x:xmpmeta>"#.to_vec();
        let mut xmp_dict = Dict::new();
        xmp_dict.set("Type", Object::Name(b"Metadata".to_vec()));
        xmp_dict.set("Subtype", Object::Name(b"XML".to_vec()));
        document.add_object(Object::Stream(PdfStream::new(xmp_dict, xmp_content)));

        let mut out = Vec::new();
        document.save_to(&mut out).expect("build test pdf");
        out
    }

    #[test]
    fn inspects_info_dict_and_xmp_without_modifying() {
        let bytes = build_test_pdf();
        let report = inspect_pdf(&bytes, &PdfOptions::default()).expect("inspect");
        assert!(!report.is_clean());
        assert!(report
            .findings
            .iter()
            .any(|f| f.location == "/Info" && f.field == "Author" && f.value == "Jane Doe"));
        assert!(report
            .findings
            .iter()
            .any(|f| f.location == "/Info" && f.field == "Producer" && f.value == "ChatGPT"));
        assert!(report
            .findings
            .iter()
            .any(|f| f.location.starts_with("XMP")));
    }

    #[test]
    fn strips_info_dict_and_xmp_content() {
        let bytes = build_test_pdf();
        let (cleaned, report) = clean_pdf(&bytes, &PdfOptions::default()).expect("clean");
        assert!(report.stripped.iter().any(|s| s.contains("/Info")));
        assert!(report.stripped.iter().any(|s| s.contains("XMP")));

        // Re-parse the cleaned output and confirm nothing identifying survives.
        let reinspected = inspect_pdf(&cleaned, &PdfOptions::default()).expect("reinspect");
        assert!(reinspected.is_clean(), "{:?}", reinspected.findings);

        let document = Document::load_mem(&cleaned).expect("reload cleaned pdf");
        assert!(document.trailer.get(b"Info").is_err());
    }

    #[test]
    fn appended_revision_keeps_original_pdf_pages_and_adds_searchable_revision() {
        let input = build_test_pdf();
        let original_pages = Document::load_mem(&input).unwrap().get_pages().len();
        let output = append_revision_pages(
            &input,
            "A revised academic sentence.",
            &PdfOptions::default(),
        )
        .unwrap();
        let output_doc = Document::load_mem(&output).unwrap();
        assert_eq!(output_doc.get_pages().len(), original_pages + 1);
        let extracted = extract_pdf_text(&output, &PdfOptions::default()).unwrap();
        assert!(extracted.contains("A revised academic sentence."));
    }

    #[test]
    fn rejects_oversized_input() {
        let bytes = build_test_pdf();
        let opts = PdfOptions {
            max_input_bytes: 1,
            ..Default::default()
        };
        let err = inspect_pdf(&bytes, &opts).unwrap_err();
        assert!(matches!(err, PdfError::InputTooLarge { .. }));
    }
}
