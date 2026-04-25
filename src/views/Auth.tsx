import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Github, Mail, ArrowUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface AuthProps {
  onAuthSuccess: () => void;
  onBackToLanding: () => void;
  initialMode?: 'login' | 'signup';
}

export default function Auth({ onAuthSuccess, onBackToLanding, initialMode = 'login' }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullname, setFullname] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAuthSuccess();
  };

  return (mode === 'signup' ? (
    /* SIGN UP VIEW */
    <div className="bg-background text-on-surface antialiased min-h-screen relative flex items-center justify-center selection:bg-primary selection:text-on-primary font-body-md text-body-md overflow-x-hidden">
      {/* Structural Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-60 bg-technical-grid"></div>

      {/* Main Content Canvas (Floating Card) */}
      <motion.main 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-[480px] mx-4 sm:mx-auto bg-surface-bright/95 backdrop-blur-sm p-8 sm:p-12 rounded-xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.04)] border border-outline-variant/30"
      >
        {/* Brand / Context */}
        <header className="mb-10 text-center sm:text-left">
          <button 
            onClick={onBackToLanding}
            className="font-ui-label text-ui-label text-on-surface-variant uppercase tracking-widest mb-8 hover:text-primary transition-colors"
          >
            Automata
          </button>
          <h1 className="font-headline-lg text-6xl italic font-normal text-primary">
            Start Building.
          </h1>
        </header>

        {/* Social Auth Actions */}
        <div className="flex flex-col gap-3 mb-8">
          <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-outline rounded text-on-surface font-ui-label text-ui-label hover:bg-surface-container transition-colors duration-200 group">
            <Github size={18} className="opacity-80 group-hover:opacity-100 transition-opacity" />
            Sign Up with GitHub
          </button>
          <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-outline rounded text-on-surface font-ui-label text-ui-label hover:bg-surface-container transition-colors duration-200 group">
            <svg aria-hidden="true" className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
            </svg>
            Sign Up with Google
          </button>
        </div>

        {/* Semantic Divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-[1px] bg-outline-variant flex-1 opacity-30"></div>
          <span className="font-technical-mono text-technical-mono text-on-surface-variant uppercase tracking-widest text-[10px]">Or</span>
          <div className="h-[1px] bg-outline-variant flex-1 opacity-30"></div>
        </div>

        {/* Registration Form */}
        <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
          {/* Full Name */}
          <div className="relative flex flex-col">
            <label className="font-ui-label text-ui-label text-on-surface-variant mb-2" htmlFor="fullname">Full Name</label>
            <input 
              className="w-full bg-transparent border-0 border-b border-primary p-0 pb-2 focus:ring-0 focus:border-b-2 focus:border-primary font-body-md text-body-md placeholder:text-on-surface-variant/40 transition-all outline-none" 
              id="fullname" 
              value={fullname}
              onChange={(e) => setFullname(e.target.value)}
              placeholder="Jane Doe" 
              required 
              type="text"
            />
          </div>
          {/* Work Email */}
          <div className="relative flex flex-col">
            <label className="font-ui-label text-ui-label text-on-surface-variant mb-2" htmlFor="email">Work Email</label>
            <input 
              className="w-full bg-transparent border-0 border-b border-primary p-0 pb-2 focus:ring-0 focus:border-b-2 focus:border-primary font-body-md text-body-md placeholder:text-on-surface-variant/40 transition-all outline-none" 
              id="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com" 
              required 
              type="email"
            />
          </div>
          {/* Password */}
          <div className="relative flex flex-col mb-2">
            <label className="font-ui-label text-ui-label text-on-surface-variant mb-2" htmlFor="password">Password</label>
            <input 
              className="w-full bg-transparent border-0 border-b border-primary p-0 pb-2 focus:ring-0 focus:border-b-2 focus:border-primary font-body-md text-body-md placeholder:text-on-surface-variant/40 transition-all outline-none" 
              id="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              required 
              type="password"
            />
          </div>
          {/* Submit Action */}
          <button className="w-full bg-black text-white py-4 rounded-full font-ui-label text-ui-label uppercase tracking-widest hover:bg-neutral-800 shadow-xl hover:shadow-2xl transition-all mt-2 active:scale-95" type="submit">
            Create Account
          </button>
        </form>

        {/* Contextual Footer Link */}
        <div className="mt-8 text-center sm:text-left">
          <p className="font-body-md text-body-md text-on-surface-variant">
            Already have an account? 
            <button 
              onClick={() => setMode('login')}
              className="text-black hover:text-neutral-700 underline underline-offset-4 decoration-black/30 hover:decoration-black transition-all ml-1 font-medium font-ui-label"
            >
              Sign In
            </button>
          </p>
        </div>
      </motion.main>
    </div>
  ) : (
    /* SIGN IN VIEW */
    <div className="bg-background text-on-surface antialiased min-h-screen relative flex items-center justify-center selection:bg-primary selection:text-on-primary font-body-md text-body-md overflow-x-hidden">
      {/* Structural Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-60 bg-technical-grid"></div>

      <main className="flex-grow flex items-center justify-center p-8 relative z-10 w-full overflow-y-auto pt-24 pb-48">
        {/* Floating Card Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-surface-container-lowest/90 backdrop-blur-md p-10 md:p-14 rounded-[16px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.04)] border border-surface-variant relative overflow-hidden"
        >
          {/* Structural Accent Line inside card */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-outline-variant/30"></div>
          
          <div className="mb-12 text-center">
            <button 
              onClick={onBackToLanding}
              className="font-ui-label text-ui-label text-on-surface-variant uppercase tracking-widest block mb-4 mx-auto hover:text-primary transition-colors"
            >
              Automata Workspace
            </button>
            <h1 className="font-display-xl text-display-xl text-primary mt-2">Welcome Back.</h1>
          </div>

          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="relative">
              <label className="block font-technical-mono text-technical-mono text-on-surface-variant uppercase tracking-wider mb-2 text-[10px]" htmlFor="email">Email Address</label>
              <input 
                className="w-full bg-transparent border-none border-b border-outline-variant focus:ring-0 focus:border-primary font-body-lg text-body-lg text-on-background py-3 placeholder:text-outline-variant outline-none transition-all" 
                id="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@automata.net" 
                required 
                type="email"
              />
              <div className="absolute bottom-0 left-0 w-full h-[1px] bg-outline-variant"></div>
            </div>
            {/* Password Field */}
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <label className="block font-technical-mono text-technical-mono text-on-surface-variant uppercase tracking-wider text-[10px]" htmlFor="password">Password</label>
                <button type="button" className="font-technical-mono text-technical-mono text-secondary hover:text-primary transition-colors underline decoration-outline-variant underline-offset-4 text-[10px]">Forgot?</button>
              </div>
              <input 
                className="w-full bg-transparent border-none border-b border-outline-variant focus:ring-0 focus:border-primary font-body-lg text-body-lg text-on-background py-3 placeholder:text-outline-variant outline-none transition-all" 
                id="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                required 
                type="password"
              />
              <div className="absolute bottom-0 left-0 w-full h-[1px] bg-outline-variant"></div>
            </div>
            {/* Sign In Button */}
            <div className="pt-4">
              <button className="w-full bg-black text-white font-ui-label text-ui-label py-4 rounded-full hover:bg-neutral-800 shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-95" type="submit">
                <span>Sign In</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </form>

          <div className="mt-10 flex items-center gap-4">
            <div className="h-[1px] flex-1 bg-surface-variant opacity-30"></div>
            <span className="font-technical-mono text-technical-mono text-on-surface-variant text-[10px] tracking-widest">OR CONTINUE WITH</span>
            <div className="h-[1px] flex-1 bg-surface-variant opacity-30"></div>
          </div>

          <div className="mt-8 space-y-4">
            {/* GitHub Button */}
            <button className="w-full border border-surface-variant bg-transparent text-primary font-ui-label text-ui-label py-3 rounded-full hover:bg-surface-container-low transition-colors duration-200 flex items-center justify-center gap-3" type="button">
              <Github size={18} />
              <span>Sign In with GitHub</span>
            </button>
            {/* Google Button */}
            <button className="w-full border border-surface-variant bg-transparent text-primary font-ui-label text-ui-label py-3 rounded-full hover:bg-surface-container-low transition-colors duration-200 flex items-center justify-center gap-3" type="button">
              <svg aria-hidden="true" className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
              <span>Sign In with Google</span>
            </button>
          </div>

          <div className="mt-12 text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Don't have an account? 
              <button 
                onClick={() => setMode('signup')}
                className="text-black font-medium hover:underline underline-offset-4 decoration-black ml-1 font-ui-label"
              >
                Sign Up
              </button>
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  ));
}
