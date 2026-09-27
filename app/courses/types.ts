import type { CommandGuideId } from "../commands/catalog";

// Lesson ids are data-owned. Adding a lesson must not require editing the UI.
export type LessonId = string;

export type TerminalTask = {
  id: string;
  command: string;
  guideId: CommandGuideId;
  title: string;
  prompt: string;
  explanation: string;
  success: string;
};

export type ChallengeCheck =
  | { kind: "output-includes"; text: string }
  | { kind: "exists"; path: string; entryKind: "file" | "directory" }
  | { kind: "file-content"; path: string; text: string }
  | { kind: "mode"; path: string; mode: string }
  | { kind: "moved"; from: string; to: string };

export type ChallengeStep = {
  id: string;
  title: string;
  prompt: string;
  command: string;
  guideId: CommandGuideId;
  check: ChallengeCheck;
};

export type Challenge = {
  id: string;
  title: string;
  summary: string;
  steps: readonly [ChallengeStep, ...ChallengeStep[]];
  success: string;
};

export type Lesson = {
  id: LessonId;
  module: string;
  number: string;
  title: string;
  duration: string;
  summary: string;
  terminalTasks: readonly [TerminalTask, ...TerminalTask[]];
  challenge?: Challenge;
  takeaways: readonly [string, ...string[]];
  exercise: {
    question: string;
    options: readonly [
      { id: string; label: string },
      { id: string; label: string },
      ...{ id: string; label: string }[],
    ];
    correctOptionId: string;
    hint: string;
    success: string;
  };
  source: {
    label: string;
    href: string;
  };
};

export type CourseCatalogProblem = {
  lessonId: string;
  field: string;
  message: string;
};

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function addProblem(problems: CourseCatalogProblem[], lessonId: string, field: string, message: string): void {
  problems.push({ lessonId, field, message });
}

export function courseCatalogProblems(
  lessons: readonly Lesson[],
  guides: Readonly<Record<string, unknown>>,
): readonly CourseCatalogProblem[] {
  const problems: CourseCatalogProblem[] = [];
  const lessonIds = new Set<string>();
  const challengeIds = new Set<string>();

  for (const lesson of lessons) {
    if (lessonIds.has(lesson.id)) {
      addProblem(problems, lesson.id, "id", "must be unique");
    }

    lessonIds.add(lesson.id);

    for (const field of ["module", "number", "title", "duration", "summary"] as const) {
      if (isBlank(lesson[field])) {
        addProblem(problems, lesson.id, field, "must not be blank");
      }
    }

    const taskIds = new Set<string>();

    for (const task of lesson.terminalTasks) {
      if (taskIds.has(task.id)) {
        addProblem(problems, lesson.id, `terminalTasks.${task.id}`, "task ids must be unique within a lesson");
      }

      taskIds.add(task.id);

      if (!guides[task.guideId]) {
        addProblem(problems, lesson.id, `terminalTasks.${task.id}.guideId`, `unknown command guide: ${task.guideId}`);
      }
    }

    const optionIds = new Set<string>();

    for (const option of lesson.exercise.options) {
      if (optionIds.has(option.id)) {
        addProblem(problems, lesson.id, `exercise.options.${option.id}`, "option ids must be unique");
      }

      optionIds.add(option.id);
    }

    if (!optionIds.has(lesson.exercise.correctOptionId)) {
      addProblem(problems, lesson.id, "exercise.correctOptionId", "must reference an exercise option");
    }

    if (lesson.challenge) {
      if (challengeIds.has(lesson.challenge.id)) {
        addProblem(problems, lesson.id, "challenge.id", "challenge ids must be unique");
      }

      challengeIds.add(lesson.challenge.id);

      const stepIds = new Set<string>();

      for (const step of lesson.challenge.steps) {
        if (stepIds.has(step.id)) {
          addProblem(problems, lesson.id, `challenge.steps.${step.id}`, "step ids must be unique");
        }

        stepIds.add(step.id);

        if (!guides[step.guideId]) {
          addProblem(problems, lesson.id, `challenge.steps.${step.id}.guideId`, `unknown command guide: ${step.guideId}`);
        }
      }
    }

    if (isBlank(lesson.source.label) || isBlank(lesson.source.href)) {
      addProblem(problems, lesson.id, "source", "must contain a label and URL");
    }
  }

  return problems;
}

export function defineCourseCatalog<T extends readonly Lesson[]>(
  lessons: T,
  guides: Readonly<Record<string, unknown>>,
): T {
  const problems = courseCatalogProblems(lessons, guides);

  if (problems.length > 0) {
    const details = problems.map((problem) => `${problem.lessonId}.${problem.field}: ${problem.message}`).join("\n");
    throw new Error(`Invalid course catalog:\n${details}`);
  }

  return lessons;
}
