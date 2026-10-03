//! re-models — on-device inference (brief §4.2). R1 ships the size classes and
//! the refusal rule (a model that cannot fit is *refused with a sentence*, never
//! silently swapped); the Metal/NNAPI inference path arrives in R5.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SizeClass {
    /// ~1-2 B params, Q4, ~1 GB: summaries, rewrites, short quizzes, classifying.
    Quick,
    /// ~3-4 B, Q4, ~2-3 GB: default for offline answering.
    Balanced,
    /// ~7-8 B, Q4, ~4-5 GB: only on devices with headroom, user-started jobs.
    Deep,
}

/// Approximate resident footprint in MB used for the pre-flight check
/// (weights + KV cache; the real figure comes from the engine in R5 — this
/// constant exists so the *refusal* is decidable before inference does).
pub fn class_footprint_mb(class: SizeClass) -> u32 {
    match class {
        SizeClass::Quick => 1024,
        SizeClass::Balanced => 2560,
        SizeClass::Deep => 4608,
    }
}

/// Embedding model for library search: always installed, tiny, not a class.
pub const EMBEDDING_FOOTPRINT_MB: u32 = 90;

#[derive(Debug, PartialEq, Eq)]
pub enum Fit {
    Fits,
    TooBig { need_mb: u32, available_mb: u32 },
}

/// The brief's rule in one function: refuse loudly, never down-swap silently.
pub fn fits(class: SizeClass, device_available_mb: u32) -> Fit {
    let need = class_footprint_mb(class) + EMBEDDING_FOOTPRINT_MB;
    if need <= device_available_mb { Fit::Fits } else { Fit::TooBig { need_mb: need, available_mb: device_available_mb } }
}

/// Model downloads: resumable, digest-verified, cellular-paused by default,
/// per-model deletable (brief §4.2 policy). R1 fixes the policy shape.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DownloadPolicy {
    pub pause_on_cellular: bool,
    pub verify_digest: bool,
}

impl Default for DownloadPolicy {
    fn default() -> Self { Self { pause_on_cellular: true, verify_digest: true } }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn balanced_refuses_a_3gb_phone_with_a_sentence_worth_of_numbers() {
        match fits(SizeClass::Balanced, 3000) {
            Fit::TooBig { need_mb, available_mb } => {
                assert_eq!(available_mb, 3000);
                assert!(need_mb > available_mb);
            }
            Fit::Fits => panic!("must refuse: silent swap is a spec violation"),
        }
    }

    #[test]
    fn quick_fits_the_device_floor_budget() {
        // device floor: 4 GB class; ~1.1 GB need must fit in a 2 GB app budget
        assert_eq!(fits(SizeClass::Quick, 2048), Fit::Fits);
    }

    #[test]
    fn deep_is_the_only_flagship_class_and_never_the_default() {
        assert!(class_footprint_mb(SizeClass::Deep) > class_footprint_mb(SizeClass::Balanced));
        assert_eq!(fits(SizeClass::Deep, 4000), Fit::TooBig { need_mb: 4608 + 90, available_mb: 4000 });
    }

    #[test]
    fn download_defaults_are_conservative() {
        let p = DownloadPolicy::default();
        assert!(p.pause_on_cellular && p.verify_digest);
    }
}
