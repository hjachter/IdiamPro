'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Brain,
  Rocket,
  ArrowRight,
  Check,
  Star,
  Sparkles,
  Gift,
  MessageSquare,
  Zap,
  Shield,
  Users,
  GraduationCap,
  Microscope,
  Building2,
  Scale,
  Lightbulb,
  ArrowLeft,
  Mail,
  User,
  Briefcase,
  CheckCircle2
} from 'lucide-react';

// Launch date: March 1, 2026
const LAUNCH_DATE = new Date('2026-03-01T00:00:00');

// Countdown timer component
function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-2">
        <span className="text-xl sm:text-2xl font-bold text-white">{value.toString().padStart(2, '0')}</span>
      </div>
      <span className="text-xs text-white/50 uppercase tracking-wider">{label}</span>
    </div>
  );

  return (
    <div className="flex gap-2 sm:gap-3">
      <TimeBlock value={timeLeft.days} label="Days" />
      <TimeBlock value={timeLeft.hours} label="Hours" />
      <TimeBlock value={timeLeft.minutes} label="Min" />
      <TimeBlock value={timeLeft.seconds} label="Sec" />
    </div>
  );
}

export default function BetaSignupPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    useCase: '',
    referral: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // For now, open email with pre-filled content
    const subject = encodeURIComponent('Beta Tester Application - IdiamPro');
    const body = encodeURIComponent(`
Name: ${formData.name}
Email: ${formData.email}
Role: ${formData.role}
Primary Use Case: ${formData.useCase}
How did you hear about us: ${formData.referral}

I would like to join the IdiamPro beta program.
    `);

    window.location.href = `mailto:beta@idiampro.com?subject=${subject}&body=${body}`;

    setTimeout(() => {
      setIsSubmitted(true);
      setIsSubmitting(false);
    }, 1000);
  };

  const benefits = [
    {
      icon: Gift,
      title: 'Free Pro Access Forever',
      description: 'Beta testers receive lifetime Pro features at no cost'
    },
    {
      icon: MessageSquare,
      title: 'Direct Product Input',
      description: 'Shape the roadmap with your feedback and feature requests'
    },
    {
      icon: Zap,
      title: 'Early Feature Access',
      description: 'Be the first to try new capabilities before public release'
    },
    {
      icon: Shield,
      title: 'Priority Support',
      description: 'Direct access to the development team for assistance'
    }
  ];

  const roles = [
    { value: 'researcher', label: 'Academic Researcher', icon: GraduationCap },
    { value: 'scientist', label: 'Scientist', icon: Microscope },
    { value: 'industry', label: 'Industry R&D', icon: Building2 },
    { value: 'consultant', label: 'Consultant', icon: Lightbulb },
    { value: 'legal', label: 'Legal Professional', icon: Scale },
    { value: 'other', label: 'Other Professional', icon: Briefcase }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </a>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">IdiamPro</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 py-12 lg:px-12">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-6">
              <Rocket className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300">Limited Beta Program</span>
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                Join the Future of
              </span>
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                Cognitive Enhancement
              </span>
            </h1>

            <p className="text-xl text-white/60 max-w-2xl mx-auto mb-8">
              Be among the first to experience IdiamPro&apos;s intelligence amplification platform.
              Help us build the ultimate second brain for professional researchers.
            </p>

            {/* Countdown */}
            <div className="mb-8">
              <p className="text-white/40 text-sm mb-4">Full launch in:</p>
              <div className="flex justify-center">
                <CountdownTimer targetDate={LAUNCH_DATE} />
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-emerald-400">50</div>
                <div className="text-white/40 text-sm">Beta Spots</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-violet-400">Free</div>
                <div className="text-white/40 text-sm">Forever</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-amber-400">March</div>
                <div className="text-white/40 text-sm">2026 Launch</div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Benefits */}
            <div>
              <h2 className="text-2xl font-bold mb-8">Beta Tester Benefits</h2>
              <div className="space-y-6">
                {benefits.map((benefit, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{benefit.title}</h3>
                      <p className="text-white/50 text-sm">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Who Should Apply */}
              <div className="mt-12">
                <h2 className="text-2xl font-bold mb-6">Who Should Apply</h2>
                <div className="grid grid-cols-2 gap-3">
                  {roles.map((role) => (
                    <div key={role.value} className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                      <role.icon className="w-4 h-4 text-violet-400" />
                      <span className="text-sm text-white/70">{role.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Signup Form */}
            <div className="lg:sticky lg:top-8">
              {isSubmitted ? (
                <div className="p-8 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Application Submitted!</h3>
                  <p className="text-white/60 mb-6">
                    Thank you for your interest in IdiamPro. We&apos;ll review your application and
                    get back to you within 48 hours.
                  </p>
                  <p className="text-white/40 text-sm">
                    In the meantime, you can try our web version at{' '}
                    <a href="/app" className="text-emerald-400 hover:underline">/app</a>
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-8 rounded-3xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Apply for Beta Access</h3>
                      <p className="text-white/40 text-sm">Limited spots available</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {/* Name */}
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                          placeholder="Dr. Jane Smith"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                          placeholder="jane@university.edu"
                        />
                      </div>
                    </div>

                    {/* Role */}
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Your Role</label>
                      <select
                        required
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-gray-900">Select your role...</option>
                        {roles.map((role) => (
                          <option key={role.value} value={role.value} className="bg-gray-900">
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Use Case */}
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Primary Use Case</label>
                      <textarea
                        required
                        value={formData.useCase}
                        onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 resize-none"
                        placeholder="I'm researching climate change impacts and need to synthesize papers from multiple disciplines..."
                      />
                    </div>

                    {/* Referral */}
                    <div>
                      <label className="block text-sm text-white/60 mb-2">How did you hear about us?</label>
                      <input
                        type="text"
                        value={formData.referral}
                        onChange={(e) => setFormData({ ...formData, referral: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                        placeholder="Twitter, colleague, conference..."
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-6 text-lg shadow-lg shadow-emerald-500/25"
                    >
                      {isSubmitting ? (
                        'Submitting...'
                      ) : (
                        <>
                          Apply for Beta Access
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>

                    <p className="text-center text-white/30 text-xs">
                      By applying, you agree to provide feedback and help us improve IdiamPro.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-white/10 mt-16">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">
            © 2026 IdiamPro. Your Intelligence Amplifier.
          </p>
          <div className="flex items-center gap-6">
            <a href="/" className="text-white/30 hover:text-white text-sm transition-colors">Home</a>
            <a href="/app" className="text-white/30 hover:text-white text-sm transition-colors">Try App</a>
            <a href="mailto:beta@idiampro.com" className="text-white/30 hover:text-white text-sm transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
