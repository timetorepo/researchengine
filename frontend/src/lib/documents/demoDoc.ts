// The bundled Read & Quiz demo: a genuine ~1,650-word primer on the structure
// of DNA, plus pre-computed highlights, a cached study rewrite, and a
// hand-tuned 5-question quiz. Runs fully offline so new users can experience
// the product before configuring BYOK.

export interface DemoHighlight {
  /** Sentence fragment to locate (exact substring match). */
  match: string
  tier: 'definition' | 'fact' | 'concept'
  reason: string
}

export const DEMO_DOC_ID = 'demo-dna'

export const DEMO_DOC_TEXT = `# The Structure of DNA — A Brief History and Overview

Deoxyribonucleic acid, universally abbreviated as DNA, is the molecule that carries the hereditary instructions used in the growth, development, functioning, and reproduction of all known living organisms and many viruses. Alongside proteins, lipids, and complex carbohydrates, nucleic acids are one of the four major types of macromolecules essential for life.

## The discovery of the double helix

The story of DNA's structure is one of the most celebrated episodes in twentieth-century science. In 1869, the Swiss physician Friedrich Miescher isolated a phosphorus-rich substance from the nuclei of white blood cells and named it "nuclein." By the 1940s, a series of careful experiments had established that DNA, not protein, was the molecule of heredity. In 1944, Oswald Avery, Colin MacLeod, and Maclyn McCarty showed that DNA alone could transform harmless bacteria into a virulent strain, a result that convinced most biologists the gene was made of DNA.

The decisive structural insight arrived in 1953. James Watson and Francis Crick, working at the Cavendish Laboratory in Cambridge, proposed the double-helix model of DNA in a one-page paper in Nature. Their model depended critically on X-ray diffraction data — most famously Photograph 51 — produced by Rosalind Franklin and Raymond Gosling at King's College London, and on Chargaff's rules, which state that in any organism the amount of adenine equals thymine and the amount of guanine equals cytosine. Watson, Crick, and Maurice Wilkins received the Nobel Prize in Physiology or Medicine in 1962 for the discovery; Franklin had died in 1958, and the prize is not awarded posthumously.

## The chemistry of the molecule

DNA is a polymer built from repeating units called nucleotides. Each nucleotide consists of three parts: a phosphate group, a five-carbon sugar called deoxyribose, and one of four nitrogenous bases. The four bases are adenine (A), thymine (T), guanine (G), and cytosine (C). The sugar and phosphate groups alternate to form the structural backbone of each strand, while the bases point inward.

Two such strands wind around a common axis to form the double helix. The strands run in opposite directions — one runs 5-prime to 3-prime and the other 3-prime to 5-prime — a relationship described as antiparallel. The bases on one strand form hydrogen bonds with bases on the other: adenine pairs with thymine through two hydrogen bonds, and guanine pairs with cytosine through three hydrogen bonds. This specific pairing, called complementary base pairing, is the chemical foundation of heredity, because each strand carries enough information to reconstruct the other.

The helix completes one full turn approximately every 10.5 base pairs, rising about 3.4 nanometers per turn, with a diameter of roughly 2 nanometers. A human genome contains about 3.1 billion base pairs per haploid set, which means that the DNA in a single human cell, stretched end to end, would measure close to two meters — packed into a nucleus only a few micrometers across.

## From sequence to function

The information in DNA is read through two central processes. In transcription, the enzyme RNA polymerase copies a gene's DNA sequence into messenger RNA. In translation, the ribosome reads the messenger RNA in groups of three bases — codons — each of which specifies one amino acid. The sequence of codons therefore determines the sequence of amino acids in a protein, and the protein's amino acid sequence determines its three-dimensional shape and function. This flow of information, from DNA to RNA to protein, is known as the central dogma of molecular biology.

Not all DNA encodes proteins. In humans, protein-coding sequences account for only about 1 to 2 percent of the genome. The remainder includes regulatory sequences that control when and where genes are active, structural elements such as centromeres and telomeres, and large amounts of repetitive and transposable DNA whose functions are still being worked out. Mutations — changes in the base sequence — are the raw material of evolution; most are neutral, some are harmful, and occasionally one confers an advantage that natural selection preserves.

## Why the structure matters

The double-helix structure immediately suggested how genetic information is copied. Because the strands are complementary, each can serve as a template for the synthesis of a new partner strand. The enzyme DNA helicase unwinds the helix, and DNA polymerase builds new strands base by base, proofreading as it goes. The error rate after proofreading is astonishingly low — roughly one mistake per billion base pairs copied.

The same complementarity underpins modern biotechnology. Polymerase chain reaction, invented by Kary Mullis in 1983, exploits the fact that heating separates the two strands and cooling allows short primers to re-anneal, enabling a single DNA molecule to be amplified into billions of copies in a few hours. CRISPR-based gene editing, adapted from a bacterial immune system characterized by Emmanuelle Charpentier and Jennifer Doudna, uses a guide RNA whose sequence is complementary to a target gene to direct a cutting enzyme to a precise genomic address. Both techniques rest on the pairing rules Watson and Crick wrote down in 1953.

Understanding DNA's structure also transformed medicine and forensics. DNA sequencing now detects disease-causing mutations, guides cancer therapy, and identifies individuals from trace biological samples. The cost of sequencing a whole human genome has fallen from roughly one hundred million dollars in 2001 to under one thousand dollars today, an improvement that outpaced Moore's law for more than a decade.

## Replication in detail

DNA replication proceeds at specialized junctions called replication forks. Helicase pries the two strands apart, single-strand binding proteins hold them open, and primase lays down short RNA primers that give DNA polymerase a starting point. Because polymerase can only extend a strand in the 5-prime to 3-prime direction, one new strand — the leading strand — is synthesized continuously, while the other, the lagging strand, is built in short Okazaki fragments that are later joined by DNA ligase. The whole process is semi-conservative: each daughter molecule contains one original strand and one newly made strand, a prediction Watson and Crick made in 1953 and that Meselson and Stahl confirmed with an elegant density-labeling experiment in 1958.

Human cells copy their genomes in about eight hours, synthesizing roughly fifty nucleotides per second at each fork and firing thousands of forks in parallel. Checkpoint proteins monitor the process; when damage is detected, replication pauses so repair enzymes can act. Defects in these repair systems underlie several inherited cancer syndromes, including xeroderma pigmentosum and some forms of hereditary colorectal cancer, which is one reason the fidelity of replication is a medical as well as a biochemical question.

## Packaging and regulation

Two meters of DNA must fit inside a nucleus a few micrometers wide, and it must remain accessible to the machinery that reads it. The solution is hierarchical packaging. DNA wraps around histone proteins to form nucleosomes, often described as beads on a string; nucleosomes coil into chromatin fibers, which fold further into the compact chromosomes visible during cell division. The tightness of this packaging regulates gene activity: tightly packed heterochromatin is generally silent, while open euchromatin is available for transcription.

Chemical marks added to DNA or histones — collectively the epigenome — tune this accessibility without changing the underlying sequence. Methylation of cytosine bases typically represses gene expression, while acetylation of histones usually loosens chromatin and promotes it. Epigenetic patterns are copied when cells divide, which is how a liver cell stays a liver cell even though it carries the same genome as a neuron. Some epigenetic marks respond to environment and age, and their disruption is implicated in cancer and developmental disorders.

## Sequencing: reading the code

If complementarity lets cells copy DNA, sequencing is how scientists read it. The first practical method, developed by Frederick Sanger in 1977, uses chain-terminating nucleotides: when one of these modified bases is incorporated during copying, synthesis stops, producing fragments of every possible length that can be separated to reveal the sequence. Sanger sequencing powered the Human Genome Project, the thirteen-year international effort whose working draft was published in 2001.

Next-generation sequencing changed the economics entirely. Instead of reading one molecule at a time, modern platforms read hundreds of millions of short fragments in parallel and reassemble them computationally. Whole genomes that once cost tens of millions of dollars now cost less than a thousand, and turnaround has fallen from years to hours. Clinical laboratories use the technology to screen newborns for rare disorders, to detect tumor DNA circulating in a patient's blood, and to track viral evolution during outbreaks — as it did, at scale, during the sequencing of SARS-CoV-2 variants.

The readout of a sequencer is nothing more than a string of A, T, G, and C letters, yet interpreting that string has become a discipline of its own. Aligning fragments to a reference genome, calling variants, and distinguishing a disease-causing mutation from harmless variation each require statistical care. The central lesson transfers across all of genomics: the chemistry of base pairing is simple; the inference drawn from it is where the real science lives.

## Reading this text like a researcher

Notice how each section links structure to consequence: complementarity explains copying, antiparallel strands explain the asymmetry of the replication fork, and packaging explains regulation. When you study any molecular topic, look for these structure-to-function chains and treat numeric facts — 10.5 base pairs per turn, 3.1 billion base pairs per genome, one error per billion copied — as anchors for recall. The quiz generated from this document is designed to test exactly those anchors.

## Summary

DNA is a double-stranded, antiparallel polymer whose four bases pair specifically — A with T, G with C — through hydrogen bonds. That pairing explains both the stability of heredity and its capacity for faithful copying. Since 1953, the structural insight has powered an unbroken chain of applications, from PCR to gene editing to affordable genome sequencing, and it remains the conceptual center of modern biology.`

export const DEMO_HIGHLIGHTS: DemoHighlight[] = [
  { match: 'Deoxyribonucleic acid, universally abbreviated as DNA, is the molecule that carries the hereditary instructions', tier: 'definition', reason: 'Defines the central concept of the entire document.' },
  { match: 'Each nucleotide consists of three parts: a phosphate group, a five-carbon sugar called deoxyribose, and one of four nitrogenous bases', tier: 'definition', reason: 'Defines the repeating structural unit of DNA.' },
  { match: 'The four bases are adenine (A), thymine (T), guanine (G), and cytosine (C)', tier: 'fact', reason: 'Core chemical fact referenced throughout.' },
  { match: 'adenine pairs with thymine through two hydrogen bonds, and guanine pairs with cytosine through three hydrogen bonds', tier: 'concept', reason: 'Complementary base pairing is the mechanism behind heredity — the key concept of the piece.' },
  { match: 'a relationship described as antiparallel', tier: 'definition', reason: 'Defines the geometric relationship between the two strands.' },
  { match: 'The helix completes one full turn approximately every 10.5 base pairs, rising about 3.4 nanometers per turn, with a diameter of roughly 2 nanometers', tier: 'fact', reason: 'Quantitative facts anchoring the helix geometry.' },
  { match: 'A human genome contains about 3.1 billion base pairs per haploid set', tier: 'fact', reason: 'Key numeric scale of the human genome.' },
  { match: 'the enzyme DNA helicase unwinds the helix, and DNA polymerase builds new strands base by base', tier: 'concept', reason: 'Causal mechanism of replication.' },
  { match: 'roughly one mistake per billion base pairs copied', tier: 'fact', reason: 'Quantifies replication fidelity.' },
  { match: 'This flow of information, from DNA to RNA to protein, is known as the central dogma of molecular biology', tier: 'definition', reason: 'Defines the central dogma, a named foundational principle.' },
  { match: 'protein-coding sequences account for only about 1 to 2 percent of the genome', tier: 'fact', reason: 'Surprising numeric fact about genome composition.' },
  { match: 'Polymerase chain reaction, invented by Kary Mullis in 1983', tier: 'fact', reason: 'Named entity + date: origin of PCR.' },
  { match: 'heating separates the two strands and cooling allows short primers to re-anneal', tier: 'concept', reason: 'Causal mechanism that makes PCR work.' },
  { match: 'Watson, Crick, and Maurice Wilkins received the Nobel Prize in Physiology or Medicine in 1962', tier: 'fact', reason: 'Named entities + date in the historical record.' },
  { match: 'each daughter molecule contains one original strand and one newly made strand', tier: 'concept', reason: 'Semi-conservative replication — the core mechanism of copying.' },
  { match: 'Meselson and Stahl confirmed with an elegant density-labeling experiment in 1958', tier: 'fact', reason: 'Named experiment + date verifying semi-conservative replication.' },
  { match: 'Chemical marks added to DNA or histones — collectively the epigenome', tier: 'definition', reason: 'Defines the epigenome, a key regulatory concept.' },
  { match: 'Methylation of cytosine bases typically represses gene expression', tier: 'concept', reason: 'Causal rule linking an epigenetic mark to gene activity.' },
  { match: 'The first practical method, developed by Frederick Sanger in 1977', tier: 'fact', reason: 'Named entity + date: origin of Sanger sequencing.' },
  { match: 'modern platforms read hundreds of millions of short fragments in parallel and reassemble them computationally', tier: 'concept', reason: 'The mechanism that makes next-generation sequencing cheap.' },
]

/** Cached study rewrite so the demo runs fully offline. */
export const DEMO_REWRITE = `# DNA Structure — Study Version

**Definition.** DNA (deoxyribonucleic acid) is the molecule that stores hereditary instructions in all known living organisms and many viruses.

## 1. Discovery timeline
- **1869** — Friedrich Miescher isolates "nuclein" from white blood cell nuclei.
- **1944** — Avery, MacLeod, and McCarty prove DNA alone carries heredity.
- **1953** — Watson and Crick publish the double-helix model, using Franklin and Gosling's X-ray data (Photograph 51) and Chargaff's rules (A = T, G = C).
- **1962** — Nobel Prize to Watson, Crick, and Wilkins (Franklin died in 1958; the prize is not awarded posthumously).

## 2. Chemical structure
DNA is a polymer of **nucleotides**. Each nucleotide = **phosphate + deoxyribose sugar + one base**. The four bases: **adenine (A), thymine (T), guanine (G), cytosine (C)**.

- Backbone: alternating sugar and phosphate; bases point inward.
- Two strands wind into a **double helix** and run in opposite directions (**antiparallel**: one 5'→3', the other 3'→5').
- **Base pairing rule:** A pairs with T via **2 hydrogen bonds**; G pairs with C via **3 hydrogen bonds**. Complementarity means each strand can reconstruct the other.

## 3. Key numbers to remember
| Property | Value |
|---|---|
| Base pairs per helix turn | ~10.5 |
| Rise per turn | ~3.4 nm |
| Helix diameter | ~2 nm |
| Human haploid genome | ~3.1 billion bp |
| DNA length per human cell | ~2 m |
| Protein-coding share of genome | ~1–2% |
| Replication error rate (post-proofreading) | ~1 per 10⁹ bp |

## 4. From sequence to function
**Central dogma:** DNA → RNA → protein.
1. **Transcription** — RNA polymerase copies a gene into messenger RNA.
2. **Translation** — the ribosome reads codons (3-base groups); each codon specifies one amino acid.

## 5. Why structure matters
- **Replication:** helicase unwinds; DNA polymerase copies each strand using complementarity and proofreads.
- **PCR (Mullis, 1983):** heat separates strands; cooling lets primers re-anneal; cycling amplifies DNA billions-fold.
- **CRISPR (Charpentier & Doudna):** a guide RNA complementary to a target gene directs a cutting enzyme to a precise address.
- **Sequencing cost:** from ~$100M (2001) to <$1,000 today — outpacing Moore's law for over a decade.

## 6. One-sentence summary
DNA's antiparallel double helix, held together by specific A–T and G–C hydrogen bonding, explains both the stability of heredity and its faithful copying — the insight behind PCR, gene editing, and modern genomics.`

export interface DemoQuizQuestion {
  id: string
  type: 'mc' | 'tf' | 'short' | 'fill'
  prompt: string
  options?: string[]
  answer: string
  explanation: string
  source: string // exact paragraph for "see in source"
}

export const DEMO_QUIZ: DemoQuizQuestion[] = [
  {
    id: 'dq1', type: 'mc',
    prompt: 'How many hydrogen bonds hold a guanine–cytosine pair together?',
    options: ['One', 'Two', 'Three', 'Four'],
    answer: 'Three',
    explanation: 'G pairs with C through three hydrogen bonds; A pairs with T through two. The extra bond makes GC-rich regions more thermally stable.',
    source: 'adenine pairs with thymine through two hydrogen bonds, and guanine pairs with cytosine through three hydrogen bonds',
  },
  {
    id: 'dq2', type: 'tf',
    prompt: 'True or false: the two strands of DNA run in the same direction.',
    answer: 'False',
    explanation: 'The strands are antiparallel — one runs 5′ to 3′ and the other 3′ to 5′.',
    source: 'a relationship described as antiparallel',
  },
  {
    id: 'dq3', type: 'fill',
    prompt: 'The flow of information from DNA to RNA to protein is known as the central _____ of molecular biology.',
    answer: 'dogma',
    explanation: 'The central dogma describes DNA → RNA → protein information flow.',
    source: 'This flow of information, from DNA to RNA to protein, is known as the central dogma of molecular biology',
  },
  {
    id: 'dq4', type: 'mc',
    prompt: 'Which experimental result established that DNA — not protein — is the molecule of heredity?',
    options: [
      'Miescher\'s isolation of nuclein in 1869',
      'Avery, MacLeod, and McCarty\'s bacterial transformation (1944)',
      'Franklin\'s Photograph 51 (1952)',
      'Mullis\'s invention of PCR (1983)',
    ],
    answer: 'Avery, MacLeod, and McCarty\'s bacterial transformation (1944)',
    explanation: 'The 1944 experiment showed DNA alone could transform bacteria, convincing biologists the gene was made of DNA. Photograph 51 informed structure, not chemical identity.',
    source: 'In 1944, Oswald Avery, Colin MacLeod, and Maclyn McCarty showed that DNA alone could transform harmless bacteria into a virulent strain',
  },
  {
    id: 'dq5', type: 'short',
    prompt: 'In one or two sentences: why does complementary base pairing matter for heredity?',
    answer: 'Because each strand carries enough information to reconstruct its partner, complementarity lets DNA copy itself faithfully during replication.',
    explanation: 'Specific A–T and G–C pairing means each strand is a template for the other — the chemical basis of faithful copying.',
    source: 'This specific pairing, called complementary base pairing, is the chemical foundation of heredity, because each strand carries enough information to reconstruct the other',
  },
]
