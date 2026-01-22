import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { ChevronRight, LogOut, Menu, X } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserProfile {
    fullName?: string;
    email?: string;
    picture?: string;
}

interface NavbarProps {
    onLogin?: () => void;
    onApplyTutor?: () => void;
    isAuthenticated?: boolean;
    user?: UserProfile;
    onLogout?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
    onLogin = () => { },
    onApplyTutor = () => { },
    isAuthenticated = false,
    user,
    onLogout = () => { }
}) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [, setLocation] = useLocation();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setMobileMenuOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const scrollToSection = (id: string) => {
        // If not on home page, maybe navigate home first? 
        // For now, assuming this checks for elements on current page or redirects.
        // If we are NOT on the landing page, we might want to go there.
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        } else {
            // If element not found, standard behavior (maybe we are on another page)
            // ideally navigate to /#id but simple wouter doesn't always support hash nav cleanly without custom logic.
            // We will leave as is per existing logic, but it's safe to keep.
        }
    };

    return (
        <motion.nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-retro-bg/90 backdrop-blur-md shadow-sm py-2' : 'bg-transparent py-4'
                }`}
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="w-full px-6 md:px-12 flex justify-between items-center">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setLocation('/')}>
                    <div className="w-9 h-9 bg-retro-sage rounded-lg transform rotate-45 shadow-lg shadow-retro-sage/50 shrink-0 flex items-center justify-center">
                        <span className="-rotate-45 text-white font-bold text-xs">ML</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-2xl text-retro-teal tracking-tighter leading-none">Ottolearn</span>
                        <span className="text-[10px] text-retro-salmon font-bold uppercase tracking-wider mt-0.5">
                            Inspired by Harvard Method of Teaching
                        </span>
                    </div>
                </div>

                <div className="hidden md:flex gap-8 font-medium text-retro-teal/80 items-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1 hover:text-retro-salmon transition-colors outline-none group data-[state=open]:text-retro-salmon">
                                Our Offerings{' '}
                                <ChevronRight className="w-4 h-4 transition-transform rotate-90 group-data-[state=open]:-rotate-90" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="start"
                            className="w-56 bg-white/95 backdrop-blur-sm border-retro-sage/20 p-2 rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-200"
                        >
                            <DropdownMenuItem
                                onClick={() => setLocation('/offerings/cohort')}
                                className="cursor-pointer rounded-lg hover:bg-retro-sage/10 hover:text-retro-teal focus:bg-retro-sage/10 focus:text-retro-teal py-2.5 px-3 font-medium transition-colors"
                            >
                                Cohort-Based Program
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setLocation('/offerings/on-demand')}
                                className="cursor-pointer rounded-lg hover:bg-retro-sage/10 hover:text-retro-teal focus:bg-retro-sage/10 focus:text-retro-teal py-2.5 px-3 font-medium transition-colors"
                            >
                                OnDemand Courses
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setLocation('/offerings/workshops')}
                                className="cursor-pointer rounded-lg hover:bg-retro-sage/10 hover:text-retro-teal focus:bg-retro-sage/10 focus:text-retro-teal py-2.5 px-3 font-medium transition-colors"
                            >
                                Workshops
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <button onClick={() => scrollToSection('how')} className="hover:text-retro-salmon transition-colors">
                        Methodology
                    </button>
                    <button onClick={() => scrollToSection('courses')} className="hover:text-retro-salmon transition-colors">
                        Courses
                    </button>
                </div>

                <div className="flex items-center gap-3">

                    {isAuthenticated && user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="hidden md:flex group items-center gap-3 rounded-full border border-retro-sage/60 bg-white/90 px-3 py-1.5 text-left text-sm font-medium text-retro-teal shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-retro-salmon/40"
                                >
                                    <Avatar className="h-9 w-9 bg-retro-sage">
                                        {user.picture ? (
                                            <AvatarImage
                                                src={user.picture}
                                                alt={user.fullName ?? 'User'}
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : (
                                            <AvatarFallback className="text-sm font-semibold text-retro-teal">
                                                {(user.fullName ?? user.email ?? 'U')
                                                    .split(' ')
                                                    .map((p) => p[0])
                                                    .join('')
                                                    .slice(0, 2)
                                                    .toUpperCase()}
                                            </AvatarFallback>
                                        )}
                                    </Avatar>
                                    <div className="hidden sm:flex min-w-0 flex-col leading-tight text-left">
                                        <span className="text-xs text-retro-teal/70">Signed in</span>
                                        <span className="truncate text-sm font-semibold text-retro-teal max-w-[150px]">
                                            {user.fullName ?? user.email}
                                        </span>
                                    </div>
                                    <span className="sm:hidden text-sm font-semibold text-retro-teal">
                                        {(user.fullName ?? user.email ?? 'User').split(' ')[0]}
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-retro-teal/70 transition-transform group-data-[state=open]:rotate-90" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64" sideOffset={8}>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-semibold leading-none text-foreground">
                                            {user.fullName ?? 'Learner'}
                                        </span>
                                        <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="flex items-center gap-2 text-destructive focus:text-destructive"
                                    onSelect={onLogout}
                                >
                                    <LogOut className="h-4 w-4" />
                                    Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <button
                            type="button"
                            onClick={onLogin}
                            className="hidden md:flex w-full max-w-[320px] items-center justify-center gap-3 rounded-full border border-gray-300 bg-white/90 px-5 py-2 text-sm font-bold uppercase text-gray-700 transition-all duration-300 hover:scale-[1.03] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-retro-teal sm:w-auto"
                        >
                            <svg
                                className="h-5 w-5"
                                xmlns="http://www.w3.org/2000/svg"
                                preserveAspectRatio="xMidYMid"
                                viewBox="0 0 256 262"
                            >
                                <path
                                    fill="#4285F4"
                                    d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
                                ></path>
                                <path
                                    fill="#34A853"
                                    d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
                                ></path>
                                <path
                                    fill="#FBBC05"
                                    d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"
                                ></path>
                                <path
                                    fill="#EB4335"
                                    d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
                                ></path>
                            </svg>
                            Continue with Google
                        </button>
                    )}
                    <button
                        className="md:hidden inline-flex items-center justify-center rounded-full border border-retro-teal/30 p-2 text-retro-teal bg-white/80 shadow-sm"
                        onClick={() => setMobileMenuOpen((prev) => !prev)}
                        aria-label="Toggle navigation"
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden px-6 pt-3 pb-6"
                    >
                        <div className="flex flex-col gap-3 rounded-2xl border border-retro-sage/30 bg-white/90 p-4 shadow-lg">
                            <button
                                onClick={() => {
                                    scrollToSection('how');
                                    setMobileMenuOpen(false);
                                }}
                                className="w-full text-left font-semibold text-retro-teal hover:text-retro-salmon transition"
                            >
                                Methodology
                            </button>
                            <button
                                onClick={() => {
                                    scrollToSection('courses');
                                    setMobileMenuOpen(false);
                                }}
                                className="w-full text-left font-semibold text-retro-teal hover:text-retro-salmon transition"
                            >
                                Courses
                            </button>
                            {['Cohort Program', 'OnDemand Courses', 'Workshops'].map((item, idx) => {
                                const paths = ['/offerings/cohort', '/offerings/on-demand', '/offerings/workshops'];
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setLocation(paths[idx]);
                                            setMobileMenuOpen(false);
                                        }}
                                        className="w-full text-left font-semibold text-retro-teal hover:text-retro-salmon transition ml-2 text-sm"
                                    >
                                        - {item}
                                    </button>
                                );
                            })}

                            {!isAuthenticated && (
                                <button
                                    onClick={onLogin}
                                    className="w-full text-center border border-gray-300 text-gray-700 py-2 rounded-lg font-bold"
                                >
                                    Continue with Google
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.nav>
    );
};

export default Navbar;
