"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  explainCommand,
  type CommandExplanation,
} from "./command-explainer";
import { COMMAND_GUIDES } from "./commands";
import { LESSONS, type ChallengeStep, type Lesson, type LessonId, type TerminalTask } from "./courses";
import {
  createInitialTerminalSession,
  parseTerminalSession,
  runTerminalCommand,
  type TerminalLine,
  type TerminalSession,
} from "./terminal";
import {
  dueReviewCount,
  recordLearningDay,
  recordTaskAttempt,
  type AchievementId,
  type ReviewRecord,
  type StreakState,
} from "./learning";

type IconName =
  | "arrow"
  | "book"
  | "check"
  | "clock"
  | "copy"
  | "database"
  | "external"
  | "lock"
  | "refresh"
  | "search"
  | "shield"
  | "spark"
  | "terminal";

type LessonState = {
  completedTaskIds: readonly string[];
  quizPassed: boolean;
};

type ChallengeState = {
  completedStepIds: readonly string[];
};

type Progress = {
  activeLessonId: LessonId;
  lessonStates: Partial<Record<LessonId, LessonState>>;
  challengeStates: Readonly<Record<string, ChallengeState>>;
  reviewRecords: Readonly<Record<string, ReviewRecord>>;
  streak: StreakState;
  achievements: readonly AchievementId[];
};

type ExerciseState = {
  lessonId: LessonId;
  selectedOptionId: string | null;
  status: "idle" | "correct" | "incorrect";
};

type TerminalDisplayLine = TerminalLine | { kind: "command"; text: string };

type ReviewTarget = {
  lesson: Lesson;
  task: TerminalTask;
  key: string;
};

const STORAGE_KEY = "i-learn-arch-btw-progress-v3";
const LEGACY_STORAGE_KEY = "i-learn-arch-btw-progress-v2";
const TERMINAL_STORAGE_KEY = "i-learn-arch-btw-terminal-v1";

const EMPTY_LESSON_STATE: LessonState = {
  completedTaskIds: [],
  quizPassed: false,
};

const ACHIEVEMENT_LABELS: readonly { id: AchievementId; label: string }[] = [
  { id: "first-command", label: "First command" },
  { id: "error-decoder", label: "Error decoder" },
  { id: "three-day-streak", label: "Three-day streak" },
  { id: "mission-complete", label: "Mission complete" },
];


const DEFAULT_PROGRESS: Progress = {
  activeLessonId: "terminal",
  lessonStates: {},
  challengeStates: {},
  reviewRecords: {},
  streak: { current: 0, best: 0, lastActiveDay: null },
  achievements: [],
};

const INITIAL_TERMINAL_LINES: readonly TerminalDisplayLine[] = [
  { kind: "output", text: "Safe browser shell. Type help to see the allowlisted commands." },
  { kind: "output", text: "Nothing runs on your computer and nothing leaves this page." },
];

const EXPLAINER_EXAMPLE = "sudo pacman -Syu";

const iconPaths: Record<IconName, readonly string[]> = {
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  book: ["M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z", "M4 5.5v16", "M8 7h8", "M8 11h6"],
  check: ["m5 12 4 4L19 6"],
  clock: ["M12 7v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  copy: ["M8 8V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3", "M4 9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"],
  database: ["M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z", "M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6", "M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"],
  external: ["M14 4h6v6", "m20 4-9 9", "M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"],
  lock: ["M6 10h12v10H6z", "M8 10V7a4 4 0 0 1 8 0v3"],
  refresh: ["M20 11a8 8 0 0 0-14.9-3L3 11", "M3 5v6h6", "M4 13a8 8 0 0 0 14.9 3L21 13", "M21 19v-6h-6"],
  search: ["m21 21-4.3-4.3", "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"],
  shield: ["M12 3 20 6v6c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6z", "m9 12 2 2 4-4"],
  spark: ["m12 3-1.4 5.6L5 10l5.6 1.4L12 17l1.4-5.6L19 10l-5.6-1.4Z", "m19 16-.7 2.3L16 19l2.3.7L19 22l.7-2.3L22 19l-2.3-.7Z"],
  terminal: ["M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z", "m6 10 3 2-3 2", "h5"],
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name].map((path) => (
        <path key={path} d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      ))}
    </svg>
  );
}

function isLessonId(value: unknown): value is LessonId {
  return typeof value === "string" && LESSONS.some((lesson) => lesson.id === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAchievementId(value: unknown): value is AchievementId {
  return value === "first-command" || value === "error-decoder" || value === "three-day-streak" || value === "mission-complete";
}

function lessonStateFor(progress: Progress, lessonId: LessonId): LessonState {
  return progress.lessonStates[lessonId] ?? EMPTY_LESSON_STATE;
}

function challengeStateFor(progress: Progress, challengeId: string): ChallengeState {
  return progress.challengeStates[challengeId] ?? { completedStepIds: [] };
}

function taskKey(lessonId: LessonId, taskId: string): string {
  return `${lessonId}:${taskId}`;
}

function updateLessonState(progress: Progress, lessonId: LessonId, update: (state: LessonState) => LessonState): Progress {
  const currentState = lessonStateFor(progress, lessonId);

  return {
    ...progress,
    lessonStates: {
      ...progress.lessonStates,
      [lessonId]: update(currentState),
    },
  };
}

function updateChallengeState(progress: Progress, challengeId: string, update: (state: ChallengeState) => ChallengeState): Progress {
  const currentState = challengeStateFor(progress, challengeId);

  return {
    ...progress,
    challengeStates: {
      ...progress.challengeStates,
      [challengeId]: update(currentState),
    },
  };
}

function withAchievement(progress: Progress, achievement: AchievementId): Progress {
  return progress.achievements.includes(achievement)
    ? progress
    : { ...progress, achievements: [...progress.achievements, achievement] };
}

function recordPractice(progress: Progress, key: string, outcome: "success" | "failure", usedHint: boolean, now: number): Progress {
  const reviewRecords = recordTaskAttempt(progress.reviewRecords, key, { kind: outcome, usedHint }, now);
  let nextProgress: Progress = {
    ...progress,
    reviewRecords,
    streak: recordLearningDay(progress.streak, now),
  };

  if (outcome === "success") {
    nextProgress = withAchievement(nextProgress, "first-command");
  } else {
    nextProgress = withAchievement(nextProgress, "error-decoder");
  }

  if (nextProgress.streak.current >= 3) {
    nextProgress = withAchievement(nextProgress, "three-day-streak");
  }

  return nextProgress;
}

function isLessonComplete(lesson: Lesson, progress: Progress): boolean {
  const state = lessonStateFor(progress, lesson.id);

  return state.quizPassed && lesson.terminalTasks.every((task) => state.completedTaskIds.includes(task.id));
}

function readProgress(): Progress {
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);

  if (!raw) {
    return DEFAULT_PROGRESS;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed)) {
      return DEFAULT_PROGRESS;
    }

    const activeLessonId = isLessonId(parsed.activeLessonId) ? parsed.activeLessonId : DEFAULT_PROGRESS.activeLessonId;
    const lessonStates: Partial<Record<LessonId, LessonState>> = {};

    if (isRecord(parsed.lessonStates)) {
      for (const lesson of LESSONS) {
        const rawState = parsed.lessonStates[lesson.id];

        if (!isRecord(rawState)) {
          continue;
        }

        const completedTaskIds = Array.isArray(rawState.completedTaskIds)
          ? rawState.completedTaskIds.filter((taskId): taskId is string => typeof taskId === "string" && lesson.terminalTasks.some((task) => task.id === taskId))
          : [];

        lessonStates[lesson.id] = {
          completedTaskIds: [...new Set(completedTaskIds)],
          quizPassed: rawState.quizPassed === true,
        };
      }
    }

    const challengeStates: Record<string, ChallengeState> = {};

    if (isRecord(parsed.challengeStates)) {
      for (const lesson of LESSONS) {
        const challenge = lesson.challenge;

        if (!challenge) {
          continue;
        }

        const rawState = parsed.challengeStates[challenge.id];

        if (!isRecord(rawState) || !Array.isArray(rawState.completedStepIds)) {
          continue;
        }

        challengeStates[challenge.id] = {
          completedStepIds: [...new Set(rawState.completedStepIds.filter((stepId): stepId is string => typeof stepId === "string" && challenge.steps.some((step) => step.id === stepId)))],
        };
      }
    }

    const reviewRecords: Record<string, ReviewRecord> = {};

    if (isRecord(parsed.reviewRecords)) {
      for (const [key, rawRecord] of Object.entries(parsed.reviewRecords)) {
        if (!isRecord(rawRecord) || typeof rawRecord.attempts !== "number" || typeof rawRecord.mistakes !== "number" || typeof rawRecord.intervalDays !== "number" || typeof rawRecord.nextReviewAt !== "number") {
          continue;
        }

        reviewRecords[key] = {
          attempts: Math.max(0, Math.floor(rawRecord.attempts)),
          mistakes: Math.max(0, Math.floor(rawRecord.mistakes)),
          intervalDays: Math.max(1, Math.floor(rawRecord.intervalDays)),
          nextReviewAt: Math.max(0, rawRecord.nextReviewAt),
        };
      }
    }

    const rawStreak = isRecord(parsed.streak) ? parsed.streak : {};
    const streak: StreakState = {
      current: typeof rawStreak.current === "number" ? Math.max(0, Math.floor(rawStreak.current)) : 0,
      best: typeof rawStreak.best === "number" ? Math.max(0, Math.floor(rawStreak.best)) : 0,
      lastActiveDay: typeof rawStreak.lastActiveDay === "string" ? rawStreak.lastActiveDay : null,
    };

    const achievements = Array.isArray(parsed.achievements)
      ? parsed.achievements.filter(isAchievementId)
      : [];

    return {
      activeLessonId,
      lessonStates,
      challengeStates,
      reviewRecords,
      streak,
      achievements: [...new Set(achievements)],
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function readTerminalSession(): TerminalSession {
  const raw = window.localStorage.getItem(TERMINAL_STORAGE_KEY);

  if (!raw) {
    return createInitialTerminalSession();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return parseTerminalSession(parsed) ?? createInitialTerminalSession();
  } catch {
    return createInitialTerminalSession();
  }
}

function reviewCandidates(progress: Progress): ReviewTarget[] {
  return LESSONS.flatMap((lesson) => {
    const completedTaskIds = lessonStateFor(progress, lesson.id).completedTaskIds;

    return lesson.terminalTasks
      .filter((task) => completedTaskIds.includes(task.id))
      .map((task) => ({ lesson, task, key: taskKey(lesson.id, task.id) }));
  });
}

function pickReviewTarget(progress: Progress, now: number): ReviewTarget | undefined {
  const candidates = reviewCandidates(progress);

  if (candidates.length === 0) {
    return undefined;
  }

  const due = candidates.filter((candidate) => {
    const record = progress.reviewRecords[candidate.key];
    return !record || record.nextReviewAt <= now;
  });
  const pool = due.length > 0 ? due : candidates;

  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}

function taskHints(task: TerminalTask): readonly [string, string, string] {
  const guide = COMMAND_GUIDES[task.guideId];

  return [
    `Think about the action first. ${task.explanation}`,
    `The syntax to study is ${guide.syntax}.`,
    `Full answer: ${task.command}`,
  ];
}

function challengeStepMatches(step: ChallengeStep, result: ReturnType<typeof runTerminalCommand>): boolean {
  if (result.kind === "error") {
    return false;
  }

  switch (step.check.kind) {
    case "output-includes":
      return result.text.includes(step.check.text);
    case "exists":
      return result.session.filesystem[step.check.path]?.kind === step.check.entryKind;
    case "file-content": {
      const entry = result.session.filesystem[step.check.path];
      return entry?.kind === "file" && entry.content.includes(step.check.text);
    }
    case "mode":
      return result.session.filesystem[step.check.path]?.mode === step.check.mode;
    case "moved":
      return result.session.filesystem[step.check.from] === undefined && result.session.filesystem[step.check.to]?.kind === "file";
    default: {
      const _exhaustive: never = step.check;
      return _exhaustive;
    }
  }
}

function lessonIcon(lessonId: LessonId): IconName {
  switch (lessonId) {
    case "terminal":
      return "terminal";
    case "filesystem":
      return "book";
    case "workspace":
      return "terminal";
    case "pacman-install":
      return "database";
    case "pacman-query":
      return "search";
    case "cleanup":
      return "refresh";
    case "tools":
      return "search";
    case "services":
      return "shield";
    case "file-operations":
      return "book";
    case "search-files":
      return "search";
    case "text-tools":
      return "terminal";
    case "permissions":
      return "lock";
    case "archives":
      return "database";
    case "processes":
      return "refresh";
    case "environment":
      return "spark";
    case "productivity":
      return "clock";
    default: {
      return "book";
    }
  }
}

export default function Home() {
  const [progress, setProgress] = useState<Progress>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_PROGRESS;
    }

    return readProgress();
  });
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exerciseState, setExerciseState] = useState<ExerciseState>({
    lessonId: DEFAULT_PROGRESS.activeLessonId,
    selectedOptionId: null,
    status: "idle",
  });
  const [terminalSession, setTerminalSession] = useState<TerminalSession>(() => {
    if (typeof window === "undefined") {
      return createInitialTerminalSession();
    }

    return readTerminalSession();
  });
  const [terminalLines, setTerminalLines] = useState<readonly TerminalDisplayLine[]>(INITIAL_TERMINAL_LINES);
  const [terminalInput, setTerminalInput] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewTargetKey, setReviewTargetKey] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [guideQuery, setGuideQuery] = useState("");
  const [reviewNow, setReviewNow] = useState(0);
  const [commandDraft, setCommandDraft] = useState(EXPLAINER_EXAMPLE);
  const [commandExplanation, setCommandExplanation] = useState<CommandExplanation>(() => explainCommand(EXPLAINER_EXAMPLE, COMMAND_GUIDES));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHydrated(true);
      setReviewNow(Date.now());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      window.localStorage.setItem(TERMINAL_STORAGE_KEY, JSON.stringify(terminalSession));
    }
  }, [hydrated, progress, terminalSession]);

  const visibleProgress = hydrated ? progress : DEFAULT_PROGRESS;
  const activeLesson = LESSONS.find((lesson) => lesson.id === visibleProgress.activeLessonId) ?? LESSONS[0];
  const activeIndex = LESSONS.findIndex((lesson) => lesson.id === activeLesson.id);
  const activeLessonState = lessonStateFor(visibleProgress, activeLesson.id);
  const completedTaskCount = activeLesson.terminalTasks.filter((task) => activeLessonState.completedTaskIds.includes(task.id)).length;
  const terminalObjectivesComplete = completedTaskCount === activeLesson.terminalTasks.length;
  const activeLessonComplete = isLessonComplete(activeLesson, visibleProgress);
  const currentTask = activeLesson.terminalTasks.find((task) => !activeLessonState.completedTaskIds.includes(task.id)) ?? activeLesson.terminalTasks[activeLesson.terminalTasks.length - 1];
  const reviewTarget = reviewMode
    ? reviewCandidates(visibleProgress).find((candidate) => candidate.key === reviewTargetKey)
    : undefined;
  const practiceTask = reviewTarget?.task ?? currentTask;
  const practiceHints = taskHints(practiceTask);
  const activeChallenge = activeLesson.challenge;
  const activeChallengeState = activeChallenge ? challengeStateFor(visibleProgress, activeChallenge.id) : undefined;
  const challengeStep = activeChallenge?.steps.find((step) => !activeChallengeState?.completedStepIds.includes(step.id));
  const challengeComplete = Boolean(activeChallenge && activeChallengeState && activeChallengeState.completedStepIds.length === activeChallenge.steps.length);
  const nextLesson = activeLessonComplete ? LESSONS[activeIndex + 1] : undefined;
  const completedCount = LESSONS.filter((lesson) => isLessonComplete(lesson, visibleProgress)).length;
  const terminalGoalCount = LESSONS.reduce((count, lesson) => count + lesson.terminalTasks.length, 0);
  const progressPercent = Math.round((completedCount / LESSONS.length) * 100);
  const knownReviewKeys = reviewCandidates(visibleProgress).map((candidate) => candidate.key);
  const reviewDue = reviewNow > 0 ? dueReviewCount(visibleProgress.reviewRecords, knownReviewKeys, reviewNow) : 0;
  const filteredGuides = Object.entries(COMMAND_GUIDES).filter(([name, guide]) => `${name} ${guide.purpose} ${guide.syntax} ${guide.note} ${guide.parts.map((part) => `${part.token} ${part.meaning}`).join(" ")}`.toLowerCase().includes(guideQuery.toLowerCase().trim())).slice(0, 8);
  const isExerciseForActiveLesson = exerciseState.lessonId === activeLesson.id;
  const exerciseStatus = isExerciseForActiveLesson ? exerciseState.status : "idle";
  const selectedOptionId = isExerciseForActiveLesson ? exerciseState.selectedOptionId : null;

  function openLesson(lesson: Lesson) {
    const lessonIndex = LESSONS.findIndex((item) => item.id === lesson.id);
    const previousLesson = LESSONS[lessonIndex - 1];
    const unlocked = lessonIndex === 0 || (previousLesson !== undefined && isLessonComplete(previousLesson, progress));

    if (!unlocked) {
      return;
    }

    setProgress((current) => ({ ...current, activeLessonId: lesson.id }));
    setExerciseState({ lessonId: lesson.id, selectedOptionId: null, status: "idle" });
    setTerminalSession((current) => ({
      ...current,
      cwd: "/home/student",
      environment: { ...current.environment, PWD: "/home/student" },
    }));
    setTerminalInput("");
    setReviewMode(false);
    setReviewTargetKey(null);
    document.getElementById("lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startReview() {
    const target = pickReviewTarget(progress, Date.now());

    if (!target) {
      return;
    }

    setReviewMode(true);
    setReviewTargetKey(target.key);
    setTerminalInput("");
    document.getElementById("lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function stopReview() {
    setReviewMode(false);
    setReviewTargetKey(null);
    setHintLevel(0);
    setTerminalInput("");
  }

  function answerExercise(optionId: string) {
    if (!terminalObjectivesComplete) {
      return;
    }

    const isCorrect = optionId === activeLesson.exercise.correctOptionId;

    setExerciseState({
      lessonId: activeLesson.id,
      selectedOptionId: optionId,
      status: isCorrect ? "correct" : "incorrect",
    });

    if (isCorrect) {
      setProgress((current) => updateLessonState(current, activeLesson.id, (state) => ({
        ...state,
        quizPassed: true,
      })));
    }
  }

  async function copyActiveCommand() {
    await navigator.clipboard.writeText(activeLesson.terminalTasks[0].command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function scrollToLesson() {
    document.getElementById("lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToCommandExplainer() {
    document.getElementById("command-explainer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitCommandExplanation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommandExplanation(explainCommand(commandDraft, COMMAND_GUIDES));
  }

  function resetTerminal() {
    setTerminalSession(createInitialTerminalSession());
    setTerminalLines(INITIAL_TERMINAL_LINES);
    setTerminalInput("");
    setReviewMode(false);
    setReviewTargetKey(null);
    setHintLevel(0);
  }

  function submitTerminalCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const command = terminalInput.trim();

    if (!command) {
      return;
    }

    const result = runTerminalCommand(command, terminalSession);
    const commandLine: TerminalDisplayLine = { kind: "command", text: `${terminalSession.cwd} $ ${command}` };
    const completedTaskIds = activeLessonState.completedTaskIds;
    const nextTask = activeLesson.terminalTasks.find((task) => !completedTaskIds.includes(task.id));
    const matchedTask = !reviewMode && nextTask?.command === result.normalizedInput ? nextTask : undefined;
    const matchedReviewTask = reviewTarget?.task.command === result.normalizedInput ? reviewTarget.task : undefined;
    const matchedChallengeStep = !reviewMode && challengeStep && challengeStepMatches(challengeStep, result) ? challengeStep : undefined;
    const nextSession: TerminalSession = {
      ...result.session,
      history: [...terminalSession.history, command],
    };

    setTerminalSession(nextSession);
    setTerminalInput("");
    if (result.kind !== "error" && (matchedTask || matchedReviewTask || matchedChallengeStep)) {
      setHintLevel(0);
    }

    const successMessages = result.kind !== "error"
      ? [
          matchedTask?.success,
          matchedReviewTask?.success,
          matchedChallengeStep ? `Challenge step complete. ${matchedChallengeStep.title}` : undefined,
        ].filter((message): message is string => Boolean(message))
      : [];
    const successLine: TerminalDisplayLine | undefined = successMessages.length > 0
      ? { kind: "output", text: `✓ ${successMessages.join(" ")}` }
      : undefined;

    if (result.kind === "clear") {
      setTerminalLines(successLine ? [successLine] : []);
    } else {
      const responseLine: TerminalDisplayLine = { kind: result.kind, text: result.text };
      setTerminalLines((current) => [...current, commandLine, ...(responseLine.text ? [responseLine] : []), ...(successLine ? [successLine] : [])]);
    }

    const attemptedKey = reviewTarget?.key ?? (nextTask ? taskKey(activeLesson.id, nextTask.id) : undefined);

    setProgress((current) => {
      let nextProgress = current;
      const successfulCommand = result.kind !== "error";

      if (matchedTask && successfulCommand) {
        nextProgress = updateLessonState(nextProgress, activeLesson.id, (state) => ({
          ...state,
          completedTaskIds: state.completedTaskIds.includes(matchedTask.id)
            ? state.completedTaskIds
            : [...state.completedTaskIds, matchedTask.id],
        }));
      }

      if (activeChallenge && matchedChallengeStep && successfulCommand) {
        nextProgress = updateChallengeState(nextProgress, activeChallenge.id, (state) => ({
          completedStepIds: state.completedStepIds.includes(matchedChallengeStep.id)
            ? state.completedStepIds
            : [...state.completedStepIds, matchedChallengeStep.id],
        }));

        if (activeChallengeState && activeChallengeState.completedStepIds.length + 1 === activeChallenge.steps.length) {
          nextProgress = withAchievement(nextProgress, "mission-complete");
        }
      }

      if (attemptedKey) {
        nextProgress = recordPractice(nextProgress, attemptedKey, successfulCommand && Boolean(matchedTask || matchedReviewTask) ? "success" : "failure", hintLevel > 0, reviewNow);
      }

      return nextProgress;
    });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span aria-hidden="true" className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span className="brand-name">I learn arch btw</span>
        </div>

        <div className="sidebar-heading">Arch foundations</div>
        <p className="sidebar-intro">Read the field. Run the command. Keep what sticks.</p>
        <div className="path-card">
          <div className="path-card-topline">
            <span>Path progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="progress-track dark-track">
            <span style={{ transform: `scaleX(${progressPercent / 100})` }} />
          </div>
          <p>{completedCount} of {LESSONS.length} lessons complete</p>
        </div>

        <nav aria-label="Course lessons" className="lesson-nav">
          {LESSONS.map((lesson, index) => {
            const completed = isLessonComplete(lesson, visibleProgress);
            const previousLesson = LESSONS[index - 1];
            const unlocked = index === 0 || (previousLesson !== undefined && isLessonComplete(previousLesson, visibleProgress));
            const active = lesson.id === activeLesson.id;

            return (
              <button
                aria-current={active ? "step" : undefined}
                className={`lesson-nav-item ${active ? "is-active" : ""} ${completed ? "is-complete" : ""} ${!unlocked ? "is-locked" : ""}`}
                disabled={!unlocked}
                key={lesson.id}
                onClick={() => openLesson(lesson)}
                type="button"
              >
                <span className="lesson-nav-icon">
                  {completed ? <Icon name="check" size={15} /> : unlocked ? <Icon name={lessonIcon(lesson.id)} size={15} /> : <Icon name="lock" size={14} />}
                </span>
                <span className="lesson-nav-copy">
                  <span className="lesson-nav-number">{lesson.number} / {lesson.module}</span>
                  <span>{lesson.title}</span>
                </span>
                {active && <span className="nav-active-dot" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <a href="https://wiki.archlinux.org/" rel="noreferrer" target="_blank">
            <span className="footer-icon"><Icon name="external" size={15} /></span>
            <span><strong>Arch Wiki</strong><small>The source behind the lessons</small></span>
          </a>
          <div className="local-note"><span className="save-dot" /> Progress saved locally · {visibleProgress.streak.current} day streak</div>
        </div>
      </aside>

      <section className="content-shell">
        <header className="topbar">
          <div className="breadcrumb"><span>Course</span><span>/</span><strong>Arch foundations</strong></div>
          <div className="topbar-status"><span className="save-dot" />{hydrated ? "Saved locally" : "Loading path"}<span className="topbar-divider" />No account needed<button className="review-button" disabled={knownReviewKeys.length === 0} onClick={reviewMode ? stopReview : startReview} type="button">{reviewMode ? "Exit review" : `Review${reviewDue > 0 ? ` · ${reviewDue} due` : ""}`}</button></div>
        </header>

        <div className="page-content">
          <section className="hero-panel">
            <div className="hero-copy">
              <div className="hero-index">FIELD 01 / {String(LESSONS.length).padStart(2, "0")}</div>
              <h1>Arch, one <em>command</em> at a time.</h1>
              <p>Build a working Linux vocabulary. Learn what each command does, run it in the practice shell, then prove you got it.</p>
              <button className="primary-button hero-button" onClick={nextLesson ? () => openLesson(nextLesson) : scrollToLesson} type="button">
                <span>{completedCount === 0 ? "Start the course" : nextLesson ? "Continue learning" : "Review the course"}</span>
                <span className="button-icon"><Icon name="arrow" size={17} /></span>
              </button>
              <button className="hero-tool-link" onClick={scrollToCommandExplainer} type="button">
                <span>Have a command? Paste it here.</span>
                <Icon name="arrow" size={14} />
              </button>
              <div className="hero-meta"><span><Icon name="clock" size={15} /> About 2 hours</span><span><Icon name="shield" size={15} /> Safe browser practice</span></div>
            </div>
            <div aria-hidden="true" className="hero-visual">
              <div className="data-field-header"><span>LIVE INPUT / SAFE MODE</span><strong>{String(activeIndex + 1).padStart(2, "0")}</strong></div>
              <div className="data-field">
                <div className="data-bars" aria-hidden="true">
                  <span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
                </div>
                <div className="data-field-grid" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /></div>
                <div className="terminal-window">
                  <div className="terminal-bar"><span /><span /><span /><b>arch-practice</b><i>READY</i></div>
                  <div className="terminal-line"><span className="terminal-prompt">~ $</span> pacman -Syu</div>
                  <div className="terminal-muted">:: Synchronizing package databases...</div>
                  <div className="terminal-muted"> core  132.4 KiB  1.8 MiB/s 00:00</div>
                  <div className="terminal-success">:: Starting full system upgrade...</div>
                  <div className="terminal-cursor"><span className="terminal-prompt">~ $</span><i /></div>
                </div>
                <div className="data-field-caption"><span>TRACE / command → result → recall</span><span>{String(completedCount).padStart(2, "0")} MARKED</span></div>
              </div>
              <div className="visual-caption"><span className="caption-bar" /> Small commands. Real understanding.</div>
            </div>
          </section>

          <section aria-label="Course stats" className="stats-row">
            <div className="register-item register-primary"><span className="stat-label">Course progress</span><strong>{progressPercent}<small>%</small></strong><div className="progress-track light-track"><span style={{ transform: `scaleX(${progressPercent / 100})` }} /></div><span className="stat-foot">{completedCount} / {LESSONS.length} lessons marked</span></div>
            <div className="register-item"><span className="stat-label">Terminal goals</span><strong>{terminalGoalCount}</strong><span className="stat-foot">Every command is hands-on</span></div>
            <div className="register-item register-note"><span className="stat-label"><Icon name="spark" size={15} /> Learning signal</span><p>{reviewDue > 0 ? `${reviewDue} command${reviewDue === 1 ? "" : "s"} due for review.` : "Your review queue is clear."} {visibleProgress.achievements.length} achievement{visibleProgress.achievements.length === 1 ? "" : "s"} unlocked.</p></div>
          </section>

          <section aria-label="Learning signals" className="learning-signal-row">
            <div><span className="stat-label">Streak</span><strong>{visibleProgress.streak.current}<small> days</small></strong><span className="stat-foot">Best run {visibleProgress.streak.best} days</span></div>
            <div><span className="stat-label">Achievements</span><div className="achievement-list">{ACHIEVEMENT_LABELS.map(({ id, label }) => <span className={visibleProgress.achievements.includes(id) ? "achievement is-unlocked" : "achievement"} key={id}>{visibleProgress.achievements.includes(id) ? "✓" : "○"} {label}</span>)}</div></div>
            <div className="learning-signal-action"><span>{reviewDue > 0 ? `${reviewDue} review${reviewDue === 1 ? "" : "s"} waiting.` : "Review appears after you learn a command."}</span><button className="secondary-button" disabled={knownReviewKeys.length === 0} onClick={startReview} type="button">Start review <Icon name="arrow" size={14} /></button></div>
          </section>

          <section aria-labelledby="command-explainer-title" className="command-explainer" id="command-explainer">
            <div className="command-explainer-header">
              <div>
                <div className="section-label">COMMAND CHECK / PASTE TO UNDERSTAND</div>
                <h2 id="command-explainer-title">What does this command actually do?</h2>
              </div>
              <span className="command-explainer-count">{Object.keys(COMMAND_GUIDES).length} command guides</span>
            </div>
            <form className="command-explainer-form" onSubmit={submitCommandExplanation}>
              <label htmlFor="command-explainer-input">Paste a command from the internet</label>
              <div className="command-explainer-input-row">
                <span aria-hidden="true">$</span>
                <input autoComplete="off" id="command-explainer-input" onChange={(event) => setCommandDraft(event.target.value)} placeholder={EXPLAINER_EXAMPLE} spellCheck={false} value={commandDraft} />
                <button className="primary-button" type="submit"><span>Explain command</span><span className="button-icon"><Icon name="arrow" size={15} /></span></button>
              </div>
              <p>Nothing runs here. Common commands, kernel tools, and their flags are explained locally. Use man when an option depends on your installed kernel, util-linux, or kmod version.</p>
            </form>

            {commandExplanation.kind === "recognized" && (
              <div aria-live="polite" className="command-explainer-result">
                <div className="command-explainer-result-header"><span className="command-explainer-status"><span /> {commandExplanation.coverage === "partial" ? "Partially understood" : "Command understood"}</span><code>{commandExplanation.input}</code></div>
                <p className="command-explainer-summary"><span className="command-explainer-summary-label">In plain English</span>{commandExplanation.plainEnglish}</p>
                {commandExplanation.diagnostics.length > 0 && <div className="command-explainer-diagnostics"><span>Needs a closer look</span><ul>{commandExplanation.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.command}-${index}`}>{diagnostic.message}</li>)}</ul></div>}
                <div className="command-breakdown">
                  {commandExplanation.levels.map((level) => (
                    <section className={`command-explanation-level is-${level.kind}`} key={level.kind}>
                      <span className="command-breakdown-label">{level.label}</span>
                      <p className="command-explanation-level-summary">{level.summary}</p>
                      {level.steps.length > 0 && <ol>
                        {level.steps.map((step, index) => <li key={`${level.kind}-${step.token}-${index}`}><code>{step.token}</code><span>{step.explanation}</span></li>)}
                      </ol>}
                    </section>
                  ))}
                </div>
                <div className="command-explainer-footer">
                  {commandExplanation.foundations.length > 0 && <p><span>Linux foundations</span>{commandExplanation.foundations.join(" · ")}</p>}
                  {commandExplanation.effects.length > 0 && <p><span>Detected effects</span>{commandExplanation.effects.join(" · ")}</p>}
                  <p><span>Guide note</span>{commandExplanation.note}</p>
                  <p className="command-risk"><span>{commandExplanation.risk.label}</span>{commandExplanation.risk.message}</p>
                </div>
              </div>
            )}

            {commandExplanation.kind === "unknown" && (
              <div aria-live="polite" className="command-explainer-result is-unknown">
                <div className="command-explainer-result-header"><span className="command-explainer-status"><span /> Not in the local guide</span><code>{commandExplanation.input}</code></div>
                <p className="command-explainer-summary"><span className="command-explainer-summary-label">In plain English</span>{commandExplanation.plainEnglish ?? <>I do not have a reliable explanation for <code>{commandExplanation.command}</code> yet.</>}</p>
                {commandExplanation.knownCommands.length > 0 && <div className="command-explainer-known"><span>Recognized inside</span><ul>{commandExplanation.knownCommands.map((known, index) => <li key={`${known.command}-${known.origin}-${index}`}><code>{known.command}</code><span>{known.purpose}{known.effects.length > 0 ? ` · ${known.effects.join(" · ")}` : ""}</span></li>)}</ul></div>}
                {commandExplanation.diagnostics.length > 0 && <div className="command-explainer-diagnostics"><span>Why it is incomplete</span><ul>{commandExplanation.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.command}-${index}`}>{diagnostic.message}</li>)}</ul></div>}
                {commandExplanation.effects.length > 0 && <p className="command-explainer-effects"><span>Detected effects</span>{commandExplanation.effects.join(" · ")}</p>}
                <p className="command-explainer-unknown-note">Do not run a pasted command just because it looks familiar. Check its manual page or a trusted source first.</p>
              </div>
            )}

            {commandExplanation.kind === "empty" && <p aria-live="polite" className="command-explainer-empty">Paste a command to get a plain-language breakdown.</p>}
          </section>

          <section className="continue-header">
            <div>
              <div className="section-label">ACTIVE RUN / LESSON {activeLesson.number}</div>
              <h2>Build your command line muscle.</h2>
            </div>
            <div className="continue-count"><span>{String(activeIndex + 1).padStart(2, "0")}</span> / {String(LESSONS.length).padStart(2, "0")}</div>
          </section>

          <section className="learning-grid" id="lesson">
            <article className="lesson-card">
              <div className="lesson-card-header">
                <div className="lesson-kicker"><span className="lesson-kicker-icon"><Icon name={lessonIcon(activeLesson.id)} size={17} /></span><span>{activeLesson.module}</span><span className="kicker-separator" /><span>Lesson {activeLesson.number}</span></div>
                <span className="duration"><Icon name="clock" size={15} /> {activeLesson.duration}</span>
              </div>
              <h2>{activeLesson.title}</h2>
              <p className="lesson-summary">{activeLesson.summary}</p>

              <div className="command-heading"><span>Command guide</span><button aria-label="Copy first answer" className="copy-button" onClick={copyActiveCommand} type="button"><Icon name={copied ? "check" : "copy"} size={15} /> {copied ? "Copied" : "Copy first answer"}</button></div>
              <div className="command-guide-list">
                {activeLesson.terminalTasks.map((task, index) => (
                  <details className="command-guide-card" key={task.id} name="command-guide">
                    <summary className="command-guide-summary"><span className="command-guide-index">{String(index + 1).padStart(2, "0")}</span><span className="command-guide-title">{task.title}</span><span className="command-guide-toggle" aria-hidden="true">+</span></summary>
                    <div className="command-guide-content">
                      <div className="command-guide-answer"><span>Answer</span><code>{task.command}</code></div>
                      <p>{COMMAND_GUIDES[task.guideId].purpose}</p>
                      <div className="command-guide-syntax"><span>Syntax</span><code>{COMMAND_GUIDES[task.guideId].syntax}</code></div>
                      {COMMAND_GUIDES[task.guideId].parts.length > 0 && <div className="command-guide-parts"><span>Flags and parts</span><ul>{COMMAND_GUIDES[task.guideId].parts.map((part) => <li key={`${task.id}-${part.token}`}><code>{part.token}</code><span>{part.meaning}</span></li>)}</ul></div>}
                      <p className="command-guide-note">{COMMAND_GUIDES[task.guideId].note}</p>
                    </div>
                  </details>
                ))}
              </div>

              <div className="terminal-practice">
                <div className="terminal-practice-header">
                  <div>
                    <div className="terminal-practice-label"><Icon name="terminal" size={15} /> {reviewMode ? "Review mode" : "Practice in the browser"}</div>
                    <h3>{reviewMode ? `Review / ${practiceTask.title}` : terminalObjectivesComplete ? "Terminal objectives complete" : currentTask.title}</h3>
                  </div>
                  <span className="safe-badge"><span /> Safe mode</span>
                </div>
                <p className="terminal-task-prompt">{reviewMode ? `Recall this command without looking it up. ${practiceTask.prompt}` : terminalObjectivesComplete ? "You completed every command objective. Take the quiz below to unlock the next lesson." : currentTask.prompt}</p>
                <div className="recall-hint">
                  <div><span>Progressive hint {hintLevel}/3</span>{hintLevel > 0 && <p>{practiceHints[hintLevel - 1]}</p>}</div>
                  <button disabled={hintLevel >= practiceHints.length} onClick={() => setHintLevel((level) => Math.min(level + 1, practiceHints.length))} type="button">{hintLevel === 0 ? "Show hint" : hintLevel === 1 ? "Show syntax" : hintLevel === 2 ? "Reveal answer" : "All hints shown"}</button>
                </div>
                <div className="terminal-objectives" aria-label="Terminal objectives">
                  <div className="terminal-objectives-heading"><span>Objectives</span><strong>{completedTaskCount}/{activeLesson.terminalTasks.length}</strong></div>
                  <ol>
                    {activeLesson.terminalTasks.map((task, index) => {
                      const completed = activeLessonState.completedTaskIds.includes(task.id);

                      return (
                        <li className={completed ? "is-complete" : index === completedTaskCount ? "is-current" : ""} key={task.id}>
                          <span className="terminal-objective-marker">{completed ? <Icon name="check" size={12} /> : index + 1}</span>
                          <span><strong>{task.title}</strong><code>{completed ? "passed" : index === completedTaskCount ? "waiting for your command" : "locked until then"}</code></span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
                {activeChallenge && activeChallengeState && <div className="challenge-panel">
                  <div className="challenge-header"><div><span>Mini project · multi-command challenge</span><strong>{activeChallenge.title}</strong></div><b>{activeChallengeState.completedStepIds.length}/{activeChallenge.steps.length}</b></div>
                  <p>{activeChallenge.summary}</p>
                  <ol>
                    {activeChallenge.steps.map((step, index) => {
                      const completed = activeChallengeState.completedStepIds.includes(step.id);

                      return <li className={completed ? "is-complete" : index === activeChallengeState.completedStepIds.length ? "is-current" : ""} key={step.id}><span className="challenge-marker">{completed ? <Icon name="check" size={11} /> : index + 1}</span><span><strong>{step.title}</strong><small>{completed ? "done" : index === activeChallengeState.completedStepIds.length ? step.prompt : "complete the previous step first"}</small></span></li>;
                    })}
                  </ol>
                  {challengeComplete && <div className="challenge-success"><Icon name="check" size={13} /> {activeChallenge.success}</div>}
                </div>}
                <div className="practice-terminal">
                  <div className="practice-terminal-bar"><span><i /><i /><i /></span><b>arch-practice</b><button aria-label="Reset practice terminal" onClick={resetTerminal} type="button"><Icon name="refresh" size={14} /></button></div>
                  <div className="practice-terminal-body" role="log" aria-live="polite">
                    {terminalLines.map((line, index) => <div className={`terminal-output-line terminal-line-${line.kind}`} key={`${line.kind}-${index}-${line.text}`}><span>{line.kind === "command" ? "" : line.kind === "error" ? "!" : ""}</span>{line.text}</div>)}
                    <form className="terminal-input-row" onSubmit={submitTerminalCommand}>
                      <label htmlFor="practice-terminal-input">{terminalSession.cwd} $</label>
                      <input autoComplete="off" id="practice-terminal-input" onChange={(event) => setTerminalInput(event.target.value)} spellCheck={false} value={terminalInput} />
                    </form>
                  </div>
                </div>
                <div className="terminal-task-footer">
                  <span className={terminalObjectivesComplete ? "task-complete" : ""}>{reviewMode ? <><span className="task-arrow">↳</span> Review one learned command.</> : terminalObjectivesComplete ? <><Icon name="check" size={13} /> All terminal objectives passed. Take the quiz next.</> : <><span className="task-arrow">↳</span> Objective {completedTaskCount + 1} of {activeLesson.terminalTasks.length}.</>}</span>
                  {reviewMode ? <button className="terminal-next-button" onClick={stopReview} type="button">Exit review</button> : activeLessonComplete && nextLesson && <button className="terminal-next-button" onClick={() => openLesson(nextLesson)} type="button">Next lesson <Icon name="arrow" size={14} /></button>}
                </div>
                <div className="terminal-disclaimer"><Icon name="shield" size={14} /> This is a browser-only practice shell. It cannot access your computer or run arbitrary commands.</div>
              </div>

              <div className="takeaway-heading"><span>Keep in your pocket</span><span className="takeaway-line" /></div>
              <ul className="takeaway-list">
                {activeLesson.takeaways.map((takeaway) => <li key={takeaway}><span><Icon name="check" size={13} /></span>{takeaway}</li>)}
              </ul>

              <a className="source-link" href={activeLesson.source.href} rel="noreferrer" target="_blank"><span>{activeLesson.source.label}</span><Icon name="external" size={14} /></a>
            </article>

            <aside className={`exercise-card ${terminalObjectivesComplete ? "" : "is-locked"}`}>
              <div className="exercise-topline"><span className="exercise-label"><Icon name={terminalObjectivesComplete ? "spark" : "lock"} size={15} /> {terminalObjectivesComplete ? "Knowledge check" : "Quiz locked"}</span><span className="exercise-number">{activeLesson.number} / {String(LESSONS.length).padStart(2, "0")}</span></div>
              <h3>{terminalObjectivesComplete ? "Make it stick." : "Finish the terminal first."}</h3>
              <p className="exercise-question">{activeLesson.exercise.question}</p>
              {!terminalObjectivesComplete && <div className="exercise-locked-copy"><Icon name="lock" size={14} /> Complete every terminal objective above to unlock this quiz.</div>}
              <div className="option-list">
                {activeLesson.exercise.options.map((option) => {
                  const selected = selectedOptionId === option.id;
                  const correct = exerciseStatus === "correct" && selected;
                  const incorrect = exerciseStatus === "incorrect" && selected;

                  return (
                    <button aria-pressed={selected} className={`option-button ${selected ? "is-selected" : ""} ${correct ? "is-correct" : ""} ${incorrect ? "is-incorrect" : ""}`} disabled={exerciseStatus === "correct" || !terminalObjectivesComplete} key={option.id} onClick={() => answerExercise(option.id)} type="button">
                      <span className="option-marker">{correct ? <Icon name="check" size={14} /> : String.fromCharCode(65 + activeLesson.exercise.options.indexOf(option))}</span>
                      <code>{option.label}</code>
                    </button>
                  );
                })}
              </div>
              {exerciseStatus === "idle" && terminalObjectivesComplete && <p className="exercise-help">Choose an answer to check your understanding.</p>}
              {exerciseStatus === "incorrect" && <div className="feedback feedback-error"><span className="feedback-icon">!</span><p>Not quite. {activeLesson.exercise.hint}</p></div>}
              {exerciseStatus === "correct" && <div className={`feedback ${activeLessonComplete ? "feedback-success" : "feedback-pending"}`}><span className="feedback-icon"><Icon name="check" size={15} /></span><div><strong>{activeLessonComplete ? "Lesson complete." : "Quiz passed."}</strong><p>{activeLessonComplete ? activeLesson.exercise.success : `Finish ${activeLesson.terminalTasks.length - completedTaskCount} terminal objective${activeLesson.terminalTasks.length - completedTaskCount === 1 ? "" : "s"} to unlock the next lesson.`}</p></div></div>}
              {exerciseStatus === "correct" && activeLessonComplete && nextLesson && <button className="next-button" onClick={() => openLesson(nextLesson)} type="button"><span>Next lesson</span><Icon name="arrow" size={17} /></button>}
              {exerciseStatus === "correct" && activeLessonComplete && !nextLesson && <div className="course-complete"><Icon name="spark" size={17} /> You finished the path.</div>}
            </aside>
          </section>

          <section className="reference-section">
            <div className="reference-header"><div><div className="section-label">REFERENCE / PACMAN</div><h2>Package queries at a glance.</h2></div><a href="https://wiki.archlinux.org/title/Pacman" rel="noreferrer" target="_blank">Full pacman guide <Icon name="external" size={14} /></a></div>
            <div className="reference-grid">
              <div className="reference-card"><span className="reference-icon"><Icon name="database" size={17} /></span><code>pacman -Q</code><p>List all installed packages.</p></div>
              <div className="reference-card"><span className="reference-icon"><Icon name="search" size={17} /></span><code>pacman -Qs term</code><p>Search installed packages.</p></div>
              <div className="reference-card"><span className="reference-icon"><Icon name="book" size={17} /></span><code>pacman -Qi name</code><p>Read package details.</p></div>
              <div className="reference-card"><span className="reference-icon"><Icon name="terminal" size={17} /></span><code>pacman -Ql name</code><p>List a package&apos;s files.</p></div>
            </div>
          </section>

          <section aria-label="Command encyclopedia" className="encyclopedia-section">
            <div className="reference-header"><div><div className="section-label">REFERENCE / COMMANDS</div><h2>Look it up before you guess.</h2></div><div className="encyclopedia-meta"><span className="encyclopedia-count">{Object.keys(COMMAND_GUIDES).length} entries</span><a href="https://www.gnu.org/software/coreutils/manual/coreutils.html" rel="noreferrer" target="_blank">GNU Coreutils</a><a href="https://www.gnu.org/s/bash/manual/bash.html" rel="noreferrer" target="_blank">Bash manual</a><a href="https://man.archlinux.org/" rel="noreferrer" target="_blank">Arch man pages</a></div></div>
            <label className="encyclopedia-search"><Icon name="search" size={15} /><span className="sr-only">Search the command encyclopedia</span><input onChange={(event) => setGuideQuery(event.target.value)} placeholder="Search by command, purpose, or syntax" value={guideQuery} /></label>
            <div className="encyclopedia-grid">
              {filteredGuides.map(([name, guide]) => <details className="encyclopedia-entry" key={name}><summary><code>{name}</code><span>{guide.purpose}</span><b>+</b></summary><div><code>{guide.syntax}</code><p>{guide.note}</p></div></details>)}
            </div>
            {filteredGuides.length === 0 && <p className="encyclopedia-empty">No command matches that search.</p>}
          </section>

          <footer className="page-footer"><span>Made for the curious.</span><span>I learn arch btw / 2026</span><a href="https://wiki.archlinux.org/" rel="noreferrer" target="_blank">Source material from Arch Wiki <Icon name="external" size={13} /></a><span>tldr-pages © 2014–present · <a href="https://github.com/tldr-pages/tldr" rel="noreferrer" target="_blank">source <Icon name="external" size={13} /></a> · <a href="https://creativecommons.org/licenses/by/4.0/" rel="noreferrer" target="_blank">CC BY 4.0 <Icon name="external" size={13} /></a></span></footer>
        </div>
      </section>
    </main>
  );
}
