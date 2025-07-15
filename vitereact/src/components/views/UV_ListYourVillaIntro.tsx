import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "@/store/main";

type Testimonial = {
  quote: string;
  dollars: string;
  name: string;
  role: string;
  image: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      "We listed our villa in early May and welcomed our first $18 K booking within 3 weeks. The concierge support is first-class.",
    dollars: "$18,750",
    name: "Anna & Carlos",
    role: "Villa Owners • Mykonos",
    image: "https://picsum.photos/seed/ownera/80",
  },
  {
    quote:
      "Switching from Airbnb to Estates reduced our cancellations by 40 %. Monthly revenue climbed from $46 K to $67 K.",
    dollars: "$67,000",
    name: "Daniel K.",
    role: "Management Company • Algarve",
    image: "https://picsum.photos/seed/ownerb/80",
  },
  {
    quote:
      "The damage waiver scheme kept us stress-free when a wine piano incident happened. Claims handled in 24 h.",
    dollars: "$9,450",
    name: "Natasha S.",
    role: "Super-Host • Capri",
    image: "https://picsum.photos/seed/ownerc/80",
  },
];

const faqs = [
  {
    q: "How much does it cost to list?",
    a: "Zero upfront fee. We charge a 10 % service fee only when you earn—aligned to your success.",
  },
  {
    q: "Who sets the price?",
    a: "You do. We provide nightly insights based on nearby comps; you keep the final say.",
  },
  {
    q: "Am I protected from damage?",
    a: "Every booking includes a 3.5 % damage waiver backed by €30 million in coverage. Plus 48 h on-site response.",
  },
  {
    q: "Do I have to sync my calendar manually?",
    a: "No. One-click iCal import plus live API sync with Airbnb & VRBO keeps you double-booking safe.",
  },
];

const UV_ListYourVillaIntro: React.FC = () => {
  const { screen_size } = useAppStore((s) => s);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      {/* 1. HEADER / HERO */}
      <header className="w-full bg-white border-b">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link
            to="/"
            className="text-xl font-serif text-gray-900 hover:text-amber-700"
          >
            Estates
          </Link>
          <Link
            to="/host/signup"
            className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm md:text-base hover:bg-amber-700 transition"
          >
            Start Listing
          </Link>
        </nav>
      </header>

      <main>
        {/* 2. HERO SECTION */}
        <section className="relative flex items-center justify-center text-center bg-gradient-to-b from-slate-50 to-white py-24 md:py-36">
          <div className="max-w-3xl px-4">
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-gray-900 leading-tight">
              Monetise your villa with confidence.
            </h1>
            <p className="mt-6 text-lg text-gray-700 max-w-xl mx-auto">
              Join the exclusive marketplace that generated $136 million for luxury
              villa owners in the last 12 months—backed by white-glove concierge support
              and zero upfront fees.
            </p>
            <Link
              to="/host/signup"
              className="mt-8 inline-block px-8 py-3 bg-amber-600 text-white text-lg font-semibold rounded-lg hover:bg-amber-700 transition"
            >
              Start Listing &nbsp;&rarr;
            </Link>
          </div>
        </section>

        {/* 3. SOCIAL PROOF CAROUSEL */}
        <section className="bg-slate-50 py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-serif font-bold text-gray-900">
              Hear from our owners
            </h2>
            <div className="mt-8 mx-auto relative w-72 md:w-96 overflow-hidden">
              <div
                className="flex transition-transform duration-500"
                style={{
                  width: `${testimonials.length * 100}%`,
                  transform: `translateX(-${activeTestimonial * (100 / testimonials.length)}%)`,
                }}
              >
                {testimonials.map((t, idx) => (
                  <div
                    key={idx}
                    className="w-full flex-shrink-0 px-2"
                  >
                    <div className="bg-white rounded-xl shadow-lg p-6 text-left">
                      <p className="text-gray-700 italic">“{t.quote}”</p>
                      <p className="mt-4 font-bold text-lg text-amber-700">{t.dollars} earned</p>
                      <div className="flex items-center mt-4">
                        <img
                          src={t.image}
                          alt={t.name}
                          className="w-12 h-12 rounded-full mr-3"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{t.name}</p>
                          <p className="text-sm text-gray-500">{t.role}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-2 mt-6">
                {testimonials.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveTestimonial(idx)}
                    className={`h-2 w-8 transition rounded-full ${
                      activeTestimonial === idx ? "bg-amber-600" : "bg-slate-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4. FAQ ACCORDION */}
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-serif font-bold text-center text-gray-900">
              Frequently asked questions
            </h2>
            <div className="mt-10">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="border-b border-gray-200 last:border-b-0"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full text-left py-5 flex justify-between items-center"
                  >
                    <span className="text-lg font-medium text-gray-900">
                      {faq.q}
                    </span>
                    <span
                      className={`text-amber-600 text-2xl transition-transform ${
                        openFaq === index ? "rotate-45" : "rotate-0"
                      }`}
                    >
                      +
                    </span>
                  </button>
                  {openFaq === index && (
                    <p className="pb-5 text-gray-600 leading-7">{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. OWNER VIDEO STORIES */}
        <section className="bg-slate-50 py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl font-serif font-bold text-center text-gray-900">
              Owner stories
            </h2>
            <div className="mt-10 grid md:grid-cols-3 gap-8">
              {[1, 2, 3].map((n) => (
                <div key={n} className="relative aspect-video rounded-xl overflow-hidden shadow-lg">
                  <img
                    src={`https://picsum.photos/seed/vid${n}/600/338`}
                    alt={`Owner story ${n}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                    <button
                      className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-amber-600 hover:bg-amber-100"
                      aria-label="Play video"
                    >
                      ▶
                    </button>
                  </div>
                  <p className="absolute bottom-4 left-4 text-white font-semibold">
                    Story {n}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. FINAL CTA STICKY BAR (mobile only) */}
        {screen_size === "xs" || screen_size === "sm" ? (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200">
            <Link
              to="/host/signup"
              className="w-full block text-center px-6 py-3 bg-amber-600 text-white font-semibold rounded-lg"
            >
              Start Listing
            </Link>
          </div>
        ) : null}
      </main>

      {/* 7. FOOTER */}
      <footer className="bg-slate-900 text-slate-300 py-10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>© {new Date().getFullYear()} Estates. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
};

export default UV_ListYourVillaIntro;