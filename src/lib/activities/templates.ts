import type { Activity, ParadigmGridPayload } from "@/types/activity";

/** 1st declension endings (classical; macrons optional in accept lists). */
const FIRST_DECLENSION: Record<string, string[]> = {
  "nom.sg": ["a", "ā"],
  "gen.sg": ["ae", "ae"],
  "dat.sg": ["ae", "ae"],
  "acc.sg": ["am", "am"],
  "abl.sg": ["a", "ā"],
  "nom.pl": ["ae", "ae"],
  "gen.pl": ["arum", "ārum"],
  "dat.pl": ["is", "īs"],
  "acc.pl": ["as", "ās"],
  "abl.pl": ["is", "īs"],
};

const SUM_PRESENT: Record<string, string[]> = {
  "1.sg": ["sum"],
  "2.sg": ["es", "es"],
  "3.sg": ["est"],
  "1.pl": ["sumus"],
  "2.pl": ["estis"],
  "3.pl": ["sunt"],
};

const FIRST_CONJ_PRESENT_ENDINGS: Record<string, string[]> = {
  "1.sg": ["o", "ō"],
  "2.sg": ["as", "ās"],
  "3.sg": ["at"],
  "1.pl": ["amus", "āmus"],
  "2.pl": ["atis", "ātis"],
  "3.pl": ["ant"],
};

function fullFormsFromStem(
  stem: string,
  endings: Record<string, string[]>
): Record<string, string[]> {
  const cells: Record<string, string[]> = {};
  for (const [id, ends] of Object.entries(endings)) {
    cells[id] = ends.map((e) => stem + e);
  }
  return cells;
}

export function buildFirstDeclensionGrid(opts: {
  id: string;
  lemma: string;
  stem: string;
  source?: "seed" | "generated";
  required?: boolean;
}): Activity {
  const cells = fullFormsFromStem(opts.stem, FIRST_DECLENSION);
  // Nominative singular is the lemma itself (stem + a)
  cells["nom.sg"] = [opts.lemma, opts.stem + "a", opts.stem + "ā"];

  const payload: ParadigmGridPayload = {
    kind: "noun",
    lemma: opts.lemma,
    stem: opts.stem,
    mode: "full_form",
    pattern: "first_declension",
    labels: {
      rows: ["nom", "gen", "dat", "acc", "abl"],
      cols: ["sg", "pl"],
    },
    cells,
  };

  return {
    id: opts.id,
    type: "paradigm_grid",
    source: opts.source ?? "seed",
    prompt: `Decline ${opts.lemma} (1st declension) in all cases, singular and plural.`,
    targets: ["1st declension"],
    required: opts.required ?? true,
    payload,
  };
}

export function buildSumPresentGrid(opts: {
  id: string;
  source?: "seed" | "generated";
}): Activity {
  return {
    id: opts.id,
    type: "paradigm_grid",
    source: opts.source ?? "seed",
    prompt: "Conjugate sum in the present indicative.",
    targets: ["sum present"],
    required: true,
    payload: {
      kind: "verb",
      lemma: "sum",
      mode: "full_form",
      pattern: "sum_present",
      labels: {
        rows: ["1", "2", "3"],
        cols: ["sg", "pl"],
      },
      cells: SUM_PRESENT,
    },
  };
}

export function buildFirstConjPresentGrid(opts: {
  id: string;
  lemma: string;
  stem: string;
  source?: "seed" | "generated";
}): Activity {
  const cells = fullFormsFromStem(opts.stem, FIRST_CONJ_PRESENT_ENDINGS);
  cells["1.sg"] = [opts.lemma, opts.stem + "o", opts.stem + "ō"];

  return {
    id: opts.id,
    type: "paradigm_grid",
    source: opts.source ?? "seed",
    prompt: `Conjugate ${opts.lemma} in the present indicative active.`,
    targets: ["1st conjugation present"],
    required: true,
    payload: {
      kind: "verb",
      lemma: opts.lemma,
      stem: opts.stem,
      mode: "full_form",
      pattern: "first_conj_present",
      labels: {
        rows: ["1", "2", "3"],
        cols: ["sg", "pl"],
      },
      cells,
    },
  };
}

/** Expand a generated stub that only has pattern + lemma + stem. */
export function expandFromPattern(
  activity: Activity
): Activity {
  if (activity.type !== "paradigm_grid") return activity;
  const p = activity.payload as ParadigmGridPayload;
  if (p.cells && Object.keys(p.cells).length > 0) return activity;

  if (p.pattern === "first_declension" && p.stem) {
    return buildFirstDeclensionGrid({
      id: activity.id,
      lemma: p.lemma,
      stem: p.stem,
      source: activity.source,
      required: activity.required,
    });
  }
  if (p.pattern === "sum_present") {
    return buildSumPresentGrid({ id: activity.id, source: activity.source });
  }
  if (p.pattern === "first_conj_present" && p.stem) {
    return buildFirstConjPresentGrid({
      id: activity.id,
      lemma: p.lemma,
      stem: p.stem,
      source: activity.source,
    });
  }
  return activity;
}
