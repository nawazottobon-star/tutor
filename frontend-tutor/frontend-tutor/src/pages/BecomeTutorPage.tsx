import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  BarChart3,
  Video,
  Globe,
  ArrowRight,
  Sparkles,
  Loader2,
  CheckCircle2,
  Lightbulb,
  PenTool,
  Rocket,
  X
} from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { buildApiUrl } from "@/lib/api";
import { writeStoredSession, resetSessionHeartbeat } from '@/utils/session';
import type { StoredSession } from '@/types/session';

// --- 1. TYPES & INTERFACES ---
interface TutorApplication {
  fullName: string;
  email: string;
  phone: string;
  headline: string;
  expertiseArea: string;
  yearsExperience: number;
  courseTitle: string;
  availability: string;
  courseDescription: string;
  targetAudience: string;
}

// --- 2. Description helper (client-safe template) ---
const generateCourseDescription = async (
  title: string,
  expertise: string,
): Promise<string> => {
  if (!title || !expertise) {
    return "Describe your proposed curriculum, learning objectives, and the skills learners will gain.";
  }

  return [
    `${title} takes learners inside real workflows that ${expertise.toLowerCase()} teams use every day.`,
    "You will define a production-grade project, ship weekly deliverables, and review your work with industry mentors.",
    "By the end, participants graduate with a polished portfolio, repeatable playbooks, and the confidence to lead in their role.",
  ].join(" ");
};

// --- 3. SUB-COMPONENTS ---

// Sub-component for the Scroll-Scrubbing Number Animation
const ScrollFillNumber = ({ number, sizeClass }: { number: string; sizeClass?: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 90%", "center 50%"]
  });

  const clipPath = useTransform(
    scrollYProgress,
    [0, 1],
    ["inset(100% 0 0 0)", "inset(0% 0 0 0)"]
  );

  const baseStyles = `${sizeClass ?? "text-[8rem] md:text-[12rem]"} font-black leading-none tracking-tighter select-none m-0 p-0`;

  return (
    <div ref={ref} className="relative inline-flex items-center">
      {/* Background Layer (Outline) */}
      <div
        className={`${baseStyles} text-transparent`}
        style={{
          WebkitTextStroke: '3px rgba(30, 58, 71, 0.1)',
          letterSpacing: '-0.05em'
        }}
      >
        {number}
      </div>

      {/* Foreground Layer (Fill) */}
      <motion.div
        className="absolute inset-0 pointer-events-none flex items-center"
        style={{ clipPath }}
      >
        <div
          className={`${baseStyles} text-[#E5583E]`}
          style={{
            WebkitTextStroke: '3px #E5583E', // Match background stroke exactly
            letterSpacing: '-0.05em'
          }}
        >
          {number}
        </div>
      </motion.div>
    </div>
  );
};

const ScrollRevealItem = ({ title, desc }: { title: string; desc: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center", "center center", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0.1, 1, 1, 0.1]);
  const y = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [20, 0, 0, -20]);

  return (
    <motion.div
      ref={ref}
      style={{ opacity, y }}
      className="border-b border-[#1E3A47]/10 pb-12 last:border-b-0 last:pb-0"
    >
      <h4 className="text-2xl md:text-3xl font-bold text-[#E5583E] tracking-tight mb-4">
        {title}
      </h4>
      <p className="text-lg md:text-xl text-[#1E3A47]/80 font-medium leading-relaxed whitespace-pre-line">
        {desc}
      </p>
    </motion.div>
  );
};

const ScrollRevealTutorJourneyStep = ({ id, title, desc }: { id: string; title: string; desc: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center", "center center", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.1, 1, 1, 0.1]);
  const y = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [30, 0, 0, -30]);

  return (
    <motion.div
      ref={ref}
      style={{ opacity, y }}
      className="flex flex-col md:flex-row md:items-center gap-12 border-b border-[#1E3A47]/10 pb-12 last:border-b-0"
    >
      <div className="flex items-center justify-start">
        <ScrollFillNumber number={id} sizeClass="text-6xl md:text-[120px]" />
      </div>
      <div className="flex-1">
        <h4 className="text-3xl md:text-4xl font-black text-[#1E3A47] transition-colors duration-300">
          {title}
        </h4>
        <p className="text-lg text-[#1E3A47]/70 mt-2 font-medium leading-relaxed">
          {desc}
        </p>
      </div>
    </motion.div>
  );
};

// --- 4. MAIN COMPONENT ---
const initialFormState: TutorApplication = {
  fullName: "",
  email: "",
  phone: "",
  headline: "",
  expertiseArea: "",
  yearsExperience: 0,
  courseTitle: "",
  availability: "",
  courseDescription: "",
  targetAudience: "",
};

const BecomeTutor: React.FC = () => {
  const [formData, setFormData] = useState<TutorApplication>({ ...initialFormState });
  const [, setLocation] = useLocation();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeItem, setActiveItem] = useState<number | null>(null);

  // Typewriter state
  const fullText = "Your knowledge can change a career.";
  const [typedText, setTypedText] = useState("");

  const openLoginModal = () => {
    setLoginError(null);
    setShowLoginModal(true);
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
    setIsLoggingIn(false);
  };

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      setTypedText((prev: string) => fullText.slice(0, index + 1));
      index++;
      if (index === fullText.length) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, []);

  // Scroll Reveal Observer
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    const elements = document.querySelectorAll('.reveal');
    elements.forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);

  // --- Scrollytelling Logic for How It Works ---
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: howItWorksScroll } = useScroll({
    target: howItWorksRef,
    offset: ["start start", "end end"]
  });

  // Circle Scaling
  const circleScale = useTransform(howItWorksScroll, [0, 0.25], [0, 35]);

  // Step Opacities
  const step1Opacity = useTransform(howItWorksScroll, [0.25, 0.35, 0.45, 0.5], [0, 1, 1, 0]);
  const step2Opacity = useTransform(howItWorksScroll, [0.5, 0.6, 0.7, 0.8], [0, 1, 1, 0]);
  const step3Opacity = useTransform(howItWorksScroll, [0.8, 0.85, 0.95, 1], [0, 1, 1, 1]);

  const steps = [
    {
      id: "01",
      title: "Submit Idea",
      desc: "Tell us about your expertise and proposed topic.",
      icon: <Lightbulb size={64} className="text-[#E5583E]" />,
      opacity: step1Opacity
    },
    {
      id: "02",
      title: "Design Syllabus",
      desc: "Collaborate with our curriculum experts.",
      icon: <PenTool size={64} className="text-[#E5583E]" />,
      opacity: step2Opacity
    },
    {
      id: "03",
      title: "Launch & Earn",
      desc: "Go live on the platform. Track analytics and get paid.",
      icon: <Rocket size={64} className="text-[#E5583E]" />,
      opacity: step3Opacity
    }
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: TutorApplication) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAiGenerate = async () => {
    if (!formData.courseTitle || !formData.expertiseArea) {
      alert("Please enter a Course Title and Area of Expertise first.");
      return;
    }

    setIsGenerating(true);
    try {
      const description = await generateCourseDescription(formData.courseTitle, formData.expertiseArea);
      setFormData(prev => ({ ...prev, courseDescription: description }));
    } catch (error) {
      console.error("AI Generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTutorLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError("Please enter both email and password.");
      return;
    }

    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const response = await fetch("/api/tutors/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim().toLowerCase(), password: loginPassword }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message ?? "Wrong email or wrong password");
      }

      const payload = await response.json();
      const session: StoredSession = {
        accessToken: payload.session?.accessToken,
        accessTokenExpiresAt: payload.session?.accessTokenExpiresAt,
        refreshToken: payload.session?.refreshToken,
        refreshTokenExpiresAt: payload.session?.refreshTokenExpiresAt,
        sessionId: payload.session?.sessionId,
        role: payload.user?.role,
        userId: payload.user?.id,
        email: payload.user?.email,
        fullName: payload.user?.fullName,
      };

      writeStoredSession(session);
      resetSessionHeartbeat();

      const userPayload = {
        id: payload.user?.id,
        email: payload.user?.email,
        fullName: payload.user?.fullName,
        role: payload.user?.role,
        tutorId: payload.user?.tutorId,
        displayName: payload.user?.displayName,
      };

      localStorage.setItem("user", JSON.stringify(userPayload));
      localStorage.setItem("isAuthenticated", "true");

      closeLoginModal();
      setLocation("/tutors");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Wrong email or wrong password");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);
    setIsSubmitting(true);

    const payload = {
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      phone: formData.phone?.trim() || undefined,
      headline: formData.headline.trim(),
      courseTitle: formData.courseTitle.trim(),
      courseDescription: formData.courseDescription.trim(),
      targetAudience: formData.targetAudience.trim(),
      expertiseArea: formData.expertiseArea.trim(),
      experienceYears: Number(formData.yearsExperience) || 0,
      availability: formData.availability.trim(),
    };

    try {
      const res = await fetch("/api/tutor-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.message ?? "Failed to submit tutor application.");
      }

      setSubmitMessage("Proposal submitted successfully! Our team will be in touch soon.");
      setFormData({ ...initialFormState });
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#FFFBF5] text-[#1E3A47] overflow-x-hidden font-sans">
      {/* Inject Custom Styles locally so this file is copy-pasteable */}
      <style>{`
        /* Typewriter Animation */
        .typewriter-cursor::after {
          content: '|';
          animation: blink 1s step-start infinite;
          color: #E5583E;
        }
        @keyframes blink { 50% { opacity: 0; } }

        /* Scroll Reveal Base */
        .reveal {
          opacity: 0;
          transform: translateY(30px);
          transition: all 1s cubic-bezier(0.5, 0, 0, 1);
        }
        .reveal.active {
          opacity: 1;
          transform: translateY(0);
        }
        .stagger-1 { transition-delay: 150ms; }
        .stagger-2 { transition-delay: 300ms; }
        .stagger-3 { transition-delay: 450ms; }
        
        /* Custom Scrollbar for this page */
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: #FFFBF5; }
        ::-webkit-scrollbar-thumb { background: #E5583E; border-radius: 5px; border: 2px solid #FFFBF5; }
        ::-webkit-scrollbar-thumb:hover { background: #C03520; }
      `}</style>

      {/* --- Header Section --- */}
      <section className="pt-32 pb-8 px-6 md:px-12 max-w-[1400px] mx-auto flex flex-col items-center text-center">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5583E]/10 text-[#E5583E] text-[10px] md:text-xs font-black uppercase tracking-widest mb-6 reveal">
            New Cohort 2026
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-[#1E3A47] tracking-tight mb-6 leading-tight min-h-[1.4em]">
            <span className="typewriter-cursor">{typedText}</span>
          </h1>



          <p className="mt-1 text-sm md:text-base text-[#1E3A47]/50 font-medium reveal stagger-1 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            Built with AI-powered tools, transparent earnings, and full creator control.
          </p>

          <div className="flex flex-col items-center gap-6 mt-6 reveal stagger-2">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
              <button
                type="button"
                onClick={() => document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-10 py-4 bg-[#E5583E] text-white font-bold text-sm uppercase tracking-widest shadow-xl shadow-[#E5583E]/20 transition hover:-translate-y-1 hover:bg-[#C03520] active:scale-95"
              >
                Apply as Tutor
              </button>
              <button
                type="button"
                onClick={openLoginModal}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-10 py-4 border-2 border-[#1E3A47]/20 text-[#1E3A47] font-bold text-sm uppercase tracking-widest transition hover:bg-[#1E3A47]/5 hover:border-[#1E3A47]/40 active:scale-95"
              >
                Tutor Login
              </button>
            </div>

            <p className="text-xs md:text-sm text-[#1E3A47]/40 font-semibold tracking-wide flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-[#E5583E]/40" />
              “No upfront costs. No exclusivity. You stay in control.”
              <span className="w-1 h-1 rounded-full bg-[#E5583E]/40" />
            </p>
          </div>
        </div>
      </section>

      {/* --- Why Teach Section (Interactive List) --- */}
      <section className="pt-12 pb-24 px-6 md:px-12 max-w-[1000px] mx-auto text-center">
        <div className="mb-12 reveal">
          <h3 className="text-4xl md:text-5xl font-black text-[#1E3A47] tracking-tight mb-4">Why teach with us?</h3>
        </div>

        <div className="space-y-16 text-left">
          {[
            {
              title: "Create or Delegate",
              desc: "Design and own your content end-to-end.\nIf you request our team to create content for you, this service is chargeable."
            },
            {
              title: "Earn Transparently",
              desc: "Earn through a revenue split based on course performance.\n• 80/20 split when the tutor provides required API keys.\n• 70/30 split when platform-managed APIs are used."
            },
            {
              title: "Grow With AI",
              desc: "AI-assisted follow-up messaging that helps tutors communicate clearly and professionally with students."
            },
            {
              title: "Track Everything",
              desc: "Monitor enrollments, engagement, payouts, and learner follow-ups in real time."
            }
          ].map((item, idx) => (
            <ScrollRevealItem
              key={idx}
              title={item.title}
              desc={item.desc}
            />
          ))}
        </div>
      </section>

      {/* --- How It Works Section (Three-step billboard) --- */}
      <section className="bg-[#FFFBF5] pt-24 pb-4 overflow-hidden">
        <div className="max-w-[1000px] mx-auto px-6 md:px-12 space-y-24">
          {[
            { id: "01", title: "Submit Idea", desc: "Validate demand using platform insights." },
            { id: "02", title: "Design Syllabus", desc: "Collaborate with curriculum experts and AI assistance." },
            { id: "03", title: "Launch & Earn", desc: "Track engagement, performance, payouts, and learner follow-ups in real time." },
          ].map((step) => (
            <ScrollRevealTutorJourneyStep
              key={step.id}
              id={step.id}
              title={step.title}
              desc={step.desc}
            />
          ))}
        </div>
      </section>

      {/* --- AI & Dashboard Confidence Cue --- */}
      <section className="pt-8 pb-32 px-6 md:px-12 max-w-[1400px] mx-auto text-center reveal">
        <div className="inline-flex items-center gap-2 mb-8 text-[#E5583E]">
          <Sparkles size={24} className="animate-pulse" />
          <span className="text-xs font-black uppercase tracking-[0.3em]">Intelligence Spotlight</span>
        </div>
        <h3 className="text-3xl md:text-5xl font-black text-[#1E3A47] max-w-4xl mx-auto leading-tight">
          “Know who needs attention, when to intervene, and how to follow up — automatically.”
        </h3>
        <p className="mt-8 text-[#1E3A47]/40 text-sm font-medium tracking-widest uppercase">
          AI-Driven Tutor Dashboard
        </p>
      </section>

      {/* --- Application Form Section (Red Background) --- */}
      <div id="apply-form" className="w-full bg-[#C03520] py-24 relative z-10 scroll-mt-20">
        <div className="text-center mb-12 reveal">
          <h3 className="text-[#FFFBF5]/80 text-sm font-black uppercase tracking-[0.2em] mb-4">Join the Team</h3>
          <p className="text-[#FFFBF5] text-3xl md:text-4xl font-black">Ready to make an impact?</p>
        </div>

        <section className="px-6 md:px-12 max-w-[1400px] mx-auto">
          <div className="bg-[#FFFBF5] rounded-[2.5rem] p-8 md:p-16 shadow-2xl shadow-black/20 reveal">
            <div className="mb-12 text-center max-w-3xl mx-auto">
              <h2 className="text-4xl md:text-6xl font-black text-[#1E3A47] mb-6 tracking-tight">Start your journey.</h2>
              <p className="text-lg md:text-xl text-[#1E3A47]/60 font-medium">Fill out the form below to apply. We review every application personally.</p>
            </div>

            <form onSubmit={handleSubmit} className="w-full max-w-5xl mx-auto">

              {/* Personal Details Row */}
              <div className="mb-12">
                <h3 className="text-[#E5583E] text-xs font-black uppercase tracking-widest mb-8 border-b border-[#1E3A47]/10 pb-3">Personal Details</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#1E3A47] uppercase tracking-wide">Full Name</label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full bg-white border-2 border-transparent focus:border-[#E5583E]/20 rounded-xl px-5 py-4 text-[#1E3A47] text-base font-bold placeholder-[#1E3A47]/20 focus:outline-none focus:ring-4 focus:ring-[#E5583E]/10 transition-all shadow-sm"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#1E3A47] uppercase tracking-wide">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full bg-white border-2 border-transparent focus:border-[#E5583E]/20 rounded-xl px-5 py-4 text-[#1E3A47] text-base font-bold placeholder-[#1E3A47]/20 focus:outline-none focus:ring-4 focus:ring-[#E5583E]/10 transition-all shadow-sm"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#1E3A47] uppercase tracking-wide">Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full bg-white border-2 border-transparent focus:border-[#E5583E]/20 rounded-xl px-5 py-4 text-[#1E3A47] text-base font-bold placeholder-[#1E3A47]/20 focus:outline-none focus:ring-4 focus:ring-[#E5583E]/10 transition-all shadow-sm"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#1E3A47] uppercase tracking-wide">Professional Headline</label>
                    <input
                      type="text"
                      name="headline"
                      value={formData.headline}
                      onChange={handleChange}
                      className="w-full bg-white border-2 border-transparent focus:border-[#E5583E]/20 rounded-xl px-5 py-4 text-[#1E3A47] text-base font-bold placeholder-[#1E3A47]/20 focus:outline-none focus:ring-4 focus:ring-[#E5583E]/10 transition-all shadow-sm"
                      placeholder="Sr. AI Engineer"
                    />
                  </div>
                </div>
              </div>

              {/* Expertise Row */}
              <div className="mb-12">
                <h3 className="text-[#E5583E] text-xs font-black uppercase tracking-widest mb-8 border-b border-[#1E3A47]/10 pb-3">Expertise</h3>
                <div className="grid md:grid-cols-2 gap-6 w-full">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#1E3A47] uppercase tracking-wide">Area of Expertise</label>
                    <input
                      type="text"
                      name="expertiseArea"
                      value={formData.expertiseArea}
                      onChange={handleChange}
                      className="w-full bg-white border-2 border-transparent focus:border-[#E5583E]/20 rounded-xl px-5 py-4 text-[#1E3A47] text-base font-bold placeholder-[#1E3A47]/20 focus:outline-none focus:ring-4 focus:ring-[#E5583E]/10 transition-all shadow-sm"
                      placeholder="e.g. LLMs, Python, Computer Vision"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#1E3A47] uppercase tracking-wide">Years of Experience</label>
                    <input
                      type="number"
                      name="yearsExperience"
                      value={formData.yearsExperience}
                      onChange={handleChange}
                      className="w-full bg-white border-2 border-transparent focus:border-[#E5583E]/20 rounded-xl px-5 py-4 text-[#1E3A47] text-base font-bold placeholder-[#1E3A47]/20 focus:outline-none focus:ring-4 focus:ring-[#E5583E]/10 transition-all shadow-sm"
                      placeholder="e.g. 5"
                    />
                  </div>
                </div>
              </div>

              {/* Course Proposal Row */}
              <div className="mb-12">
                <h3 className="text-[#E5583E] text-xs font-black uppercase tracking-widest mb-8 border-b border-[#1E3A47]/10 pb-3">Course Proposal</h3>
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#1E3A47] uppercase tracking-wide">Proposed Course Title</label>
                    <input
                      type="text"
                      name="courseTitle"
                      value={formData.courseTitle}
                      onChange={handleChange}
                      className="w-full bg-white border-2 border-transparent focus:border-[#E5583E]/20 rounded-xl px-5 py-4 text-[#1E3A47] text-base font-bold placeholder-[#1E3A47]/20 focus:outline-none focus:ring-4 focus:ring-[#E5583E]/10 transition-all shadow-sm"
                      placeholder="e.g. Advanced RAG Systems"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#1E3A47] uppercase tracking-wide">Availability</label>
                    <div className="relative">
                      <select
                        name="availability"
                        value={formData.availability}
                        onChange={handleChange}
                        className="w-full bg-white border-2 border-transparent focus:border-[#E5583E]/20 rounded-xl px-5 py-4 text-[#1E3A47] text-base font-bold appearance-none focus:outline-none focus:ring-4 focus:ring-[#E5583E]/10 transition-all cursor-pointer shadow-sm"
                      >
                        <option value="">Select availability</option>
                        <option value="immediate">Immediately</option>
                        <option value="1month">In 1 month</option>
                        <option value="3months">In 3 months</option>
                      </select>
                      <div className="absolute right-5 top-1/2 transform -translate-y-1/2 pointer-events-none text-[#1E3A47]">
                        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-[#1E3A47] uppercase tracking-wide">Course Description</label>
                      <button
                        type="button"
                        onClick={handleAiGenerate}
                        disabled={isGenerating}
                        className="flex items-center gap-2 text-[10px] font-black text-[#E5583E] hover:text-[#C03520] disabled:opacity-50 transition-colors uppercase tracking-widest bg-[#E5583E]/10 px-3 py-1 rounded-full hover:bg-[#E5583E]/20"
                      >
                        {isGenerating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                        {isGenerating ? 'Thinking...' : 'AI Assist'}
                      </button>
                    </div>
                    <textarea
                      name="courseDescription"
                      rows={5}
                      value={formData.courseDescription}
                      onChange={handleChange}
                      className="w-full bg-white border-2 border-transparent focus:border-[#E5583E]/20 rounded-xl px-5 py-4 text-[#1E3A47] text-base font-bold placeholder-[#1E3A47]/20 focus:outline-none focus:ring-4 focus:ring-[#E5583E]/10 transition-all shadow-sm resize-none"
                      placeholder="Briefly describe the curriculum..."
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#1E3A47] uppercase tracking-wide">Target Audience</label>
                    <textarea
                      name="targetAudience"
                      rows={5}
                      value={formData.targetAudience}
                      onChange={handleChange}
                      className="w-full bg-white border-2 border-transparent focus:border-[#E5583E]/20 rounded-xl px-5 py-4 text-[#1E3A47] text-base font-bold placeholder-[#1E3A47]/20 focus:outline-none focus:ring-4 focus:ring-[#E5583E]/10 transition-all shadow-sm resize-none"
                      placeholder="Who is this for?"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Action */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-8 border-t border-[#1E3A47]/10">
                <div className="flex items-start gap-3 text-[#1E3A47]/60">
                  <CheckCircle2 size={20} className="text-[#E5583E] shrink-0 mt-0.5" />
                  <p className="text-sm font-medium leading-relaxed">
                    By submitting, you agree to our Terms. <br />
                    We respect your privacy.
                  </p>
                </div>
                <div className="flex flex-col gap-3 w-full md:w-auto">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full md:w-auto px-12 py-5 bg-[#C03520] hover:bg-[#A02C1B] disabled:bg-[#C03520]/60 text-[#FFFBF5] font-black text-lg rounded-xl shadow-lg shadow-[#C03520]/20 transition-all flex items-center justify-center gap-3 hover:-translate-y-1 active:scale-95 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Application"}
                    {!isSubmitting && <ArrowRight size={20} strokeWidth={3} />}
                  </button>
                  {submitMessage && (
                    <p className="text-sm text-[#FFFBF5]/90 md:text-left text-center">{submitMessage}</p>
                  )}
                </div>
              </div>

            </form>
          </div>
        </section>
      </div>
      {showLoginModal && (
        <div className="fixed inset-0 z-[60] bg-[#0F172A]/70 backdrop-blur-sm px-6 flex items-center justify-center">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl text-left">
            <button
              type="button"
              onClick={closeLoginModal}
              className="absolute right-4 top-4 text-[#1E3A47]/60 hover:text-[#1E3A47] transition"
              aria-label="Close login dialog"
            >
              <X size={22} />
            </button>
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-[#E5583E]">
                Tutor Console
              </p>
              <h3 className="text-3xl font-black text-[#1E3A47]">Tutor login</h3>
              <p className="text-sm text-[#1E3A47]/70">
                Access your courses, enrollments, and learner progress.
              </p>
            </div>
            <form className="mt-8 space-y-5" onSubmit={handleTutorLogin}>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wide text-[#1E3A47]">
                  Email
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  className="w-full rounded-2xl border-2 border-transparent bg-[#F8F9FB] px-4 py-4 text-[#1E3A47] font-semibold placeholder:text-[#1E3A47]/30 focus:border-[#E5583E]/40 focus:outline-none focus:ring-4 focus:ring-[#E5583E]/10"
                  placeholder="you@ottolearn.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wide text-[#1E3A47]">
                  Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  className="w-full rounded-2xl border-2 border-transparent bg-[#F8F9FB] px-4 py-4 text-[#1E3A47] font-semibold placeholder:text-[#1E3A47]/30 focus:border-[#E5583E]/40 focus:outline-none focus:ring-4 focus:ring-[#E5583E]/10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              {loginError && (
                <p className="text-sm font-semibold text-[#C03520] bg-[#FEECEC] rounded-2xl px-4 py-2">
                  {loginError}
                </p>
              )}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full rounded-2xl bg-[#E5583E] py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-[#E5583E]/20 transition hover:-translate-y-0.5 hover:bg-[#C03520] disabled:bg-[#E5583E]/40 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? "Signing in..." : "Login as tutor"}
              </button>
              <p className="text-center text-xs text-[#1E3A47]/60">
                Need an account? Contact the program team to be onboarded.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BecomeTutor;
