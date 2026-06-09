"use client";

import { Building2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#0f172a] text-white">
      {/* Main links row */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2 space-y-3 pr-8">
            <div className="flex items-center gap-2.5">
              <div className="bg-gradient-to-br from-[#6366f1] to-[#4f46e5] w-7 h-7 rounded-md flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-white tracking-tight">
                  DOM BIM
                </span>
                <span className="text-[9px] text-slate-400 font-medium uppercase tracking-widest">
                  Platform
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[260px]">
              Consulting, Engineering &amp; Architecture. Proyectos sostenibles
              para un mundo más habitable.
            </p>
          </div>

          {/* Platform */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-slate-200 uppercase tracking-widest">
              Platform
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  Projects
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  BOM &amp; Quantities
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  3D Viewer
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  Compliance
                </span>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-slate-200 uppercase tracking-widest">
              Company
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  dombim.dev
                </a>
              </li>
              <li>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Offices
                </a>
              </li>
              <li>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Careers
                </a>
              </li>
              <li>
                <a
                  href="mailto:chirinosebastianmn@gmail.com"
                  className="hover:text-white transition-colors"
                >
                  chirinosebastianmn@gmail.com
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-slate-200 uppercase tracking-widest">
              Legal
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Legal Notice
                </a>
              </li>
              <li>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Certifications
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            © 2026 DOM BIM. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-white transition-colors"
              title="LinkedIn"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-white transition-colors"
              title="Facebook"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
