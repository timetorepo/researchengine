//! re-core — the local heart of Research Engine mobile (brief §3.1).
//!
//! Owned here, not in the WebView: the library database, the local search
//! index, the job queue, frame/latency governance, and the security boundary.
//! Modules land round by round; everything in this file's R1 scope is pure
//! logic that is unit-tested without a device.
//!
//! R1: schema (shared SQL with the desktop), frame budget governor.
//! R2: rusqlite-backed library + fts5 index + jobs persistence.
//! R3: provider transport + pacing governor hookups.
//! R5: model manager bindings (via re-models).

pub mod frame_budget;
pub mod jobs;

/// The shared library schema. The SQL is kept in `src/schema/schema_v1.sql`
/// and MUST equal the desktop backend's MIGRATION template
/// (`backend/src/db/index.ts`); a drift test in
/// `packages/tokens/test/tokens.test.mts` enforces it.
pub mod schema {
    pub const SCHEMA_V1_SQL: &str = include_str!("schema/schema_v1.sql");

    /// Number of statements (guards accidental truncation of the SQL file).
    pub const STATEMENTS_V1: usize = 5;

    pub fn v1_statements() -> impl Iterator<Item = &'static str> {
        SCHEMA_V1_SQL
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty() && !l.starts_with("--"))
    }
}


pub use frame_budget::{Governor, Quality, Refresh, Sampler};

/// Library version marker written next to the DB; bumped when schema_v*.sql
/// steps ship. Kept as a string to match the desktop `config.json` style.
pub const SCHEMA_VERSION: u32 = 1;

#[cfg(test)]
mod schema_tests {
    use super::schema;

    #[test]
    fn schema_v1_ships_the_expected_statement_count() {
        assert_eq!(schema::v1_statements().count(), schema::STATEMENTS_V1);
    }

    #[test]
    fn every_statement_is_idempotent_create_if_not_exists() {
        for stmt in schema::v1_statements() {
            assert!(stmt.starts_with("CREATE TABLE IF NOT EXISTS "), "not idempotent: {stmt}");
            assert!(stmt.ends_with(';'), "not terminated: {stmt}");
        }
    }
}

