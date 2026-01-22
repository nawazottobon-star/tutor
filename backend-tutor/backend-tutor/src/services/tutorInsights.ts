import { Prisma } from "@prisma/client";
import { differenceInDays } from "date-fns";
import { prisma } from "./prisma";

export type TutorLearnerSnapshot = {
  userId: string;
  fullName: string;
  email: string;
  enrolledAt: Date;
  completedModules: number;
  totalModules: number;
  percent: number;
  lastActivity?: Date | null;
  cohortName?: string;
};

export type CohortSummary = {
  cohortId: string;
  name: string;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  memberCount: number;
  averageCompletion: number;
};

export type TutorCourseSnapshot = {
  course: {
    courseId: string;
    title: string;
    slug: string;
    description?: string | null;
  };
  cohorts: CohortSummary[];
  selectedCohort?: {
    cohortId: string;
    name: string;
    memberCount: number;
  };
  stats: {
    totalEnrollments: number;
    newThisWeek: number;
    averageCompletion: number;
    activeThisWeek: number;
    atRiskLearners: number;
  };
  learners: TutorLearnerSnapshot[];
  allCohortLearners: Map<string, TutorLearnerSnapshot[]>;
};

export async function buildTutorCourseSnapshot(courseId: string, cohortId?: string): Promise<TutorCourseSnapshot> {
  const course = await prisma.course.findUnique({
    where: { courseId },
    select: {
      courseId: true,
      courseName: true,
      slug: true,
      description: true,
    },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  const moduleNumbers = await prisma.topic.findMany({
    where: { courseId, moduleNo: { gt: 0 } },
    select: { moduleNo: true },
    distinct: ["moduleNo"],
    orderBy: { moduleNo: "asc" },
  });
  const totalModules = moduleNumbers.length;

  // Fetch ALL cohorts for this course
  const allCohorts = await prisma.cohort.findMany({
    where: { courseId },
    include: {
      members: {
        include: {
          user: {
            select: {
              fullName: true,
            },
          },
        },
      },
    },
    orderBy: [
      { startsAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  // Fetch ALL enrollments for the course
  const allEnrollments = await prisma.enrollment.findMany({
    where: { courseId },
    select: {
      enrollmentId: true,
      userId: true,
      enrolledAt: true,
      status: true,
      user: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: { enrolledAt: "asc" },
  });

  // Fetch progress for ALL users in the course
  const progressRows = await prisma.$queryRaw<
    { user_id: string; module_no: number; quiz_passed: boolean; updated_at: Date | null }[]
  >(Prisma.sql`
    SELECT user_id, module_no, quiz_passed, updated_at
    FROM module_progress
    WHERE course_id = ${courseId}::uuid
  `);

  const progressByUser = new Map<string, { passedModules: Set<number>; lastActivity?: Date | null }>();
  progressRows.forEach((row) => {
    const entry = progressByUser.get(row.user_id) ?? { passedModules: new Set<number>(), lastActivity: null };
    if (row.quiz_passed) {
      entry.passedModules.add(row.module_no);
    }
    if (!entry.lastActivity || (row.updated_at && row.updated_at > entry.lastActivity)) {
      entry.lastActivity = row.updated_at;
    }
    progressByUser.set(row.user_id, entry);
  });

  // Build learner snapshots for ALL cohorts
  const allCohortLearners = new Map<string, TutorLearnerSnapshot[]>();

  allCohorts.forEach((cohort) => {
    const cohortLearners = cohort.members.map((member) => {
      let displayName = "Learner";
      if (member.user?.fullName) {
        displayName = member.user.fullName;
      } else {
        const emailPrefix = member.email.split('@')[0];
        displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      }

      const progress = member.userId ? progressByUser.get(member.userId) : null;
      const completedModules = progress ? progress.passedModules.size : 0;
      const percent =
        totalModules === 0 ? 0 : Math.min(100, Math.round((completedModules / totalModules) * 100));

      return {
        userId: member.userId || `temp-${member.email}`,
        fullName: displayName,
        email: member.email,
        enrolledAt: member.addedAt,
        completedModules,
        totalModules,
        percent,
        lastActivity: progress?.lastActivity ?? member.addedAt,
        cohortName: cohort.name,
      };
    });

    allCohortLearners.set(cohort.cohortId, cohortLearners);
  });

  // Build cohort summaries
  const cohortSummaries: CohortSummary[] = allCohorts.map((cohort) => {
    const members = cohort.members;
    const memberUserIds = members.map(m => m.userId).filter((id): id is string => id !== null);

    let totalCompletion = 0;
    let validMemberCount = 0;

    memberUserIds.forEach(userId => {
      const progress = progressByUser.get(userId);
      if (progress) {
        const completedModules = progress.passedModules.size;
        const percent = totalModules === 0 ? 0 : Math.min(100, Math.round((completedModules / totalModules) * 100));
        totalCompletion += percent;
        validMemberCount++;
      }
    });

    const averageCompletion = validMemberCount > 0 ? Math.round(totalCompletion / validMemberCount) : 0;

    return {
      cohortId: cohort.cohortId,
      name: cohort.name,
      isActive: cohort.isActive,
      startsAt: cohort.startsAt,
      endsAt: cohort.endsAt,
      memberCount: members.length,
      averageCompletion,
    };
  });

  // Determine which learners to show in the main list
  let learners: TutorLearnerSnapshot[];
  let selectedCohortInfo: { cohortId: string; name: string; memberCount: number } | undefined;

  if (cohortId) {
    // If cohortId is provided, focus on that cohort's learners
    const cohortLearners = allCohortLearners.get(cohortId);

    if (cohortLearners) {
      const selectedCohort = allCohorts.find(c => c.cohortId === cohortId);
      if (selectedCohort) {
        selectedCohortInfo = {
          cohortId: selectedCohort.cohortId,
          name: selectedCohort.name,
          memberCount: selectedCohort.members.length,
        };
      }
      learners = cohortLearners;
    } else {
      // Cohort not found, fall back to all enrollments
      learners = allEnrollments.map((enrollment) => {
        const progress = progressByUser.get(enrollment.userId);
        const completedModules = progress ? progress.passedModules.size : 0;
        const percent =
          totalModules === 0 ? 0 : Math.min(100, Math.round((completedModules / totalModules) * 100));
        return {
          userId: enrollment.userId,
          fullName: enrollment.user.fullName,
          email: enrollment.user.email,
          enrolledAt: enrollment.enrolledAt,
          completedModules,
          totalModules,
          percent,
          lastActivity: progress?.lastActivity ?? enrollment.enrolledAt,
        };
      });
    }
  } else {
    // No cohort selected, show all enrollments
    learners = allEnrollments.map((enrollment) => {
      const progress = progressByUser.get(enrollment.userId);
      const completedModules = progress ? progress.passedModules.size : 0;
      const percent =
        totalModules === 0 ? 0 : Math.min(100, Math.round((completedModules / totalModules) * 100));
      return {
        userId: enrollment.userId,
        fullName: enrollment.user.fullName,
        email: enrollment.user.email,
        enrolledAt: enrollment.enrolledAt,
        completedModules,
        totalModules,
        percent,
        lastActivity: progress?.lastActivity ?? enrollment.enrolledAt,
      };
    });
  }

  const now = new Date();
  const newThisWeek = learners.filter(
    (learner) => differenceInDays(now, learner.enrolledAt) <= 7,
  ).length;

  const activeThisWeek = learners.filter((learner) => {
    if (!learner.lastActivity) {
      return false;
    }
    return differenceInDays(now, learner.lastActivity) <= 7;
  }).length;

  const atRiskLearners = learners.filter((learner) => learner.percent < 50).length;

  const averageCompletion =
    learners.length === 0
      ? 0
      : Math.round(learners.reduce((sum, learner) => sum + learner.percent, 0) / learners.length);

  return {
    course: {
      courseId: course.courseId,
      title: course.courseName,
      slug: course.slug,
      description: course.description,
    },
    cohorts: cohortSummaries,
    selectedCohort: selectedCohortInfo,
    stats: {
      totalEnrollments: learners.length,
      newThisWeek,
      averageCompletion,
      activeThisWeek,
      atRiskLearners,
    },
    learners,
    allCohortLearners,
  };
}

export function formatTutorSnapshot(snapshot: TutorCourseSnapshot): string {
  const { course, cohorts, selectedCohort, stats, learners, allCohortLearners } = snapshot;

  // Format cohort information with member details
  const cohortLines = cohorts.map((cohort, index) => {
    const status = cohort.isActive ? "active" : "inactive";
    const startDate = cohort.startsAt ? formatDate(cohort.startsAt) : "not set";

    // Get learners for this cohort
    const cohortLearnersList = allCohortLearners.get(cohort.cohortId) || [];

    // For cohorts with 15 or fewer members, show all names. For larger cohorts, show first 15
    const displayLimit = cohortLearnersList.length <= 15 ? cohortLearnersList.length : 15;
    const learnerNames = cohortLearnersList.slice(0, displayLimit).map(l => l.fullName).join(", ");
    const moreCount = cohortLearnersList.length > displayLimit ? ` and ${cohortLearnersList.length - displayLimit} more` : "";

    return `${index + 1}. ${cohort.name} (${status}) – ${cohort.memberCount} members, ${cohort.averageCompletion}% avg completion. Starts: ${startDate}.\n   Students: ${learnerNames}${moreCount}`;
  }).join("\n");

  // Format detailed learner roster for currently viewed cohort
  const rosterLines = (learners ?? [])
    .slice(0, 40)
    .map((learner, index) => {
      const enrolled = formatDate(learner.enrolledAt);
      const lastActivity = learner.lastActivity ? formatDate(learner.lastActivity) : "unknown";
      const cohortInfo = learner.cohortName ? ` [${learner.cohortName}]` : "";
      return `${index + 1}. ${learner.fullName}${cohortInfo} (${learner.email}) – ${learner.percent}% complete (${learner.completedModules}/${learner.totalModules} modules). Enrolled ${enrolled}. Last activity ${lastActivity}.`;
    })
    .join("\n");

  const parts = [
    `Course: ${course.title} (slug: ${course.slug})`,
    course.description ? `Description: ${course.description}` : undefined,
    `\nCohorts (${cohorts.length} total):`,
    cohortLines || "No cohorts yet.",
  ];

  if (selectedCohort) {
    parts.push(`\nCurrently viewing: ${selectedCohort.name} (${selectedCohort.memberCount} members)`);
  }

  parts.push(
    `\nStats for ${selectedCohort ? selectedCohort.name : "all enrollments"}: total learners ${stats.totalEnrollments}, new this week ${stats.newThisWeek}, average completion ${stats.averageCompletion}%, active in last 7 days ${stats.activeThisWeek}, at risk ${stats.atRiskLearners}.`,
    `\nDetailed roster for ${selectedCohort ? selectedCohort.name : "all enrollments"} (top 40):`,
    rosterLines || "No learners yet."
  );

  return parts.filter(Boolean).join("\n");
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}
