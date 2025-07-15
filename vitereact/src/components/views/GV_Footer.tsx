import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const GV_Footer: React.FC = () => {
  const location = useLocation();

  // Kiosk-mode detection aligns with top-level regex used in App.tsx
  const kioskPatterns = [/^\/checkout\//, /^\/guidebook\//, /^\/admin\//];
  const hidden = kioskPatterns.some((re) => re.test(location.pathname));

  // inlined SVG helper icons
  const InstagramIcon = () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987 6.62 0 11.987-5.367 11.987-11.987C24.004 5.367 18.637.001 12.017.001zm2.984 18.235c-.16.161-.374.242-.588.242H9.588c-.214 0-.428-.08-.588-.242a.847.847 0 01-.242-.588V9.587c0-.215.081-.429.242-.589.16-.16.374-.241.588-.241h4.825c.214 0 .428.081.588.241.16.16.242.374.242.589v7.06a.847.847 0 01-.242.588zM12 7.654c-2.396 0-4.346 1.95-4.346 4.346 0 2.396 1.95 4.346 4.346 4.346 2.396 0 4.346-1.95 4.346-4.346 0-2.396-1.95-4.346-4.346-4.346z" />
    </svg>
  );

  // early bailout
  if (hidden) {
    return null;
  }

  return (
    <>
      <footer className="w-full bg-white border-t border-neutral-200">
        {/* Primary grid */}
        <div className="max-w-screen-2xl mx-auto py-10 px-6 md:px-8 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {/* Left column */}
            <div>
              <Link to="/" className="block text-2xl font-serif text-brandGold">
                Estates
              </Link>
              <p className="mt-2 text-sm text-neutral-600">
                Curated luxury villa rentals.
              </p>
              <Link
                to="/careers"
                className="mt-4 inline-block text-sm underline text-neutral-600 hover:text-brandGold"
              >
                Careers
              </Link>
            </div>

            {/* Center column */}
            <div>
              <h3 className="font-semibold text-sm text-neutral-800 uppercase tracking-wider">
                Destinations
              </h3>
              <ul className="mt-3 space-y-2">
                {['Santorini', 'Amalfi Coast', 'Bali', 'Maldives', 'St. Barths'].map((d) => (
                  <li key={d}>
                    <Link
                      to={`/search?q=${encodeURIComponent(d)}`}
                      className="text-sm text-neutral-600 hover:text-brandGold underline"
                    >
                      {d}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right column */}
            <div>
              <h3 className="font-semibold text-sm text-neutral-800 uppercase tracking-wider">
                Support
              </h3>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    to="/contact"
                    className="text-sm text-neutral-600 hover:text-brandGold underline"
                  >
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link
                    to="/faq"
                    className="text-sm text-neutral-600 hover:text-brandGold underline"
                  >
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    to="/help"
                    className="text-sm text-neutral-600 hover:text-brandGold underline"
                  >
                    Help Center
                  </Link>
                </li>
              </ul>
              <div className="flex items-center gap-4 mt-4">
                <a
                  href="https://instagram.com/estates"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="text-neutral-500 hover:text-brandGold"
                >
                  <InstagramIcon />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright row */}
        <div className="border-t border-neutral-200 px-6 md:px-8 lg:px-12">
          <div className="max-w-screen-2xl mx-auto py-4 text-xs text-neutral-500 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div>
              © {new Date().getFullYear()} Estates Inc. All rights reserved.
            </div>
            <div className="flex gap-4">
              <Link to="/terms" className="hover:underline">
                Terms of Service
              </Link>
              <Link to="/privacy" className="hover:underline">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default GV_Footer;