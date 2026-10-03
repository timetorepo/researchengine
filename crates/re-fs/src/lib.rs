//! re-fs — the document pipeline (brief §3.1): import, PDF text + geometry,
//! OCR on demand, page-at-a-time streaming into the reader. Owned by R4; this
//! stub only fixes the module boundary and the extract kinds the mobile app
//! must match with the desktop (`frontend/src/lib/documents/extract.ts` handles
//! .pdf via pdf.js and .docx via mammoth in the browser; the heavy path moves
//! here so the WebView never parses a 300-page PDF).

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DocKind { Pdf, Docx, Markdown, Text }

pub fn kind_of(name: &str) -> Option<DocKind> {
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".pdf") { Some(DocKind::Pdf) }
    else if lower.ends_with(".docx") { Some(DocKind::Docx) }
    else if lower.ends_with(".md") { Some(DocKind::Markdown) }
    else if lower.ends_with(".txt") { Some(DocKind::Text) }
    else { None }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kinds_match_the_desktop_extractor() {
        assert_eq!(kind_of("Paper.PDF"), Some(DocKind::Pdf));
        assert_eq!(kind_of("notes.docx"), Some(DocKind::Docx));
        assert_eq!(kind_of("readme.md"), Some(DocKind::Markdown));
        assert_eq!(kind_of("log.txt"), Some(DocKind::Text));
        assert_eq!(kind_of("mystery.bin"), None); // unsupported = honest state, not silence
    }
}
