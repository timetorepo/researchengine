# Optional local typography

All families here are SIL Open Font License 1.1. Notices are included alongside
the binaries. No remote requests or startup font preloads. CSS is in
`src/styles/editorial-fonts.css`. User's existing UI/monospace choices are not
migrated. Geist Rounded is a new optional UI choice; Newsreader applies only to
the optional Home heading; Lilex applies to rendered code/monospace labels, not
embedded-editor preferences. Lilex ligatures require explicit opt-in.

Geist Rounded source:
https://github.com/mishanaer/geist-rounded/tree/3e41554b9f24bb358fc2ac26a52a3a2fc4df138f
`webfonts/GeistRounded[wght].woff2` and `OFL.txt`. Licence whitespace was normalized
in the original comparison; text unchanged. Binary SHA256:
`7ed429cf57106465eadbf1d8a6d4a73d975ff64f892d1e3f93f392f80a20c9a7`.

Newsreader and Lilex copied from exactly pinned Fontsource Variable 5.3.0 packages
in `tools/design-comparison/package-lock.json` (npm tarball integrity retained
there). Newsreader normal/italic and Lilex normal WOFF2 unicode subsets only.
No font modifications. The package licence files are retained as
`newsreader-OFL.txt` and `lilex-OFL.txt`.

Upstream projects:
https://github.com/productiontype/Newsreader
https://github.com/mishamyrt/Lilex

`sha256.txt` lists every local font binary, paths relative to this directory.
These fonts are optional references from the approved comparison, not a change
to default branding, font density or code-ligature behaviour.
