// @/components/views/UV_HostSignUp.tsx
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { z } from 'zod';
import { createUserInputSchema, User } from '@schema'; // pulled from shared types
import { use_app_store } from '@/store/main';

// --- Zod aliases --------------------------------------------------
interface RegisterReq {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: 'host';
}
interface RegisterRes { user: User; token: string }

// --- Address eligibility -----------------------------------------
interface EligibleReq { address: string }
interface EligibleRes { eligible: boolean }

// --- CreateHost stub ---------------------------------------------
interface CreateHostReq { user_id:string; payout_schedule:'weekly'; onboarding_complete:false }

// -----------------------------------------------------------------
const UV_HostSignUp: React.FC = () => {
  const [step, setStep] = useState<'auth'|'onboard'>('auth');
  const [addr, setAddr] = useState('');
  const navigate = useNavigate();
  const { set_auth_user, push_notification } = use_app_store(s => ({
    set_auth_user: s.set_auth_user,
    push_notification: s.push_notification,
  }));

  // Auth mutation
  const registerMutation = useMutation<RegisterRes, unknown, RegisterReq>({
    mutationFn: async payload => {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/auth/register`,
        payload,
      );
      return data;
    },
    onSuccess(res) {
      set_auth_user({ user: res.user, token: res.token });
      setStep('onboard');
    },
    onError(err: any) {
      push_notification({
        type: 'error',
        title: 'Registration failed',
        body: err?.response?.data?.error || 'Something went wrong',
      });
    },
  });

  const eligMutation = useMutation<EligibleRes, unknown, EligibleReq>({
    mutationFn: async ({ address }) => {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/villas/eligible`,
        { params: { address } },
      );
      return data;
    },
    onSuccess({ eligible }) {
      if (!eligible) {
        push_notification({
          type: 'info',
          title: 'Not eligible',
          body: 'Your villa must meet luxury pricing criteria. Contact us for more info.',
        });
        return;
      }
      // auto-create host row & go
      axios
        .post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/hosts`,
          { user_id: registerMutation.data?.user.id, payout_schedule: 'weekly', onboarding_complete: false }
        )
        .catch(() => {});
      navigate('/host/listings/new');
    },
  });

  const submitAddress = () => {
    if (!addr.trim()) return;
    eligMutation.mutate({ address: addr });
  };

  // -----------------------------------------------------------------
  // **ONE BIG RENDER** – no helperSplit functions
  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 bg-[url('https://images.unsplash.com/photo-1470770841072-f978cf4d019e')] bg-cover bg-center py-10 px-4">
        {step === 'auth' && (
          <div className="w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-xl shadow-xl p-8 space-y-6">
            <h1 className="text-2xl font-bold text-center text-zinc-800">Host Luxury Villa</h1>

            {/* Minimum banner */}
            <div className="text-center text-sm text-zinc-600 bg-yellow-100 border border-yellow-300 rounded py-2 px-3">
              Minimum $1,000 USD nightly value required
            </div>

            {/* Email Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const body = Object.fromEntries(fd.entries());
                const parsed = createUserInputSchema.omit({role:true}).extend({role:z.literal('host')}).extend({password:z.string().min(8)}).safeParse({
                  ...body,
                  role: 'host',
                });
                if (!parsed.success) {
                  push_notification({type:'error',title:'Validation',body:'Please fill all fields with valid lengths'});
                  return;
                }
                registerMutation.mutate(parsed.data);
              }}
              className="space-y-4"
            >
              <input name="email" type="email" placeholder="Email" required className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-600" />
              <input name="password" type="password" placeholder="Password (min 8)" required className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-600" />
              <div className="flex gap-2">
                <input name="first_name" type="text" placeholder="First name" required className="w-1/2 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-600" />
                <input name="last_name" type="text" placeholder="Last name" required className="w-1/2 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-600" />
              </div>

              <button
                type="submit"
                disabled={registerMutation.isPending}
                className="w-full bg-black text-white py-2 rounded-md hover:bg-zinc-800 disabled:opacity-50"
              >
                {registerMutation.isPending ? 'Signing Up…' : 'Continue'}
              </button>
            </form>

            <div className="text-center text-sm text-zinc-500">or</div>

            {/* TODO: real OAuth flows; for now stand-ins redirecting to guest-signup */}
            <div className="space-y-2">
              <button
                className="w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700"
                type="button"
                onClick={() =>
                  window.open(
                    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/auth/google`,
                    '_self'
                  )
                }
              >
                Continue with Google
              </button>
              <button
                className="w-full bg-zinc-800 text-white py-2 rounded-md hover:bg-black"
                type="button"
                onClick={() =>
                  window.open(
                    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/auth/apple`,
                    '_self'
                  )
                }
              >
                Continue with Apple
              </button>
            </div>

            <p className="text-center text-sm">
              Already hosting? <Link to="/login" className="text-cyan-600 underline">Log in</Link>
            </p>
          </div>
        )}

        {step === 'onboard' && (
          <div className="w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-xl shadow-xl p-8 space-y-6">
            <h1 className="text-2xl font-bold text-center text-zinc-800">One more thing…</h1>
            <p className="text-center text-zinc-600">Enter your villa address to confirm luxury pricing.</p>

            <input
              type="text"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="Villa full address…"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-600"
            />

            <button
              onClick={submitAddress}
              disabled={eligMutation.isPending}
              className="w-full bg-black text-white py-2 rounded-md hover:bg-zinc-800 disabled:opacity-50"
            >
              {eligMutation.isPending ? 'Checking…' : 'Proceed'}
            </button>

            <Link to="/" className="block text-center text-sm text-cyan-600 underline">
              Maybe later →
            </Link>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_HostSignUp;