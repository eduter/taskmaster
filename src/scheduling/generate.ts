import { RRule } from "rrule";
import { getActiveGenerators, updateGenerator } from "../db/generators.ts";
import { createTask } from "../db/tasks.ts";
import { getLogicalDay, addDays } from "../utils/logicalDay.ts";

async function runGenerators(today: string = getLogicalDay()): Promise<number> {
  const generators = await getActiveGenerators();
  let created = 0;

  for (const gen of generators) {
    const startDate = gen.lastGeneratedDate ? addDays(gen.lastGeneratedDate, 1) : today;
    if (startDate > today) continue;

    let rule: RRule;
    try {
      if (gen.rrule.includes("DTSTART:")) {
        rule = RRule.fromString(gen.rrule) as RRule;
      } else {
        throw new Error("Fallback");
      }
    } catch {
      const options = RRule.parseString(gen.rrule);
      if (!options.dtstart) {
        options.dtstart = new Date(gen.createdAt);
      }
      rule = new RRule(options);
    }
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(today + "T23:59:59");
    const occurrences = rule.between(start, end, true);

    for (const occ of occurrences) {
      const dateStr = toISODate(occ);
      for (const tmpl of gen.templates) {
        await createTask({
          summary: tmpl.summary,
          description: tmpl.description,
          labels: tmpl.labels,
          date: dateStr,
          generatorId: gen.id,
        });
        created++;
      }
    }

    await updateGenerator(gen.id, { lastGeneratedDate: today });
  }

  return created;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export { runGenerators };
