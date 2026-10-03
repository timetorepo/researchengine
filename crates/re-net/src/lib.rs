//! re-net — the companion protocol (brief §4.3). R1 defines the wire types and
//! the scope rules so the mobile UI can render truthful unpaired/paired states
//! before the transport lands in R6. No networking here yet; this compiles
//! dependency-free on purpose.

/// Scopes granted individually at pairing time (brief §4.3 list).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scope {
    LibraryRead,
    LibraryWrite,
    SearchRun,
    AgentsRun,
    JobsRun,
    ModelsProxy,
    CodingRead,
    /// Requires a second confirmation, within 60 seconds, for every execution.
    CodingExec,
}

pub const EXEC_CONFIRM_WINDOW_SECS: u64 = 60;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceRecord {
    pub device_id: String,
    pub name: String,
    /// "ios" | "android" — matches the mobile shell, kept as a string so the
    /// desktop pairing UI can show unknown future platforms gracefully.
    pub platform: String,
    pub scopes: Vec<Scope>,
}

/// `re://pair` QR payload: host, port, SHA-256 of the server's SPKI, and a
/// single-use secret with a 3-minute expiry (brief §4.3 pairing step 1).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PairOffer {
    pub host: String,
    pub port: u16,
    pub spki_sha256_hex: String,
    pub secret: String,
    pub expires_in_secs: u64,
}

pub const PAIR_SECRET_TTL_SECS: u64 = 180;

impl PairOffer {
    pub fn to_uri(&self) -> String {
        format!(
            "re://pair?host={}&port={}&pin={}&secret={}&ttl={}",
            self.host, self.port, self.spki_sha256_hex, self.secret, self.expires_in_secs
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pair_uri_rounds_trip_shape() {
        let offer = PairOffer {
            host: "192.168.1.40".into(),
            port: 3847,
            spki_sha256_hex: "ab12".into(),
            secret: "s3cr3t".into(),
            expires_in_secs: PAIR_SECRET_TTL_SECS,
        };
        let uri = offer.to_uri();
        assert!(uri.starts_with("re://pair?"));
        assert!(uri.contains("port=3847"));
        assert!(uri.contains("ttl=180"));
    }

    #[test]
    fn coding_exec_is_a_scope_like_others_but_gated() {
        // The gate lives in the desktop companion server (R6); re-net's job is
        // that the scope *exists* as data, so mobile can render its consent row.
        let rec = DeviceRecord {
            device_id: "d1".into(),
            name: "Pixel".into(),
            platform: "android".into(),
            scopes: vec![Scope::LibraryRead, Scope::CodingExec],
        };
        assert_eq!(rec.scopes.len(), 2);
        assert_eq!(EXEC_CONFIRM_WINDOW_SECS, 60);
    }
}
