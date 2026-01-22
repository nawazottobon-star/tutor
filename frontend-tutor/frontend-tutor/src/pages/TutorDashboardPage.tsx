import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { readStoredSession, clearStoredSession, resetSessionHeartbeat } from '@/utils/session';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Mail, Sparkles, Loader2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";


type TutorCourse = {
  courseId: string;
  slug: string;
  title: string;
  description?: string;
  role?: string;
};

type EnrollmentRow = {
  enrollmentId: string;
  enrolledAt: string;
  status: string;
  userId: string;
  fullName: string;
  email: string;
};




type ProgressRow = {
  userId: string;
  fullName: string;
  email: string;
  enrolledAt: string;
  completedModules: number;
  totalModules: number;
  percent: number;
};

type TutorAssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

type Cohort = {
  cohortId: string;
  name: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};


type ActivityLearner = {
  eventId?: string;
  userId: string;
  courseId: string;
  moduleNo: number | null;
  topicId: string | null;
  topicTitle?: string | null;
  eventType: string;
  derivedStatus: string | null;
  statusReason: string | null;
  createdAt: string;
};

type ActivitySummary = {
  engaged: number;
  attention_drift: number;
  content_friction: number;
  unknown: number;
};

type CourseTopic = {
  topicId: string;
  topicName: string;
  moduleNo: number;
  moduleName?: string;
};

const NumberTicker = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const [displayValue, setDisplayValue] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (value > 0 && !hasAnimated.current) {
      animate(count, value, {
        duration: 1.2,
        ease: "easeOut",
      });
      hasAnimated.current = true;
    } else if (hasAnimated.current) {
      count.set(value);
    }
  }, [value]);

  useEffect(() => {
    return rounded.onChange((v) => setDisplayValue(v));
  }, [rounded]);

  return <span>{displayValue}{suffix}</span>;
};

export default function TutorDashboardPage() {
  const session = readStoredSession();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<TutorAssistantMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailFormData, setEmailFormData] = useState({ to: '' as string | string[], fullName: '', subject: '', message: '' });
  const [emailSending, setEmailSending] = useState(false);
  const [isImprovingEmail, setIsImprovingEmail] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isAssistantSheetOpen, setIsAssistantSheetOpen] = useState(false);
  const assistantChatRef = useRef<HTMLDivElement>(null);

  const QUICK_PROMPTS = [
    "Which learners are inactive this week?",
    "Summarize course completion by module",
    "Show engagement trends for my classes"
  ];

  // Auto-scroll to bottom of assistant chat
  useEffect(() => {
    if (assistantChatRef.current) {
      assistantChatRef.current.scrollTop = assistantChatRef.current.scrollHeight;
    }
  }, [assistantMessages, assistantLoading, isAssistantSheetOpen]);

  useEffect(() => {
    if (!session) {
      return;
    }
    resetSessionHeartbeat();
  }, [session]);

  const headers = useMemo(() => {
    if (!session?.accessToken) return undefined;
    const h = new Headers();
    h.set('Authorization', `Bearer ${session.accessToken}`);
    return h;
  }, [session?.accessToken]);

  const {
    data: coursesResponse,
    isLoading: coursesLoading
  } = useQuery<{ courses: TutorCourse[] }>({
    queryKey: ['tutor-courses'],
    enabled: session?.role === 'tutor' || session?.role === 'admin',
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/tutors/me/courses', undefined, headers ? { headers } : undefined);
      return response.json();
    }
  });

  const courses = coursesResponse?.courses ?? [];

  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].courseId);
    }
  }, [courses, selectedCourseId]);

  useEffect(() => {
    setAssistantMessages([]);
    setSelectedLearnerId(null);
    setSelectedCohortId(null);
  }, [selectedCourseId]);

  const {
    data: cohortsResponse,
    isLoading: cohortsLoading
  } = useQuery<{ cohorts: Cohort[] }>({
    queryKey: ['tutor-cohorts', selectedCourseId],
    enabled: Boolean(selectedCourseId) && Boolean(headers),
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/tutors/${selectedCourseId}/cohorts`,
        undefined,
        headers ? { headers } : undefined
      );
      return response.json();
    }
  });

  const cohorts = useMemo(() => {
    return [...(cohortsResponse?.cohorts ?? [])].sort((a, b) => {
      // Sort by startsAt desc, then by name desc as a fallback
      const dateA = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const dateB = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      return b.name.localeCompare(a.name);
    });
  }, [cohortsResponse?.cohorts]);

  useEffect(() => {
    if (cohorts.length > 0 && !selectedCohortId) {
      setSelectedCohortId(cohorts[0].cohortId);
    }
  }, [cohorts, selectedCohortId]);



  const {
    data: enrollmentsResponse,
    isLoading: enrollmentsLoading
  } = useQuery<{ enrollments: EnrollmentRow[] }>({
    queryKey: ['tutor-enrollments', selectedCourseId, selectedCohortId],
    enabled: Boolean(selectedCourseId) && Boolean(headers),
    queryFn: async () => {
      const url = `/api/tutors/${selectedCourseId}/enrollments${selectedCohortId ? `?cohortId=${selectedCohortId}` : ''}`;
      const response = await apiRequest(
        'GET',
        url,
        undefined,
        headers ? { headers } : undefined
      );
      return response.json();
    }
  });

  const { data: progressResponse, isLoading: progressLoading } = useQuery<{ learners: ProgressRow[]; totalModules: number }>({
    queryKey: ['tutor-progress', selectedCourseId, selectedCohortId],
    enabled: Boolean(selectedCourseId) && Boolean(headers),
    queryFn: async () => {
      const url = `/api/tutors/${selectedCourseId}/progress${selectedCohortId ? `?cohortId=${selectedCohortId}` : ''}`;
      const response = await apiRequest(
        'GET',
        url,
        undefined,
        headers ? { headers } : undefined
      );
      return response.json();
    }
  });


  const {
    data: topicsResponse,
    isLoading: topicsLoading
  } = useQuery<{ topics: CourseTopic[] }>({
    queryKey: ['tutor-topics', selectedCourseId],
    enabled: Boolean(selectedCourseId),
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/lessons/courses/${selectedCourseId}/topics`,
        undefined,
        headers ? { headers } : undefined
      );
      return response.json();
    }
  });

  const {
    data: activityResponse,
    isLoading: activityLoading,
    isFetching: activityFetching,
    error: activityError
  } = useQuery<{ learners: ActivityLearner[]; summary: ActivitySummary }>({
    queryKey: ['activity-summary', selectedCourseId],
    enabled: Boolean(selectedCourseId) && Boolean(headers),
    refetchInterval: 30_000,
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/activity/courses/${selectedCourseId}/learners`,
        undefined,
        headers ? { headers } : undefined
      );
      return response.json();
    }
  });

  const {
    data: historyResponse,
    isLoading: historyLoading,
    isFetching: historyFetching
  } = useQuery<{ events: ActivityLearner[] }>({
    queryKey: ['activity-history', selectedLearnerId, selectedCourseId],
    enabled: Boolean(selectedLearnerId) && Boolean(selectedCourseId) && Boolean(headers),
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/activity/learners/${selectedLearnerId}/history?courseId=${selectedCourseId}&limit=40`,
        undefined,
        headers ? { headers } : undefined
      );
      return response.json();
    }
  });



  const learnerDirectory = useMemo(() => {
    const map = new Map<string, { fullName?: string; email?: string }>();
    (enrollmentsResponse?.enrollments ?? []).forEach((row) => {
      map.set(row.userId, { fullName: row.fullName, email: row.email });
    });
    (progressResponse?.learners ?? []).forEach((row) => {
      if (!map.has(row.userId)) {
        map.set(row.userId, { fullName: row.fullName, email: row.email });
      }
    });
    return map;
  }, [enrollmentsResponse?.enrollments, progressResponse?.learners]);

  const topicTitleLookup = useMemo(() => {
    const map = new Map<string, { title: string; moduleNo: number; moduleName?: string }>();
    (topicsResponse?.topics ?? []).forEach((topic) => {
      map.set(topic.topicId, { title: topic.topicName, moduleNo: topic.moduleNo, moduleName: topic.moduleName });
    });
    return map;
  }, [topicsResponse?.topics]);

  const activitySummary = activityResponse?.summary ?? { engaged: 0, attention_drift: 0, content_friction: 0, unknown: 0 };
  const statusMeta: Record<
    NonNullable<ActivityLearner['derivedStatus']> | 'unknown',
    { label: string; badgeClass: string; description: string; dotClass: string }
  > = {
    engaged: {
      label: 'Engaged',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      dotClass: 'bg-emerald-500',
      description: 'Actively interacting with course content.'
    },
    attention_drift: {
      label: 'Attention drift',
      badgeClass: 'bg-amber-100 text-amber-700',
      dotClass: 'bg-amber-500',
      description: 'Idle or pause cues observed.'
    },
    content_friction: {
      label: 'Content friction',
      badgeClass: 'bg-rose-100 text-rose-700',
      dotClass: 'bg-rose-500',
      description: 'Learner signaling friction.'
    },
    unknown: {
      label: 'Unknown',
      badgeClass: 'bg-slate-200 text-slate-700',
      dotClass: 'bg-slate-400',
      description: 'Awaiting telemetry events.'
    }
  };

  const selectedLearner = activityResponse?.learners.find((learner) => learner.userId === selectedLearnerId) ?? null;
  const selectedIdentity = selectedLearnerId ? learnerDirectory.get(selectedLearnerId) : null;
  const historyEvents = historyResponse?.events ?? [];
  const sortedHistoryEvents = useMemo(() => {
    return [...historyEvents].sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (diff !== 0) {
        return diff;
      }
      if (a.eventId && b.eventId && a.eventId !== b.eventId) {
        return a.eventId < b.eventId ? 1 : -1;
      }
      return 0;
    });
  }, [historyEvents]);
  const statusOrder: Array<keyof typeof statusMeta> = ['engaged', 'attention_drift', 'content_friction', 'unknown'];

  const formatTimestamp = (timestamp: string) =>
    new Date(timestamp).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', year: 'numeric', month: 'short', day: 'numeric' });

  const EVENT_LABELS: Record<string, string> = {
    'idle.start': 'Idle detected',
    'idle.end': 'Attention resumed',
    'video.play': 'Video started',
    'video.pause': 'Video paused',
    'video.buffer.start': 'Video buffering',
    'video.buffer.end': 'Video resumed',
    'lesson.view': 'Lesson viewed',
    'lesson.locked_click': 'Locked lesson clicked',
    'quiz.fail': 'Quiz attempt failed',
    'quiz.pass': 'Quiz passed',
    'quiz.retry': 'Quiz retried',
    'quiz.progress': 'Quiz progress updated',
    'progress.snapshot': 'Progress snapshot',
    'persona.change': 'Persona updated',
    'notes.saved': 'Notes saved',
    'cold_call.loaded': 'Cold-call prompt opened',
    'cold_call.submit': 'Cold-call response submitted',
    'cold_call.star': 'Cold-call star awarded',
    'cold_call.response_received': 'Tutor responded to cold-call',
    'tutor.prompt': 'Tutor prompt sent',
    'tutor.response_received': 'Tutor response received',
  };

  const STATUS_REASON_LABELS: Record<string, string> = {
    no_interaction: 'No interaction detected',
    tab_hidden: 'Browser tab hidden',
    tab_visible: 'Browser tab visible',
    video_play: 'Video playing',
    video_pause: 'Video paused',
  };

  function friendlyLabel(source: string, dictionary: Record<string, string>): string {
    const normalized = source.toLowerCase();
    if (dictionary[normalized]) {
      return dictionary[normalized];
    }
    if (/\s/.test(source) || /[()]/.test(source)) {
      return source;
    }
    return source
      .replace(/[._]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function formatEventLabel(eventType: string): string {
    return friendlyLabel(eventType, EVENT_LABELS);
  }

  function formatStatusReason(reason?: string | null): string | null {
    if (!reason) return null;
    return friendlyLabel(reason, STATUS_REASON_LABELS);
  }

  const handleLogout = () => {
    clearStoredSession();
    toast({ title: 'Signed out' });
    setLocation('/become-a-tutor');
  };

  const performAssistantQuery = async (question: string) => {
    if (!selectedCourseId || !question.trim()) {
      return;
    }

    if (!headers) {
      toast({ variant: 'destructive', title: 'Session missing', description: 'Please sign in again.' });
      return;
    }

    const trimmedQuestion = question.trim();
    const userMessage: TutorAssistantMessage = {
      id: `${Date.now()}-${Math.random()}`,
      role: 'user',
      content: trimmedQuestion,
      timestamp: new Date().toISOString()
    };

    setAssistantMessages((prev) => [...prev, userMessage]);
    setAssistantInput('');
    setAssistantLoading(true);

    try {
      const response = await apiRequest(
        'POST',
        '/api/tutors/assistant/query',
        { courseId: selectedCourseId, question: trimmedQuestion },
        { headers }
      );
      const payload = await response.json();
      const assistantMessage: TutorAssistantMessage = {
        id: `${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content: payload?.answer ?? 'No response available.',
        timestamp: new Date().toISOString()
      };
      setAssistantMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Assistant unavailable',
        description: error?.message ?? 'Unable to fetch response'
      });
    } finally {
      setAssistantLoading(false);
    }
  };

  const handleAssistantSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await performAssistantQuery(assistantInput);
  };

  const handleOpenEmailModal = (students: { email: string; fullName: string } | Array<{ email: string; fullName: string }>) => {
    if (Array.isArray(students)) {
      if (students.length === 0) return;

      if (students.length === 1) {
        // Treat single student as single even if passed as array via bulk selection
        setEmailFormData({ to: students[0].email, fullName: students[0].fullName, subject: '', message: '' });
      } else {
        setEmailFormData({
          to: students.map(s => s.email),
          fullName: `${students.length} selected learners`,
          subject: '',
          message: ''
        });
      }
    } else {
      setEmailFormData({ to: students.email, fullName: students.fullName, subject: '', message: '' });
    }
    setIsEmailModalOpen(true);
  };

  const toggleEmailSelection = (email: string) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const handleBulkEmail = () => {
    const studentsToEmail = [];
    // Gather details for selected emails from reachable data
    const allLearners = [
      ...(enrollmentsResponse?.enrollments ?? []),
      ...(progressResponse?.learners ?? [])
    ];

    selectedEmails.forEach(email => {
      const learner = allLearners.find(l => l.email === email);
      if (learner) {
        studentsToEmail.push({ email: learner.email, fullName: learner.fullName });
      }
    });

    handleOpenEmailModal(studentsToEmail);
  };

  const handleImproveEmail = async () => {
    if (!emailFormData.message.trim() || !headers) return;

    setIsImprovingEmail(true);
    try {
      // Get current course name for context
      const currentCourse = courses.find(c => c.courseId === selectedCourseId);
      const courseName = currentCourse?.title || 'the course';

      const response = await apiRequest(
        'POST',
        '/api/tutors/email/improve',
        {
          message: emailFormData.message,
          learnerName: emailFormData.fullName,
          courseName: courseName
        },
        { headers }
      );

      const data = await response.json();

      if (data.improvedMessage) {
        setEmailFormData({
          ...emailFormData,
          message: data.improvedMessage
        });

        toast({
          title: 'Message improved',
          description: 'Your message has been enhanced. Review and edit if needed before sending.'
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'AI improvement failed',
        description: error?.message || 'Unable to improve message. Please try again.'
      });
    } finally {
      setIsImprovingEmail(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headers) return;

    setEmailSending(true);
    try {
      await apiRequest(
        'POST',
        '/api/tutors/email',
        {
          to: emailFormData.to,
          subject: emailFormData.subject,
          message: emailFormData.message
        },
        { headers }
      );
      toast({
        title: 'Email sent',
        description: Array.isArray(emailFormData.to)
          ? `Your message has been sent to ${emailFormData.to.length} learners.`
          : `Your message to ${emailFormData.fullName} has been sent.`
      });
      setIsEmailModalOpen(false);
      setSelectedEmails(new Set()); // Clear selection after sending
    } catch (error: any) {
      let errorMessage = 'Failed to send email. Please try again.';

      // Attempt to extract structured error details from the response
      if (error instanceof Error && error.message.includes('{')) {
        try {
          const body = JSON.parse(error.message.substring(error.message.indexOf('{')));
          if (body.details) {
            errorMessage = `${body.message} (${body.details})`;
          } else if (body.message) {
            errorMessage = body.message;
          }
        } catch (e) {
          // Fallback to error message
          errorMessage = error.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage
      });
    }
    finally {
      setEmailSending(false);
    }
  };


  const totalEnrollments = enrollmentsResponse?.enrollments?.length ?? 0;
  const averageProgressPercent = useMemo(() => {
    const learners = progressResponse?.learners ?? [];
    if (learners.length === 0) {
      return 0;
    }
    const total = learners.reduce((acc, learner) => acc + learner.percent, 0);
    return Math.round(total / learners.length);
  }, [progressResponse?.learners]);

  const navItems = [
    { id: 'overview', label: 'Command Center' },
    { id: 'classroom', label: 'Classroom' },
    { id: 'monitoring', label: 'Live Monitor' },
    { id: 'copilot', label: 'AI Copilot' }
  ];

  const overviewStats = [
    { label: 'Active learners', value: totalEnrollments, suffix: '', helper: `${activitySummary.engaged} currently engaged` },
    {
      label: 'Avg. progress',
      value: averageProgressPercent,
      suffix: '%',
      helper: progressResponse?.totalModules ? `${progressResponse.totalModules} modules tracked` : 'Across current cohort'
    },
    {
      label: 'Critical alerts',
      value: activitySummary.content_friction,
      suffix: '',
      helper: 'Content friction signals'
    }
  ];

  const handleSectionNav = (sectionId: string) => {
    if (sectionId === 'copilot') {
      setIsAssistantSheetOpen(true);
      return;
    }

    if (typeof document === 'undefined') {
      return;
    }
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!session) {
    return (
      <SiteLayout>
        <div className="max-w-3xl mx-auto py-10 px-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">Use your tutor credentials to access the dashboard.</p>
              <Button onClick={() => setLocation('/become-a-tutor')}>Go to landing page</Button>
            </CardContent>
          </Card>
        </div>
      </SiteLayout>
    );
  }

  if (session.role !== 'tutor' && session.role !== 'admin') {
    return (
      <SiteLayout>
        <div className="max-w-3xl mx-auto py-10 px-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Access restricted</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">This area is only for tutors or admins.</p>
              <Button className="mt-3" onClick={handleLogout} variant="outline">
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 text-slate-900">
          <section id="overview" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-600">Tutor Command Center</p>
                <div>
                  <h1 className="text-3xl font-semibold text-slate-900">Welcome back, {session.fullName ?? 'Tutor'}</h1>
                  <p className="text-sm text-slate-600">
                    Monitor every learner signal, respond to alerts, and guide your class from a single surface.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Select value={selectedCourseId ?? undefined} onValueChange={(value) => setSelectedCourseId(value)}>
                    <SelectTrigger className="w-full border-slate-300 bg-white text-left text-slate-900 sm:w-[280px]">
                      <SelectValue placeholder={coursesLoading ? 'Loading...' : 'Select course'} />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course) => (
                        <SelectItem key={course.courseId} value={course.courseId}>
                          {course.title} {course.role ? `(${course.role})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                    onClick={handleLogout}
                  >
                    Logout
                  </Button>
                </div>
                {courses.length > 0 && selectedCourseId && (
                  <p className="text-sm text-slate-600">
                    Showing data for{' '}
                    <span className="font-semibold">
                      {courses.find((c) => c.courseId === selectedCourseId)?.title ?? 'your course'}
                    </span>
                    .
                  </p>
                )}
              </div>
              <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {overviewStats.map((stat) => (
                  <div key={stat.label} className="flex flex-col h-full min-h-[140px] rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{stat.label}</p>
                    <div className="mt-2 text-4xl font-bold text-slate-900 tracking-tight">
                      <NumberTicker value={stat.value} suffix={stat.suffix} />
                    </div>
                    <p className="mt-auto pt-4 text-[11px] font-medium text-slate-500 leading-relaxed border-t border-slate-200/50">{stat.helper}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <nav className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600" aria-label="Tutor sections">
            {navItems.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handleSectionNav(item.id)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 font-medium tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <section id="classroom" className="mt-12 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Classroom</p>
              <h2 className="text-2xl font-semibold text-slate-900">Roster & Throughput</h2>
              <p className="text-sm text-slate-600">Stay on top of enrollments and module completion at a glance.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-slate-200 bg-white text-slate-900 shadow-md">
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-slate-900">Enrollments</CardTitle>
                      <p className="text-sm text-slate-600">{totalEnrollments} learners in the cohort</p>
                    </div>
                    <Select value={selectedCohortId ?? undefined} onValueChange={(value) => setSelectedCohortId(value)}>
                      <SelectTrigger className="w-full border-slate-300 bg-white text-left text-slate-900 sm:w-[220px]">
                        <SelectValue placeholder={cohortsLoading ? 'Loading cohorts...' : 'Select cohort batch'} />
                      </SelectTrigger>
                      <SelectContent>
                        {cohorts.map((cohort) => (
                          <SelectItem key={cohort.cohortId} value={cohort.cohortId}>
                            {cohort.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {enrollmentsLoading ? (
                    <p className="text-sm text-slate-600">Loading enrollments...</p>
                  ) : (enrollmentsResponse?.enrollments ?? []).length === 0 ? (
                    <p className="text-sm text-slate-600">No enrollments yet.</p>
                  ) : (
                    <div className="relative group/scroll">
                      <div className="max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 scroll-smooth pr-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-slate-500">Learner</TableHead>
                              <TableHead className="text-slate-500">Email</TableHead>
                              <TableHead className="text-slate-500">Status</TableHead>
                              <TableHead className="text-slate-500">Enrolled</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(enrollmentsResponse?.enrollments ?? []).map((enrollment) => (
                              <TableRow key={enrollment.enrollmentId} className="border-slate-100">
                                <TableCell className="text-slate-900 font-medium">
                                  {enrollment.fullName}
                                </TableCell>
                                <TableCell className="text-slate-600 text-xs">{enrollment.email}</TableCell>
                                <TableCell>
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                                    {enrollment.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-slate-500 text-xs">{new Date(enrollment.enrolledAt).toLocaleDateString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent opacity-60" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white text-slate-900 shadow-md">
                <CardHeader>
                  <CardTitle className="text-slate-900">Learner progress</CardTitle>
                  <p className="text-sm text-slate-600">
                    Average completion {averageProgressPercent}% across {progressResponse?.totalModules ?? 0} modules
                  </p>
                </CardHeader>
                <CardContent>
                  {progressLoading ? (
                    <p className="text-sm text-slate-600">Loading progress...</p>
                  ) : (progressResponse?.learners ?? []).length === 0 ? (
                    <p className="text-sm text-slate-600">No progress yet.</p>
                  ) : (
                    <div className="relative group/scroll">
                      <div className="max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 scroll-smooth pr-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-slate-500">Learner</TableHead>
                              <TableHead className="text-slate-500">Modules</TableHead>
                              <TableHead className="text-slate-500">Percent</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(progressResponse?.learners ?? []).map((learner) => (
                              <TableRow key={learner.userId} className="border-slate-100">

                                <TableCell>
                                  <div className="font-semibold text-slate-900">{learner.fullName}</div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">{learner.email}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-slate-700 text-xs">
                                  {learner.completedModules}/{learner.totalModules}
                                </TableCell>
                                <TableCell className="text-slate-900">
                                  <div className="flex items-center gap-3">
                                    <div className="h-2 flex-1 rounded-full bg-slate-200">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
                                        style={{ width: `${learner.percent}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-bold">{learner.percent}%</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent opacity-60" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          <section id="monitoring" className="mt-12 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Intervention Zone</p>
                <h2 className="text-2xl font-semibold text-slate-900">Engagement & Alerts</h2>
                <p className="text-sm text-slate-600">
                  Assess signals and take directed action to guide learners back to flow.
                </p>
              </div>
              {selectedEmails.size > 0 && (
                <Button
                  onClick={handleBulkEmail}
                  className="bg-emerald-600 text-white hover:bg-emerald-500 animate-in fade-in slide-in-from-right-2"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Email Group ({selectedEmails.size})
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {statusOrder.map((key) => (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-full border border-slate-100 bg-white px-3 py-1 shadow-sm transition hover:border-slate-200"
                >
                  <span className={`h-2 w-2 rounded-full ${statusMeta[key].dotClass} animate-pulse`} />
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700">{statusMeta[key].label}</p>
                    <span className="h-1 w-1 rounded-full bg-slate-200" />
                    <p className="text-[10px] font-medium text-slate-500">{activitySummary[key]}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2 mt-6">
              <Card className="border-slate-200 bg-white text-slate-900 shadow-md flex flex-col">
                <CardHeader>
                  <CardTitle className="text-slate-900">Alert Feed</CardTitle>
                  <p className="text-xs text-slate-500">
                    {activityFetching ? 'Refreshing telemetry...' : 'Snapshots refresh automatically every 30 seconds.'}
                  </p>
                </CardHeader>
                <CardContent className="flex-1">
                  {activityError ? (
                    <p className="text-sm text-rose-500">
                      Unable to load learner telemetry right now. Please retry shortly.
                    </p>
                  ) : activityLoading ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map((index) => (
                        <Skeleton key={index} className="h-24 w-full rounded-2xl bg-slate-100" />
                      ))}
                    </div>
                  ) : (activityResponse?.learners ?? []).length === 0 ? (
                    <p className="text-sm text-slate-600">
                      No telemetry yet. As learners watch, read, attempt quizzes, or interact with widgets, they will appear here.
                    </p>
                  ) : (
                    <div className="relative group/scroll">
                      <div className="max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 scroll-smooth pr-2 pb-12">
                        <div className="space-y-2">
                          {(activityResponse?.learners ?? []).map((learner) => {
                            const identity = learnerDirectory.get(learner.userId);
                            const key = (learner.derivedStatus ?? 'unknown') as keyof typeof statusMeta;
                            const meta = statusMeta[key];
                            const isActive = selectedLearnerId === learner.userId;
                            const reasonLabel = formatStatusReason(learner.statusReason);
                            return (
                              <div key={learner.userId} className="flex items-center gap-3 pr-2">
                                <input
                                  type="checkbox"
                                  checked={identity?.email ? selectedEmails.has(identity.email) : false}
                                  onChange={() => identity?.email && toggleEmailSelection(identity.email)}
                                  disabled={!identity?.email}
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                                />
                                <button
                                  type="button"
                                  onClick={() => setSelectedLearnerId(learner.userId)}
                                  className={`flex-1 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 ${isActive ? 'border-emerald-200 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'
                                    }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900 line-clamp-1">
                                        {identity?.fullName ?? 'Learner'}{' '}
                                        {!identity?.fullName && (
                                          <span className="text-xs text-slate-500">({learner.userId.slice(0, 6)})</span>
                                        )}
                                      </p>
                                      <p className="text-[11px] text-slate-500 truncate">{identity?.email ?? 'Email unavailable'}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <Badge variant="secondary" className={`${meta.badgeClass} border-0 text-[10px]`}>
                                        {meta.label}
                                      </Badge>
                                      {identity?.email && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600"
                                          title="Email learner about this engagement issue"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEmailModal({ email: identity.email!, fullName: identity.fullName ?? 'Learner' });
                                          }}
                                        >
                                          <Mail className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  {reasonLabel && <p className="mt-2 text-xs text-slate-600 line-clamp-2">{reasonLabel}</p>}
                                  <p className="mt-2 text-[10px] text-slate-400">Updated {formatTimestamp(learner.createdAt)}</p>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent opacity-60" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white text-slate-900 shadow-md flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 min-h-[56px]">
                    <div>
                      <CardTitle className="text-slate-900">Learner detail</CardTitle>
                      {selectedIdentity && (
                        <p className="text-sm text-emerald-600 font-medium truncate max-w-[200px]">
                          {selectedIdentity.fullName}
                        </p>
                      )}
                    </div>
                    {selectedLearner && (
                      <Badge
                        variant="secondary"
                        className={`${statusMeta[(selectedLearner.derivedStatus ?? 'unknown') as keyof typeof statusMeta].badgeClass} border-0`}
                      >
                        {statusMeta[(selectedLearner.derivedStatus ?? 'unknown') as keyof typeof statusMeta].label}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  {!selectedLearnerId ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-300">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <MessageSquare className="w-8 h-8 text-slate-300" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">No learner selected</h3>
                      <p className="text-sm text-slate-500 max-w-[200px] mt-2">
                        Select a learner from the list to view their engagement details and recent activity.
                      </p>
                    </div>
                  ) : (
                    <div className="relative group/scroll">
                      <div className="max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 scroll-smooth pr-1 pb-12">
                        {historyLoading || historyFetching ? (
                          <div className="space-y-2">
                            {[0, 1, 2].map((index) => (
                              <Skeleton key={index} className="h-20 w-full rounded-xl bg-slate-100" />
                            ))}
                          </div>
                        ) : sortedHistoryEvents.length === 0 ? (
                          <div className="text-center py-10 text-slate-500">
                            <p className="text-sm">No events recorded for this learner yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {sortedHistoryEvents.map((event, index) => {
                              const meta = statusMeta[(event.derivedStatus ?? 'unknown') as keyof typeof statusMeta];
                              const eventLabel = formatEventLabel(event.eventType);
                              const reasonLabel = formatStatusReason(event.statusReason);
                              return (
                                <div
                                  key={event.eventId ?? `${event.eventType}-${event.createdAt}-${event.moduleNo ?? 'm'}-${index}`}
                                  className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm hover:border-slate-200 transition"
                                >
                                  <div className="flex items-center justify-between gap-3 mb-2">
                                    <Badge variant="secondary" className={`${meta.badgeClass} border-0 text-[10px]`}>
                                      {meta.label}
                                    </Badge>
                                    <span className="text-[10px] font-medium text-slate-400">{formatTimestamp(event.createdAt)}</span>
                                  </div>
                                  <p className="text-sm font-bold text-slate-900">{eventLabel}</p>
                                  {reasonLabel && <p className="mt-1 text-xs text-slate-600 italic">"{reasonLabel}"</p>}
                                  <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                    <span className="rounded-md bg-slate-50 px-2 py-1">
                                      {(() => {
                                        const topicMeta = event.topicId ? topicTitleLookup.get(event.topicId) : null;
                                        return topicMeta
                                          ? topicMeta.moduleName ?? `Module ${topicMeta.moduleNo}`
                                          : `Module ${event.moduleNo ?? 'n/a'}`;
                                      })()}
                                    </span>
                                    <span className="text-slate-200">•</span>
                                    <span className="truncate">
                                      {(() => {
                                        const topicMeta = event.topicId ? topicTitleLookup.get(event.topicId) : null;
                                        return topicMeta?.title ?? (event.topicId ? `Topic ${event.topicId.slice(0, 8)}` : 'Topic n/a');
                                      })()}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent opacity-60" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Floating AI Copilot Button */}
          {!isAssistantSheetOpen && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="fixed bottom-8 right-8 z-[100]"
            >
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 0 0px rgba(16, 185, 129, 0)",
                    "0 0 0 15px rgba(16, 185, 129, 0.4)",
                    "0 0 0 0px rgba(16, 185, 129, 0)"
                  ]
                }}
                transition={{
                  duration: 2,
                  repeat: 2, // Pulse 3 times then stop
                  ease: "easeInOut"
                }}
                className="rounded-full"
              >
                <Button
                  onClick={() => setIsAssistantSheetOpen(true)}
                  className="h-14 px-6 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xl flex items-center gap-2 group transition-all hover:scale-105 active:scale-95"
                >
                  <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  <span className="font-semibold tracking-tight">AI Copilot</span>
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* AI Copilot Side Panel (Sheet) */}
          <Sheet open={isAssistantSheetOpen} onOpenChange={setIsAssistantSheetOpen}>
            <SheetContent side="right" className="w-full sm:max-w-[400px] md:max-w-[450px] p-0 border-l border-slate-200 bg-white flex flex-col">
              <SheetHeader className="p-6 border-b border-slate-200">
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <Sparkles className="w-4 h-4" />
                  <p className="text-[10px] uppercase tracking-[0.3em] font-bold">AI Copilot</p>
                </div>
                <SheetTitle className="text-xl font-bold text-slate-900">Classroom Analyst</SheetTitle>
              </SheetHeader>

              {/* Quick Suggestions */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">Quick Suggestions</p>
                <div className="flex flex-col gap-2">
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => performAssistantQuery(prompt)}
                      className="text-left text-sm p-3 rounded-xl border-2 border-emerald-100 bg-white hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-slate-700 hover:text-emerald-700 font-medium shadow-sm"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div
                ref={assistantChatRef}
                className="flex-1 overflow-y-auto p-6 space-y-4"
              >
                {assistantMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-60">
                    <div className="p-4 rounded-full bg-slate-100">
                      <MessageSquare className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500 max-w-[200px]">
                      Ask about enrollments, stuck learners, or classroom engagement.
                    </p>
                  </div>
                ) : (
                  assistantMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex flex-col ${message.role === 'assistant' ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.role === 'assistant'
                          ? 'bg-slate-100 text-slate-900 rounded-tl-none'
                          : 'bg-emerald-600 text-white rounded-tr-none shadow-md shadow-emerald-600/20'
                          }`}
                      >
                        <p className="text-[9px] uppercase tracking-wider opacity-60 font-bold mb-1">
                          {message.role === 'assistant' ? 'Copilot' : 'You'}
                        </p>
                        <div className="leading-relaxed whitespace-pre-line">
                          {message.role === 'assistant' && /(?:^|\s|\n)\d{1,2}\./.test(message.content) ? (
                            <ul className="space-y-1">
                              {message.content
                                .split(/(?=\s\d{1,2}\.|\n\d{1,2}\.)|^(\d{1,2}\.)/)
                                .filter(Boolean)
                                .map((part, pIdx) => (
                                  <li key={pIdx} className={pIdx > 0 ? "pt-1" : ""}>
                                    {part.trim()}
                                  </li>
                                ))}
                            </ul>
                          ) : (
                            message.content
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {assistantLoading && (
                  <div className="flex items-start">
                    <div className="bg-slate-100 text-slate-900 rounded-2xl rounded-tl-none px-4 py-3 text-sm flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin opacity-60" />
                      <span className="text-xs font-medium opacity-60">Analysing classroom data...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-200 bg-white">
                <form onSubmit={handleAssistantSubmit} className="flex flex-row flex-nowrap items-center gap-2">
                  <Input
                    value={assistantInput}
                    onChange={(event) => setAssistantInput(event.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAssistantSubmit(e as any);
                      }
                    }}
                    placeholder="Ask about learners..."
                    disabled={!selectedCourseId}
                    className="flex-1 border-slate-300 focus:border-emerald-500 bg-white text-slate-900 placeholder:text-slate-500 rounded-xl h-11"
                  />
                  <Button
                    type="submit"
                    disabled={!selectedCourseId || assistantLoading || !assistantInput.trim()}
                    className="bg-emerald-600 text-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-600 border border-transparent shadow-sm rounded-xl px-4 h-11 shrink-0 font-bold whitespace-nowrap"
                  >
                    {assistantLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
                  </Button>
                </form>
              </div>
            </SheetContent>
          </Sheet>


        </div>
      </div>

      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Email Student</DialogTitle>
            <DialogDescription className="text-slate-600">
              Send a direct message to {emailFormData.fullName}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendEmail} className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="to" className="text-slate-700">To</Label>
              <Input
                id="to"
                value={Array.isArray(emailFormData.to) ? emailFormData.to.join(', ') : emailFormData.to}
                disabled
                className="bg-slate-50 text-xs"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject" className="text-slate-700">Subject</Label>
              <Input
                id="subject"
                required
                value={emailFormData.subject}
                onChange={(e) => setEmailFormData({ ...emailFormData, subject: e.target.value })}
                placeholder="e.g. Feedback on your recent module"
                className="border-slate-300"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="message" className="text-slate-700">Message</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleImproveEmail}
                  disabled={!emailFormData.message.trim() || isImprovingEmail}
                  className="text-xs h-7"
                >
                  {isImprovingEmail ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Improving...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1 h-3 w-3" />
                      AI Improve
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                id="message"
                required
                rows={8}
                value={emailFormData.message}
                onChange={(e) => setEmailFormData({ ...emailFormData, message: e.target.value })}
                placeholder="Write your message here..."
                className="border-slate-300"
              />
              <p className="text-xs text-slate-500">
                Tip: Write a brief message, then click "AI Improve" to enhance it professionally.
              </p>
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEmailModalOpen(false)}
                className="border-slate-300 text-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={emailSending}
                className="bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {emailSending ? 'Sending...' : 'Send Email'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SiteLayout>
  );
}

